-- =====================================================================
--  АвтоМастер24 — веб-версия. Схема базы для Supabase (PostgreSQL).
--  Вставить в Supabase → SQL Editor и нажать Run. Повторный запуск безопасен.
--  Все таблицы с префиксом am_, чтобы не мешать другим проектам в той же базе.
--  RLS включён везде. Все изменения статусов — только через функции (RPC).
-- =====================================================================

-- ---------- справочники ----------
create table if not exists am_cities (id serial primary key, name text not null unique, region text default '', active boolean not null default true);
create table if not exists am_categories (id serial primary key, name text not null);
create table if not exists am_subcategories (id serial primary key, name text not null, category_id int references am_categories(id) on delete cascade);
create table if not exists am_price_services (id serial primary key, name text not null, category text);
create table if not exists am_brands (id serial primary key, name text not null unique);
create table if not exists am_models (id serial primary key, brand_id int references am_brands(id) on delete cascade, name text not null);

-- ---------- люди ----------
create table if not exists am_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tg_id bigint, username text, full_name text, phone text, city text,
  role text not null default 'client' check (role in ('client','regional_admin','global_admin')),
  managed_city text, consent boolean not null default false, consent_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- исполнители (СТО, эвакуаторы, мойки, запчасти, выездные мастера) ----------
