-- =====================================================================
--  АвтоМастер24 — обновление 5: чат по заказу на сайте (как переписка в боте), полный цикл заказа,
--  оценка → рейтинг визитки, удаление переписки после закрытия заказа.
--  ТОЛЬКО ДОБАВЛЯЕТ. Повторный запуск безопасен. Применять ПОСЛЕ 04_cards_cargo_shop.sql.
--
--  Цикл заказа (am_leads.status):
--    new → clarify (уточнение) → agreed (цена согласована) → in_work → done → paid → closed
--    + оценка клиента (rating) в любой момент после done; закрыт = оплачен И оценён
--    (или оплачен и 7 дней без оценки; или выполнен и 30 дней без оплаты; или cancelled).
--  Через 3 дня после закрытия сообщения чата удаляются (am_purge_order_chats, pg_cron),
--  итог заказа (первая заявка, согласованная цена, оценка и отзыв) сохраняется.
-- =====================================================================

-- ---------- заказ = лид из 04 + поля цикла ----------
alter table am_leads add column if not exists token text;           -- секрет клиента: order.html?id=&t= (гость без входа)
alter table am_leads add column if not exists chan text;            -- имя realtime-канала (знают клиент и владелец)
alter table am_leads add column if not exists agreed_price int;
alter table am_leads add column if not exists rating int;
alter table am_leads add column if not exists review text;
alter table am_leads add column if not exists rated_at timestamptz;
alter table am_leads add column if not exists paid_at timestamptz;
alter table am_leads add column if not exists done_at timestamptz;
alter table am_leads add column if not exists closed_at timestamptz;
alter table am_leads add column if not exists chat_purged_at timestamptz;
alter table am_leads add column if not exists last_msg_at timestamptz;
alter table am_leads add column if not exists last_from text;
alter table am_leads add column if not exists owner_seen_at timestamptz;
alter table am_leads add column if not exists client_seen_at timestamptz;
alter table am_leads add column if not exists claim_tries int not null default 0;  -- попытки «вернуться в чат по телефону»
alter table am_leads add column if not exists claim_at timestamptz;
update am_leads set token = replace(gen_random_uuid()::text, '-', '') where token is null;
update am_leads set chan = replace(gen_random_uuid()::text, '-', '') where chan is null;
alter table am_leads alter column token set default replace(gen_random_uuid()::text, '-', '');
alter table am_leads alter column chan set default replace(gen_random_uuid()::text, '-', '');
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'am_leads'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%in_work%' and pg_get_constraintdef(oid) not like '%clarify%' loop
    execute format('alter table am_leads drop constraint %I', c.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'am_leads_status_check5') then
    alter table am_leads add constraint am_leads_status_check5 check (status in ('new','clarify','agreed','in_work','done','paid','closed','cancelled')); end if;
  if not exists (select 1 from pg_constraint where conname = 'am_leads_rating_check5') then
    alter table am_leads add constraint am_leads_rating_check5 check (rating is null or rating between 1 and 5); end if;
end $$;
create index if not exists am_leads_closed on am_leads(closed_at) where closed_at is not null and chat_purged_at is null;

-- секрет клиента не видит никто, кроме функций (владелец не может «стать клиентом» и поставить себе оценку)
revoke select on am_leads from authenticated;
grant select (id, provider_id, kind, source, user_id, customer_name, customer_phone, message, payload, total, status, created_at, updated_at,
  chan, agreed_price, rating, review, rated_at, paid_at, done_at, closed_at, chat_purged_at, last_msg_at, last_from, owner_seen_at, client_seen_at)
  on am_leads to authenticated;

-- ---------- сообщения чата ----------
create table if not exists am_order_messages (
  id bigserial primary key,
  lead_id bigint not null references am_leads(id) on delete cascade,
  author text not null check (author in ('client','owner','system')),
  body text not null default '' check (char_length(body) <= 2000),
  photo text check (photo is null or (length(photo) <= 400000 and photo ~ '^data:image/(jpeg|png|webp);base64,')),
  offer_price int check (offer_price is null or offer_price > 0),
  offer_state text check (offer_state in ('open','accepted','declined','expired')),
  created_at timestamptz not null default now()
);
create index if not exists am_order_messages_lead on am_order_messages(lead_id, id);
alter table am_order_messages enable row level security;
drop policy if exists "owner or admin read" on am_order_messages;
create policy "owner or admin read" on am_order_messages for select to authenticated
  using (exists (select 1 from am_leads l where l.id = lead_id and ((l.provider_id is not null and am_owns(l.provider_id))
         or am_is_admin(case when l.provider_id is null then null else (select city from am_providers where id = l.provider_id) end))));
