-- =====================================================================
--  АвтоМастер24 — обновление 3: фото, чат, профиль исполнителя, ответы на отзывы.
--  ТОЛЬКО ДОБАВЛЯЕТ (новые колонки/таблицы/функции/бакеты). Данные не удаляются.
--  Повторный запуск безопасен. Таблицы VeloMarket не затрагиваются.
-- =====================================================================

-- ---------- новые колонки ----------
alter table am_providers add column if not exists about text not null default '';
alter table am_providers add column if not exists photos text[] not null default '{}';
alter table am_providers add column if not exists whatsapp text not null default '';
alter table am_providers add column if not exists verified boolean not null default false;
alter table am_requests  add column if not exists accepted_at timestamptz;
alter table am_reviews   add column if not exists reply text;
alter table am_reviews   add column if not exists reply_at timestamptz;

-- «Проверен» и рейтинг меняет только админ
create or replace function am_providers_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not am_is_admin(old.city) then
    new.owner_id := old.owner_id; new.kind := old.kind; new.rating := old.rating;
    new.reviews_count := old.reviews_count; new.is_active := old.is_active; new.city := old.city;
    new.verified := old.verified;
  end if;
  new.about := left(coalesce(new.about, ''), 2000);
  if cardinality(new.photos) > 12 then new.photos := new.photos[1:12]; end if;
  return new;
end $$;

-- время принятия заявки (для статистики «отвечает за N минут»)
create or replace function am_requests_accepted_at() returns trigger language plpgsql as $$
begin
  if new.accepted_by is not null and old.accepted_by is null and new.accepted_at is null then new.accepted_at := now(); end if;
  return new;
end $$;
drop trigger if exists am_requests_accepted_at on am_requests;
create trigger am_requests_accepted_at before update on am_requests for each row execute function am_requests_accepted_at();

-- ---------- публичная статистика исполнителя ----------
create or replace function am_provider_stats(p_id int) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'completed', (select count(*) from am_requests where accepted_by = p_id and status = 'completed'),
    'response_min', (select round(percentile_cont(0.5) within group (order by extract(epoch from (accepted_at - created_at)) / 60))::int
                     from am_requests where accepted_by = p_id and accepted_at is not null and accepted_at > created_at),
    'price_from', (select min(price) from am_prices where provider_id = p_id));
$$;
grant execute on function am_provider_stats(int) to anon, authenticated;

-- ---------- ответ исполнителя на отзыв ----------
create or replace function am_reply_review(p_id bigint, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare rv am_reviews;
begin
  select * into rv from am_reviews where id = p_id;
  if not found or not (am_owns(rv.provider_id) or am_is_admin()) then raise exception 'Нет прав'; end if;
  update am_reviews set reply = nullif(left(trim(coalesce(p_text,'')), 1000), ''), reply_at = now() where id = p_id;
end $$;
revoke execute on function am_reply_review(bigint, text) from anon;

-- ---------- чат клиент ↔ исполнитель по заявке ----------
create table if not exists am_messages (
  id bigserial primary key,
  request_id bigint not null references am_requests(id) on delete cascade,
  sender_id uuid default auth.uid() references am_profiles(id) on delete set null,
  from_provider boolean not null default false,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists am_messages_req on am_messages(request_id, id);
alter table am_messages enable row level security;

-- писать могут: клиент — автор заявки, и исполнитель, который её взял (accepted_by); админ читает
create or replace function am_chat_role(p_id bigint) returns text
language sql stable security definer set search_path = public as $$
  select case
    when r.user_id = auth.uid() then 'client'
    when r.accepted_by is not null and exists (select 1 from am_providers p where p.id = r.accepted_by and p.owner_id = auth.uid()) then 'provider'
    when am_is_admin(r.city) then 'admin'
  end from am_requests r where r.id = p_id;
$$;

drop policy if exists "chat members" on am_messages;
create policy "chat members" on am_messages for select to authenticated using (am_chat_role(request_id) is not null);
revoke all on am_messages from anon;
revoke insert, update, delete on am_messages from authenticated;
grant select on am_messages to authenticated;

create or replace function am_send_message(p_id bigint, p_body text) returns am_messages
language plpgsql security definer set search_path = public as $$
declare role text := am_chat_role(p_id); r am_requests; m am_messages;
begin
  if role is null or role = 'admin' then raise exception 'Чат доступен клиенту и исполнителю, который взял заявку'; end if;
  select * into r from am_requests where id = p_id;
  if r.accepted_by is null then raise exception 'Чат откроется, когда исполнитель возьмёт заявку'; end if;
  if r.status in ('cancelled') or (r.status = 'completed' and r.updated_at < now() - interval '7 days') then raise exception 'Чат по этой заявке закрыт'; end if;
  if coalesce(trim(p_body),'') = '' then raise exception 'Пустое сообщение'; end if;
  if (select count(*) from am_messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Слишком много сообщений, подождите минуту'; end if;
  insert into am_messages(request_id, sender_id, from_provider, body) values (p_id, auth.uid(), role = 'provider', left(trim(p_body), 2000))
  returning * into m;
  return m;
end $$;
revoke execute on function am_send_message(bigint, text) from anon;

-- realtime для чата (если публикация есть — в Supabase она есть)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'am_messages') then
    execute 'alter publication supabase_realtime add table am_messages';
  end if;
end $$;

-- ---------- хранилище фото ----------
-- am-photos (закрытый): фото к заявкам, путь req/<uid>/<файл>. Видят автор и исполнители, которым видна заявка.
-- am-public (открытый): фото организаций, путь prov/<provider_id>/<файл>. Загружает владелец или админ.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('am-photos', 'am-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('am-public', 'am-public', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create or replace function am_can_see_photo(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select split_part(p_name, '/', 2) = auth.uid()::text
      or exists (select 1 from am_requests r where r.details->'photos' ? p_name and am_can_see_request(r.id));
$$;
create or replace function am_can_edit_prov_photo(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when split_part(p_name, '/', 1) = 'prov' and split_part(p_name, '/', 2) ~ '^\d{1,9}$'
    then am_owns(split_part(p_name, '/', 2)::int) or am_is_admin() else false end;
$$;

drop policy if exists "am photos read" on storage.objects;
create policy "am photos read" on storage.objects for select to authenticated
  using (bucket_id = 'am-photos' and am_can_see_photo(name));
drop policy if exists "am photos upload" on storage.objects;
create policy "am photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'am-photos' and split_part(name, '/', 1) = 'req' and split_part(name, '/', 2) = auth.uid()::text);
drop policy if exists "am photos delete" on storage.objects;
create policy "am photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'am-photos' and split_part(name, '/', 2) = auth.uid()::text);
drop policy if exists "am public read" on storage.objects;
create policy "am public read" on storage.objects for select using (bucket_id = 'am-public');
drop policy if exists "am public upload" on storage.objects;
create policy "am public upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'am-public' and am_can_edit_prov_photo(name));
drop policy if exists "am public delete" on storage.objects;
create policy "am public delete" on storage.objects for delete to authenticated
  using (bucket_id = 'am-public' and am_can_edit_prov_photo(name));

grant usage, select on all sequences in schema public to authenticated;