create table if not exists am_providers (
  id serial primary key,
  kind text not null check (kind in ('sto','tow','wash','parts','urgent')),
  owner_id uuid references am_profiles(id) on delete set null,
  name text not null, city text not null, address text default '', phone text default '', working_hours text default '',
  specs int[] not null default '{}',                     -- СТО: id категорий am_categories
  supplier_type text check (supplier_type in ('shop','razborka')),       -- запчасти
  service_type text check (service_type in ('locksmith','tire','electrician','mechanic','delivery')), -- выездные
  boxes int not null default 1, slot_minutes int not null default 60,  -- мойка
  delivery boolean not null default false,
  rating numeric(3,2) not null default 0, reviews_count int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists am_providers_city_kind on am_providers(city, kind);

-- ---------- заявки ----------
create table if not exists am_requests (
  id bigserial primary key,
  type text not null check (type in ('sto','tow','wash','parts','urgent')),
  user_id uuid not null references am_profiles(id) on delete cascade,
  city text not null,
  status text not null default 'new',
  category_id int, subcategory text, service_type text, supplier_type text,
  target_provider_id int references am_providers(id) on delete set null,
  description text default '', vehicle_info text default '', details jsonb not null default '{}',
  desired_time timestamptz, assigned_time timestamptz, price int,
  accepted_by int references am_providers(id) on delete set null,
  accepted_offer_id bigint, final_amount int,
  expires_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists am_requests_city_type on am_requests(city, type, status);
create index if not exists am_requests_user on am_requests(user_id);

create table if not exists am_declines (request_id bigint references am_requests(id) on delete cascade,
  provider_id int references am_providers(id) on delete cascade, primary key (request_id, provider_id));

create table if not exists am_offers (
  id bigserial primary key, request_id bigint not null references am_requests(id) on delete cascade,
  provider_id int not null references am_providers(id) on delete cascade,
  price int not null check (price > 0), comment text default '', is_selected boolean not null default false,
  created_at timestamptz not null default now(), unique (request_id, provider_id)
);

create table if not exists am_reviews (
  id bigserial primary key, user_id uuid references am_profiles(id) on delete set null,
  provider_id int not null references am_providers(id) on delete cascade,
  request_id bigint references am_requests(id) on delete set null,
  rating int not null check (rating between 1 and 5), comment text default '',
  is_published boolean not null default false, created_at timestamptz not null default now(),
  unique (request_id)
);

create table if not exists am_vehicles (
  id bigserial primary key, user_id uuid not null default auth.uid() references am_profiles(id) on delete cascade,
  brand text not null, model text default '', year int, plate text default '', engine_volume text default '',
  created_at timestamptz not null default now()
);

create table if not exists am_prices (
  id bigserial primary key, provider_id int references am_providers(id) on delete cascade, -- null = справочная цена
  service text not null, brand text default '', model text default '',
  year_from int, year_to int, engine_volume numeric, price int not null check (price > 0), notes text default '',
  updated_at timestamptz not null default now()
);

create table if not exists am_registrations (
  id bigserial primary key, user_id uuid not null references am_profiles(id) on delete cascade,
  kind text not null check (kind in ('sto','tow','wash','parts','urgent')),
  name text not null, phone text not null, address text default '', city text not null,
  details jsonb not null default '{}', status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reason text, provider_id int, created_at timestamptz not null default now(), reviewed_at timestamptz
);

-- ---------- вспомогательные функции ----------
create or replace function am_is_admin(p_city text default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from am_profiles where id = auth.uid()
    and (role = 'global_admin' or (role = 'regional_admin' and (p_city is null or managed_city = p_city))));
$$;
create or replace function am_owns(p_provider int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from am_providers where id = p_provider and owner_id = auth.uid());
$$;
-- может ли исполнитель (владелец p) видеть новую заявку r
create or replace function am_matches(r am_requests, p am_providers) returns boolean
language sql stable as $$
  select p.is_active and p.kind = r.type and p.city = r.city
    and (r.target_provider_id is null or r.target_provider_id = p.id)
    and (r.type <> 'urgent' or r.service_type is null or r.service_type = p.service_type)
    and (r.type <> 'parts' or r.supplier_type is null or r.supplier_type = p.supplier_type)
    and (r.type <> 'sto' or r.category_id is null or cardinality(p.specs) = 0 or r.category_id = any(p.specs) or r.target_provider_id = p.id);
$$;
create or replace function am_can_see_request(p_id bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from am_requests r where r.id = p_id and (
    r.user_id = auth.uid() or am_is_admin(r.city)
    or exists (select 1 from am_providers p where p.owner_id = auth.uid() and p.id in (r.accepted_by, r.target_provider_id))
    or (r.status in ('new','offers') and (r.expires_at is null or r.expires_at > now())
        and exists (select 1 from am_providers p where p.owner_id = auth.uid() and am_matches(r, p)
                    and not exists (select 1 from am_declines d where d.request_id = r.id and d.provider_id = p.id)))));
$$;

-- ---------- RLS ----------
do $$ declare t text; begin
  foreach t in array array['am_cities','am_categories','am_subcategories','am_price_services','am_brands','am_models',
    'am_profiles','am_providers','am_requests','am_declines','am_offers','am_reviews','am_vehicles','am_prices','am_registrations'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
  foreach t in array array['am_cities','am_categories','am_subcategories','am_price_services','am_brands','am_models'] loop
    execute format('drop policy if exists "read" on %I', t);
    execute format('create policy "read" on %I for select using (true)', t);
    execute format('drop policy if exists "admin write" on %I', t);
    execute format('create policy "admin write" on %I for all to authenticated using (am_is_admin()) with check (am_is_admin())', t);
  end loop;
end $$;

drop policy if exists "own or admin" on am_profiles;
create policy "own or admin" on am_profiles for select to authenticated using (id = auth.uid() or am_is_admin(city));

drop policy if exists "public active" on am_providers;
create policy "public active" on am_providers for select using (is_active or owner_id = auth.uid() or am_is_admin(city));
drop policy if exists "owner update" on am_providers;
create policy "owner update" on am_providers for update to authenticated using (owner_id = auth.uid() or am_is_admin(city)) with check (owner_id = auth.uid() or am_is_admin(city));
drop policy if exists "admin insert" on am_providers;
create policy "admin insert" on am_providers for insert to authenticated with check (am_is_admin(city));
drop policy if exists "admin delete" on am_providers;
create policy "admin delete" on am_providers for delete to authenticated using (am_is_admin(city));

create or replace function am_providers_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not am_is_admin(old.city) then
    new.owner_id := old.owner_id; new.kind := old.kind; new.rating := old.rating;
    new.reviews_count := old.reviews_count; new.is_active := old.is_active; new.city := old.city;
  end if;
  return new;
end $$;
drop trigger if exists am_providers_guard on am_providers;
create trigger am_providers_guard before update on am_providers for each row execute function am_providers_guard();

drop policy if exists "visible" on am_requests;
create policy "visible" on am_requests for select to authenticated using (am_can_see_request(id));

drop policy if exists "own provider" on am_declines;
create policy "own provider" on am_declines for select to authenticated using (am_owns(provider_id));

drop policy if exists "provider or admin" on am_offers;
create policy "provider or admin" on am_offers for select to authenticated using (am_owns(provider_id) or am_is_admin());

drop policy if exists "published or own" on am_reviews;
create policy "published or own" on am_reviews for select using (is_published or user_id = auth.uid() or am_is_admin());

drop policy if exists "own" on am_vehicles;
create policy "own" on am_vehicles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read" on am_prices;
create policy "read" on am_prices for select using (true);
drop policy if exists "owner write" on am_prices;
create policy "owner write" on am_prices for all to authenticated
  using ((provider_id is not null and am_owns(provider_id)) or am_is_admin())
  with check ((provider_id is not null and am_owns(provider_id)) or am_is_admin());

drop policy if exists "own or admin" on am_registrations;
create policy "own or admin" on am_registrations for select to authenticated using (user_id = auth.uid() or am_is_admin(city));

-- anon видит только справочники, исполнителей, цены и опубликованные отзывы
revoke all on am_profiles, am_requests, am_declines, am_offers, am_vehicles, am_registrations from anon;
revoke insert, update, delete on am_requests, am_declines, am_offers, am_reviews, am_registrations, am_profiles from authenticated;

-- ---------- профиль ----------
create or replace function am_ensure_profile() returns am_profiles
language plpgsql security definer set search_path = public as $$
declare me am_profiles; meta jsonb;
begin
  if auth.uid() is null then raise exception 'Войдите через Telegram'; end if;
  select * into me from am_profiles where id = auth.uid();
  if found then return me; end if;
  select raw_user_meta_data into meta from auth.users where id = auth.uid();
  insert into am_profiles(id, tg_id, username, full_name)
  values (auth.uid(), nullif(meta->>'tg_id','')::bigint, meta->>'username', coalesce(meta->>'first_name','Пользователь'))
  returning * into me;
  return me;
end $$;

create or replace function am_update_profile(p_full_name text, p_phone text, p_city text, p_consent boolean) returns am_profiles
language plpgsql security definer set search_path = public as $$
declare me am_profiles;
begin
  perform am_ensure_profile();
  if p_phone is not null and p_phone <> '' and regexp_replace(p_phone, '\D', '', 'g') !~ '^[78]\d{10}$' then
    raise exception 'Телефон в формате +7 7XX XXX XX XX';
  end if;
  update am_profiles set full_name = coalesce(nullif(trim(p_full_name),''), full_name),
    phone = nullif(regexp_replace(coalesce(p_phone,''), '[^\d+]', '', 'g'), ''), city = p_city,
    consent = p_consent, consent_at = case when p_consent and not consent then now() else consent_at end
  where id = auth.uid() returning * into me;
  return me;
end $$;

create or replace function am_delete_my_data() returns void
language sql security definer set search_path = public as $$
  update am_profiles set phone = null, consent = false where id = auth.uid();
$$;

-- ---------- заявки клиента ----------
create or replace function am_create_request(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare me am_profiles; t text := p->>'type'; nid bigint; ttl interval;
begin
  me := am_ensure_profile();
  if not me.consent then raise exception 'Нужно согласие на обработку персональных данных (Профиль)'; end if;
  if coalesce(me.phone,'') = '' then raise exception 'Укажите телефон в профиле — без него исполнитель не сможет связаться'; end if;
  if t not in ('sto','tow','wash','parts','urgent') then raise exception 'Неизвестный тип заявки'; end if;
  ttl := case t when 'parts' then interval '180 minutes' when 'wash' then null else interval '60 minutes' end;
  insert into am_requests(type, user_id, city, category_id, subcategory, service_type, supplier_type, target_provider_id,
    description, vehicle_info, details, desired_time, expires_at)
  values (t, me.id, coalesce(nullif(p->>'city',''), me.city), nullif(p->>'category_id','')::int, p->>'subcategory',
    nullif(p->>'service_type',''), nullif(p->>'supplier_type',''), nullif(p->>'target_provider_id','')::int,
    left(coalesce(p->>'description',''), 2000), left(coalesce(p->>'vehicle_info',''), 300), coalesce(p->'details','{}'),
    nullif(p->>'desired_time','')::timestamptz, now() + ttl)
  returning id into nid;
  return nid;
end $$;

create or replace function am_my_request(p_id bigint) returns am_requests
language plpgsql security definer set search_path = public as $$
declare r am_requests;
begin
  select * into r from am_requests where id = p_id for update;
  if not found or r.user_id <> auth.uid() then raise exception 'Заявка не найдена'; end if;
  return r;
end $$;

create or replace function am_cancel_request(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r am_requests := am_my_request(p_id);
begin
  if r.status in ('completed','cancelled') then raise exception 'Заявку уже нельзя отменить'; end if;
  update am_requests set status = 'cancelled', updated_at = now() where id = p_id;
end $$;

create or replace function am_request_offers(p_id bigint) returns table(id bigint, price int, comment text, is_selected boolean,
  created_at timestamptz, provider_id int, provider_name text, provider_phone text, provider_address text, provider_rating numeric, delivery boolean)
language plpgsql security definer set search_path = public as $$
declare r am_requests := am_my_request(p_id);
begin
  -- до выбора предложения поставщик анонимен (как в боте)
  return query select o.id, o.price, o.comment, o.is_selected, o.created_at,
    case when o.is_selected then p.id end, case when o.is_selected then p.name else 'Поставщик №' || o.provider_id end,
    case when o.is_selected then p.phone end, case when o.is_selected then p.address end, p.rating, p.delivery
  from am_offers o join am_providers p on p.id = o.provider_id where o.request_id = r.id order by o.price;
end $$;

create or replace function am_select_offer(p_offer bigint) returns void
language plpgsql security definer set search_path = public as $$
declare o am_offers; r am_requests;
begin
  select * into o from am_offers where id = p_offer;
  if not found then raise exception 'Предложение не найдено'; end if;
  r := am_my_request(o.request_id);
  if r.status not in ('new','offers') then raise exception 'Предложение уже выбрано'; end if;
  update am_offers set is_selected = (id = p_offer) where request_id = r.id;
  update am_requests set status = 'active', accepted_by = o.provider_id, accepted_offer_id = o.id, final_amount = o.price, updated_at = now() where id = r.id;
end $$;

create or replace function am_wash_approve(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r am_requests := am_my_request(p_id);
begin
  if r.status <> 'price_offered' then raise exception 'Мойка ещё не предложила цену и время'; end if;
  update am_requests set status = 'client_approved', final_amount = price, updated_at = now() where id = p_id;
end $$;

create or replace function am_client_confirm(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r am_requests := am_my_request(p_id);
begin
  if r.status not in ('active','delivered','waiting_client','in_progress') then raise exception 'Нельзя завершить заявку в этом статусе'; end if;
  update am_requests set status = 'completed', updated_at = now() where id = p_id;
end $$;

create or replace function am_recalc_rating(p_provider int) returns void
language sql security definer set search_path = public as $$
  update am_providers set rating = coalesce((select round(avg(rating)::numeric, 2) from am_reviews where provider_id = p_provider), 0),
    reviews_count = (select count(*) from am_reviews where provider_id = p_provider) where id = p_provider;
$$;

create or replace function am_leave_review(p_id bigint, p_rating int, p_comment text) returns void
language plpgsql security definer set search_path = public as $$
declare r am_requests := am_my_request(p_id);
begin
  if r.status <> 'completed' or r.accepted_by is null then raise exception 'Оценить можно только выполненную заявку'; end if;
  insert into am_reviews(user_id, provider_id, request_id, rating, comment, is_published)
  values (auth.uid(), r.accepted_by, r.id, p_rating, left(coalesce(p_comment,''), 1000), coalesce(trim(p_comment),'') = '')
  on conflict (request_id) do nothing;
  perform am_recalc_rating(r.accepted_by);
end $$;

-- ---------- исполнитель ----------
create or replace function am_my_provider(p_provider int) returns am_providers
language plpgsql security definer set search_path = public as $$
declare p am_providers;
begin
  select * into p from am_providers where id = p_provider and owner_id = auth.uid();
  if not found then raise exception 'Это не ваша организация'; end if;
  if not p.is_active then raise exception 'Организация отключена администратором'; end if;
  return p;
end $$;

create or replace function am_provider_feed(p_provider int) returns setof am_requests
language plpgsql security definer set search_path = public as $$
declare p am_providers := am_my_provider(p_provider);
begin
  return query select r.* from am_requests r
  where r.accepted_by = p.id or r.target_provider_id = p.id
     or (r.status in ('new','offers') and (r.expires_at is null or r.expires_at > now()) and am_matches(r, p)
         and not exists (select 1 from am_declines d where d.request_id = r.id and d.provider_id = p.id))
  order by r.created_at desc limit 200;
end $$;

create or replace function am_accept_request(p_id bigint, p_provider int) returns void
language plpgsql security definer set search_path = public as $$
declare p am_providers := am_my_provider(p_provider); r am_requests;
begin
  select * into r from am_requests where id = p_id for update;
  if not found or not am_matches(r, p) then raise exception 'Заявка недоступна'; end if;
  if r.type in ('parts','wash') then raise exception 'Для этой заявки отправьте предложение'; end if;
  if r.status <> 'new' then raise exception 'Заявку уже принял другой исполнитель'; end if;
  if r.expires_at is not null and r.expires_at < now() then raise exception 'Срок заявки истёк'; end if;
  update am_requests set status = 'active', accepted_by = p.id, updated_at = now() where id = p_id;
end $$;

create or replace function am_decline_request(p_id bigint, p_provider int) returns void
language plpgsql security definer set search_path = public as $$
declare p am_providers := am_my_provider(p_provider);
begin
  insert into am_declines values (p_id, p.id) on conflict do nothing;
end $$;

create or replace function am_complete_request(p_id bigint, p_provider int, p_amount int) returns void
language plpgsql security definer set search_path = public as $$
declare p am_providers := am_my_provider(p_provider); r am_requests;
begin
  select * into r from am_requests where id = p_id for update;
  if not found or r.accepted_by is distinct from p.id then raise exception 'Заявка не ваша'; end if;
  if r.type = 'parts' then
    if r.status <> 'active' then raise exception 'Неверный статус'; end if;
    update am_requests set status = 'delivered', updated_at = now() where id = p_id;   -- клиент подтвердит получение
  else
    if r.status not in ('active','in_progress','waiting_client','client_approved') then raise exception 'Неверный статус'; end if;
    update am_requests set status = 'completed', final_amount = coalesce(p_amount, final_amount), updated_at = now() where id = p_id;
  end if;
end $$;

create or replace function am_make_offer(p_id bigint, p_provider int, p_price int, p_comment text) returns void
language plpgsql security definer set search_path = public as $$
declare p am_providers := am_my_provider(p_provider); r am_requests;
begin
  select * into r from am_requests where id = p_id for update;
  if not found or r.type <> 'parts' or not am_matches(r, p) then raise exception 'Заявка недоступна'; end if;
  if r.status not in ('new','offers') or (r.expires_at is not null and r.expires_at < now()) then raise exception 'Заявка уже закрыта'; end if;
  if coalesce(p_price,0) <= 0 then raise exception 'Укажите цену'; end if;
  insert into am_offers(request_id, provider_id, price, comment) values (p_id, p.id, p_price, left(coalesce(p_comment,''),500))
  on conflict (request_id, provider_id) do update set price = excluded.price, comment = excluded.comment, created_at = now();
  update am_requests set status = 'offers', updated_at = now() where id = p_id and status = 'new';
end $$;

create or replace function am_wash_quote(p_id bigint, p_provider int, p_price int, p_time timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare p am_providers := am_my_provider(p_provider); r am_requests;
begin
  select * into r from am_requests where id = p_id for update;
  if not found or r.type <> 'wash' or not (am_matches(r, p) or r.accepted_by = p.id) then raise exception 'Заявка недоступна'; end if;
  if r.status not in ('new','price_offered') then raise exception 'Запись уже подтверждена'; end if;
  if r.accepted_by is not null and r.accepted_by <> p.id then raise exception 'Запись уже взяла другая мойка'; end if;
  if coalesce(p_price,0) <= 0 or p_time is null then raise exception 'Укажите цену и время'; end if;
  update am_requests set status = 'price_offered', accepted_by = p.id, price = p_price, assigned_time = p_time, updated_at = now() where id = p_id;
end $$;

create or replace function am_wash_status(p_id bigint, p_provider int, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare p am_providers := am_my_provider(p_provider); r am_requests;
begin
  select * into r from am_requests where id = p_id for update;
  if not found or r.accepted_by is distinct from p.id or r.type <> 'wash' then raise exception 'Заявка не ваша'; end if;
  if not ((r.status = 'client_approved' and p_status = 'in_progress') or (r.status = 'in_progress' and p_status = 'waiting_client')
       or (r.status in ('waiting_client','in_progress') and p_status = 'completed')) then raise exception 'Неверный переход статуса'; end if;
  update am_requests set status = p_status, updated_at = now() where id = p_id;
end $$;

-- контакт клиента — только исполнителю, который принял заявку
create or replace function am_client_contact(p_id bigint) returns table(full_name text, phone text, username text)
language plpgsql security definer set search_path = public as $$
declare r am_requests;
begin
  select * into r from am_requests where id = p_id;
  if not found or not (am_owns(r.accepted_by) or am_is_admin(r.city)) then raise exception 'Контакт доступен после принятия заявки'; end if;
  if r.type = 'wash' and r.status in ('new','price_offered') and not am_is_admin(r.city) then raise exception 'Контакт доступен после подтверждения клиентом'; end if;
  return query select pr.full_name, pr.phone, pr.username from am_profiles pr where pr.id = r.user_id;
end $$;

-- ---------- регистрация бизнеса и админка ----------
create or replace function am_register_business(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare me am_profiles := am_ensure_profile(); nid bigint;
begin
  if coalesce(trim(p->>'name'),'') = '' or coalesce(trim(p->>'phone'),'') = '' or coalesce(p->>'city','') = '' then
    raise exception 'Заполните название, телефон и город'; end if;
  if (select count(*) from am_registrations where user_id = me.id and status = 'pending') >= 3 then raise exception 'У вас уже есть заявки на рассмотрении'; end if;
  insert into am_registrations(user_id, kind, name, phone, address, city, details)
  values (me.id, p->>'kind', left(p->>'name',120), left(p->>'phone',30), left(coalesce(p->>'address',''),200), p->>'city', coalesce(p->'details','{}'))
  returning id into nid;
  return nid;
end $$;

create or replace function am_review_registration(p_id bigint, p_approve boolean, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare g am_registrations; pid int;
begin
  select * into g from am_registrations where id = p_id for update;
  if not found or not am_is_admin(g.city) then raise exception 'Нет прав'; end if;
  if g.status <> 'pending' then raise exception 'Заявка уже рассмотрена'; end if;
  if p_approve then
    insert into am_providers(kind, owner_id, name, city, address, phone, working_hours, specs, supplier_type, service_type, boxes, slot_minutes, delivery)
    values (g.kind, g.user_id, g.name, g.city, g.address, g.phone, coalesce(g.details->>'working_hours',''),
      coalesce((select array_agg(x::int) from jsonb_array_elements_text(coalesce(g.details->'specs','[]')) x), '{}'),
      nullif(g.details->>'supplier_type',''), nullif(g.details->>'service_type',''),
      coalesce(nullif(g.details->>'boxes','')::int, 1), coalesce(nullif(g.details->>'slot_minutes','')::int, 60),
      coalesce((g.details->>'delivery')::boolean, false))
    returning id into pid;
  end if;
  update am_registrations set status = case when p_approve then 'approved' else 'rejected' end, reason = p_reason,
    provider_id = pid, reviewed_at = now() where id = p_id;
end $$;

create or replace function am_moderate_review(p_id bigint, p_publish boolean) returns void
language plpgsql security definer set search_path = public as $$
declare rv am_reviews;
begin
  if not am_is_admin() then raise exception 'Нет прав'; end if;
  select * into rv from am_reviews where id = p_id;
  if p_publish then update am_reviews set is_published = true where id = p_id;
  else delete from am_reviews where id = p_id; perform am_recalc_rating(rv.provider_id); end if;
end $$;

create or replace function am_admin_requests() returns setof am_requests
language plpgsql security definer set search_path = public as $$
begin
  if not am_is_admin() then raise exception 'Нет прав'; end if;
  return query select r.* from am_requests r where am_is_admin(r.city) order by r.created_at desc limit 500;
end $$;

create or replace function am_admin_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not am_is_admin() then raise exception 'Нет прав'; end if;
  return jsonb_build_object(
    'users', (select count(*) from am_profiles),
    'providers', (select count(*) from am_providers where am_is_admin(city)),
    'requests', (select count(*) from am_requests where am_is_admin(city)),
    'completed', (select count(*) from am_requests where am_is_admin(city) and status = 'completed'),
    'active', (select count(*) from am_requests where am_is_admin(city) and status in ('new','offers','active','price_offered','client_approved','in_progress','waiting_client','delivered')),
    'pending_regs', (select count(*) from am_registrations where am_is_admin(city) and status = 'pending'),
    'pending_reviews', (select count(*) from am_reviews where not is_published),
    'turnover', (select coalesce(sum(final_amount),0) from am_requests where am_is_admin(city) and status = 'completed'));
end $$;

-- назначить администратора (запускать вручную в SQL Editor): select am_make_admin('username_в_telegram');
create or replace function am_make_admin(p_username text, p_city text default null) returns text
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is not null and not am_is_admin() then raise exception 'Нет прав'; end if;
  update am_profiles set role = case when p_city is null then 'global_admin' else 'regional_admin' end, managed_city = p_city
  where lower(username) = lower(trim(leading '@' from p_username));
  get diagnostics n = row_count;
  return case when n = 0 then 'Пользователь не найден: сначала войдите на сайт через Telegram' else 'Готово' end;
end $$;
revoke execute on function am_make_admin(text, text) from anon;

grant select on am_cities, am_categories, am_subcategories, am_price_services, am_brands, am_models, am_providers, am_prices, am_reviews to anon, authenticated;
grant select, insert, update, delete on am_vehicles, am_prices, am_providers to authenticated;
grant select on am_profiles, am_requests, am_declines, am_offers, am_registrations to authenticated;
grant insert, update, delete on am_cities, am_categories, am_subcategories, am_price_services, am_brands, am_models to authenticated;
grant usage, select on all sequences in schema public to authenticated;