revoke all on am_order_messages from anon;
revoke insert, update, delete on am_order_messages from authenticated;
grant select on am_order_messages to authenticated;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'am_order_messages') then
    execute 'alter publication supabase_realtime add table am_order_messages';
  end if;
end $$;

-- ---------- кто смотрит заказ: client (по секрету) / owner (владелец или админ) ----------
create or replace function am_order_role(p_id bigint, p_token text) returns text
language plpgsql stable security definer set search_path = public as $$
declare l am_leads;
begin
  select * into l from am_leads where id = p_id;
  if not found then raise exception 'Заказ не найден'; end if;
  if coalesce(p_token, '') <> '' then
    if p_token = l.token then return 'client'; end if;
    raise exception 'Заказ не найден';
  end if;
  if (l.provider_id is not null and am_owns(l.provider_id))
     or am_is_admin(case when l.provider_id is null then null else (select city from am_providers where id = l.provider_id) end) then return 'owner'; end if;
  if l.user_id is not null and l.user_id = auth.uid() then return 'client'; end if;
  raise exception 'Заказ не найден';
end $$;

create or replace function am_order_sys(p_id bigint, p_text text) returns void
language sql security definer set search_path = public as $$
  insert into am_order_messages(lead_id, author, body) values (p_id, 'system', p_text);
$$;
revoke execute on function am_order_sys(bigint, text) from public, anon, authenticated;

create or replace function am_order_close(p_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update am_leads set status = case when status = 'cancelled' then status else 'closed' end, closed_at = now(), updated_at = now()
   where id = p_id and closed_at is null;
  if found then perform am_order_sys(p_id, p_reason || ' Переписка будет удалена через 3 дня. Итог заказа, цена и отзыв сохранятся.'); end if;
end $$;
revoke execute on function am_order_close(bigint, text) from public, anon, authenticated;

-- рейтинг визитки = отзывы из приложения (am_reviews) + оценки заказов
create or replace function am_recalc_rating(p_provider int) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('am.trusted', '1', true);  -- триггер-страж пропустит пересчёт рейтинга (исправляет и отзывы из приложения)
  with x as (select rating from am_reviews where provider_id = p_provider
             union all select rating from am_leads where provider_id = p_provider and rating is not null)
  update am_providers set rating = coalesce((select round(avg(rating)::numeric, 2) from x), 0),
    reviews_count = (select count(*) from x) where id = p_provider;
  perform set_config('am.trusted', '', true);
end $$;
revoke execute on function am_recalc_rating(int) from public, anon, authenticated;

-- ---------- создание заказа: возвращает id и секрет клиента ----------
create or replace function am_create_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare nid bigint; l am_leads;
begin
  nid := am_create_lead(p);
  update am_leads set last_msg_at = now(), last_from = 'client' where id = nid returning * into l;
  perform am_order_sys(nid, 'Заявка создана. Здесь можно уточнить детали и цену — переписка остаётся на сайте.');
  if random() < 0.05 then perform am_purge_order_chats(); end if;
  return jsonb_build_object('id', l.id, 'token', l.token, 'chan', l.chan);
end $$;

create or replace function am_order_get(p_id bigint, p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r text := am_order_role(p_id, p_token); l am_leads; pv am_providers;
begin
  select * into l from am_leads where id = p_id;
  select * into pv from am_providers where id = l.provider_id;
  return jsonb_build_object('id', l.id, 'role', r, 'kind', l.kind, 'source', l.source, 'status', l.status, 'message', l.message,
    'payload', l.payload, 'total', l.total, 'agreed_price', l.agreed_price, 'rating', l.rating, 'review', l.review,
    'customer_name', l.customer_name, 'customer_phone', case when r = 'owner' or p_token is not null then l.customer_phone else '' end,
    'created_at', l.created_at, 'paid_at', l.paid_at, 'done_at', l.done_at, 'closed_at', l.closed_at, 'chat_purged_at', l.chat_purged_at,
    'chan', l.chan, 'provider', case when pv.id is null then null else jsonb_build_object('id', pv.id, 'name', pv.name, 'kind', pv.kind,
      'phone', pv.phone, 'whatsapp', pv.whatsapp, 'city', pv.city, 'address', pv.address, 'rating', pv.rating, 'reviews_count', pv.reviews_count) end);
end $$;

create or replace function am_order_messages_list(p_id bigint, p_token text, p_after bigint default 0) returns setof am_order_messages
language plpgsql security definer set search_path = public as $$
declare r text := am_order_role(p_id, p_token);
begin
  if r = 'owner' then update am_leads set owner_seen_at = now() where id = p_id;
  else update am_leads set client_seen_at = now() where id = p_id; end if;
  return query select * from am_order_messages where lead_id = p_id and id > coalesce(p_after, 0) order by id limit 500;
end $$;

create or replace function am_order_send(p_id bigint, p_token text, p jsonb) returns am_order_messages
language plpgsql security definer set search_path = public as $$
declare r text := am_order_role(p_id, p_token); l am_leads; m am_order_messages; price int := nullif(p->>'offer_price','')::numeric::int;
  body text := left(coalesce(p->>'body',''), 2000); ph text := nullif(p->>'photo','');
begin
  select * into l from am_leads where id = p_id for update;
  if l.closed_at is not null or l.status in ('closed','cancelled') then raise exception 'Заказ закрыт — переписка недоступна'; end if;
  if trim(body) = '' and ph is null and price is null then raise exception 'Пустое сообщение'; end if;
  if price is not null and r <> 'owner' then raise exception 'Цену предлагает исполнитель'; end if;
  if (select count(*) from am_order_messages where lead_id = p_id and author = r and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Слишком часто. Подождите минуту'; end if;
  if (select count(*) from am_order_messages where lead_id = p_id) >= 1000 then raise exception 'Слишком длинная переписка'; end if;
  if price is not null then update am_order_messages set offer_state = 'expired' where lead_id = p_id and offer_state = 'open'; end if;
  insert into am_order_messages(lead_id, author, body, photo, offer_price, offer_state)
  values (p_id, r, body, ph, price, case when price is not null then 'open' end) returning * into m;
  update am_leads set last_msg_at = now(), last_from = r, updated_at = now(),
    status = case when r = 'owner' and status = 'new' then 'clarify' else status end where id = p_id;
  return m;
end $$;

create or replace function am_order_accept_offer(p_id bigint, p_token text, p_msg bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r text := am_order_role(p_id, p_token); m am_order_messages;
begin
  if r <> 'client' then raise exception 'Цену принимает клиент'; end if;
  select * into m from am_order_messages where id = p_msg and lead_id = p_id and offer_state = 'open' for update;
  if not found then raise exception 'Предложение уже неактуально'; end if;
  update am_order_messages set offer_state = 'accepted' where id = m.id;
  update am_leads set agreed_price = m.offer_price, updated_at = now(),
    status = case when status in ('new','clarify','agreed') then 'agreed' else status end where id = p_id;
  perform am_order_sys(p_id, 'Цена согласована: ' || m.offer_price || '.');
end $$;

create or replace function am_order_set_status(p_id bigint, p_token text, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare r text := am_order_role(p_id, p_token); l am_leads;
begin
  select * into l from am_leads where id = p_id for update;
  if l.closed_at is not null then raise exception 'Заказ уже закрыт'; end if;
  if r = 'client' then
    if p_status <> 'cancelled' or l.status not in ('new','clarify','agreed') then raise exception 'Клиент может только отменить заказ до начала работ'; end if;
  elsif p_status not in ('clarify','in_work','done','paid','cancelled') then raise exception 'Неверный статус';
  elsif p_status = 'paid' and l.status not in ('agreed','in_work','done') then raise exception 'Сначала выполните заказ';
  elsif p_status = 'done' and l.status not in ('new','clarify','agreed','in_work') then raise exception 'Нельзя из этого статуса';
  elsif p_status = 'in_work' and l.status not in ('new','clarify','agreed') then raise exception 'Нельзя из этого статуса';
  end if;
  update am_leads set status = p_status, updated_at = now(),
    done_at = case when p_status in ('done','paid') then coalesce(done_at, now()) else done_at end,
    paid_at = case when p_status = 'paid' then now() else paid_at end where id = p_id;
  perform am_order_sys(p_id, case p_status when 'clarify' then 'Исполнитель уточняет детали.' when 'in_work' then 'Заказ в работе.'
    when 'done' then 'Исполнитель отметил: выполнено. Оцените, пожалуйста, работу.' when 'paid' then 'Оплата получена.'
    else case when r = 'client' then 'Клиент отменил заказ.' else 'Исполнитель отменил заказ.' end end);
  if p_status = 'cancelled' then perform am_order_close(p_id, 'Заказ отменён.');
  elsif p_status = 'paid' and l.rating is not null then perform am_order_close(p_id, 'Заказ оплачен и оценён — закрыт.'); end if;
end $$;

-- старый вызов из кабинета (обновление 4) идёт в тот же цикл
create or replace function am_set_lead_status(p_id bigint, p_status text) returns void
language sql security definer set search_path = public as $$ select am_order_set_status(p_id, null, p_status); $$;

create or replace function am_order_rate(p_id bigint, p_token text, p_rating int, p_review text) returns void
language plpgsql security definer set search_path = public as $$
declare r text := am_order_role(p_id, p_token); l am_leads;
begin
  if r <> 'client' then raise exception 'Оценивает клиент'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Оценка от 1 до 5'; end if;
  select * into l from am_leads where id = p_id for update;
  if l.status not in ('done','paid') then raise exception 'Оценить можно после выполнения'; end if;
  if l.rating is not null then raise exception 'Вы уже оценили этот заказ'; end if;
  update am_leads set rating = p_rating, review = left(coalesce(p_review,''), 1000), rated_at = now(), updated_at = now() where id = p_id;
  if l.provider_id is not null then perform am_recalc_rating(l.provider_id); end if;
  perform am_order_sys(p_id, 'Клиент поставил оценку ' || p_rating || '★.');
  if l.status = 'paid' then perform am_order_close(p_id, 'Заказ оплачен и оценён — закрыт.'); end if;
end $$;

-- публичные отзывы по заказам для визитки (только имя, без телефона)
create or replace function am_provider_order_reviews(p_provider int) returns table(rating int, review text, rated_at timestamptz, name text)
language sql stable security definer set search_path = public as $$
  select l.rating, l.review, l.rated_at, split_part(coalesce(nullif(l.customer_name,''), 'Клиент'), ' ', 1)
  from am_leads l join am_providers p on p.id = l.provider_id and p.is_active
  where l.provider_id = p_provider and l.rating is not null order by l.rated_at desc limit 30;
$$;

-- клиент открыл ссылку без секрета (другое устройство, ссылка из WhatsApp от исполнителя):
-- подтверждает свой телефон → получает секрет (null — не совпал). Не больше 5 попыток в час на заказ.
create or replace function am_order_claim(p_id bigint, p_phone text) returns text
language plpgsql security definer set search_path = public as $$
declare l am_leads; d text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
begin
  select * into l from am_leads where id = p_id for update;
  if not found then raise exception 'Заказ не найден'; end if;
  if l.claim_at is not null and l.claim_at > now() - interval '1 hour' and l.claim_tries >= 5 then raise exception 'Слишком много попыток. Попробуйте через час'; end if;
  update am_leads set claim_tries = case when claim_at is null or claim_at < now() - interval '1 hour' then 1 else claim_tries + 1 end,
    claim_at = case when claim_at is null or claim_at < now() - interval '1 hour' then now() else claim_at end where id = p_id;
  if length(d) < 10 or right(regexp_replace(l.customer_phone, '\D', '', 'g'), 10) <> right(d, 10) then return null; end if;  -- без исключения, чтобы счётчик попыток сохранился
  return l.token;
end $$;

-- ---------- закрытие и удаление переписки ----------
create or replace function am_purge_order_chats() returns int
language plpgsql security definer set search_path = public as $$
declare n int; x record;
begin
  for x in select id from am_leads where closed_at is null and status = 'paid' and paid_at < now() - interval '7 days' loop
    perform am_order_close(x.id, 'Заказ оплачен, оценки не было 7 дней — закрыт.'); end loop;
  for x in select id from am_leads where closed_at is null and status = 'done' and done_at < now() - interval '30 days' loop
    perform am_order_close(x.id, 'Заказ выполнен 30 дней назад — закрыт.'); end loop;
  for x in select id from am_leads where closed_at is null and status in ('new','clarify') and created_at < now() - interval '60 days' loop
    perform am_order_close(x.id, 'Заказ без движения 60 дней — закрыт.'); end loop;
  delete from am_order_messages m using am_leads l
   where m.lead_id = l.id and l.closed_at is not null and l.closed_at < now() - interval '3 days';
  get diagnostics n = row_count;
  update am_leads set chat_purged_at = now() where closed_at < now() - interval '3 days' and chat_purged_at is null;
  return n;
end $$;
revoke execute on function am_purge_order_chats() from public, anon, authenticated;

-- ежедневная очистка (если в проекте включено расширение pg_cron: Database → Extensions → pg_cron)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'am-purge-order-chats';
    perform cron.schedule('am-purge-order-chats', '17 3 * * *', 'select public.am_purge_order_chats()');
  end if;
end $$;

grant execute on function am_create_order(jsonb), am_order_get(bigint, text), am_order_messages_list(bigint, text, bigint), am_order_send(bigint, text, jsonb),
  am_order_accept_offer(bigint, text, bigint), am_order_set_status(bigint, text, text), am_order_rate(bigint, text, int, text),
  am_provider_order_reviews(int), am_order_claim(bigint, text) to anon, authenticated;
revoke execute on function am_set_lead_status(bigint, text) from anon;
grant usage, select on all sequences in schema public to authenticated;
