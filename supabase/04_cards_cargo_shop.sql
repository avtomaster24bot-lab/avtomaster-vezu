-- =====================================================================
--  АвтоМастер24 — обновление 4: грузоперевозки, визитки, WhatsApp-заявки (лиды), витрина магазина.
--  ТОЛЬКО ДОБАВЛЯЕТ (колонки/таблицы/функции/политики) и расширяет списки допустимых значений.
--  Данные не удаляются. Повторный запуск безопасен. Применять ПОСЛЕ 01 и 03.
-- =====================================================================

-- ---------- новый тип «cargo» (грузоперевозки) ----------
do $$ declare c record; begin
  for c in select conname, conrelid::regclass::text tbl from pg_constraint
    where contype = 'c' and conrelid in ('am_providers'::regclass, 'am_requests'::regclass, 'am_registrations'::regclass)
      and pg_get_constraintdef(oid) like '%''urgent''%' and pg_get_constraintdef(oid) not like '%''cargo''%' loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'am_providers_kind_check4') then
    alter table am_providers add constraint am_providers_kind_check4 check (kind in ('sto','tow','wash','parts','urgent','cargo')); end if;
  if not exists (select 1 from pg_constraint where conname = 'am_requests_type_check4') then
    alter table am_requests add constraint am_requests_type_check4 check (type in ('sto','tow','wash','parts','urgent','cargo')); end if;
  if not exists (select 1 from pg_constraint where conname = 'am_registrations_kind_check4') then
    alter table am_registrations add constraint am_registrations_kind_check4 check (kind in ('sto','tow','wash','parts','urgent','cargo')); end if;
end $$;

-- ---------- визитка и магазин организации ----------
alter table am_providers add column if not exists card jsonb not null default '{}';          -- слоган, услуги и цены, оплата, соцсети, данные перевозчика, оформление магазина
alter table am_providers add column if not exists store_url text not null default '';        -- внешний магазин (например, сайт «Учёт + Магазин»), только https
alter table am_providers add column if not exists shop_enabled boolean not null default false; -- встроенная витрина shop.html?id=

create or replace function am_providers_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not am_is_admin(old.city) then
    new.owner_id := old.owner_id; new.kind := old.kind; new.rating := old.rating;
    new.reviews_count := old.reviews_count; new.is_active := old.is_active; new.city := old.city;
    new.verified := old.verified;
  end if;
  new.about := left(coalesce(new.about, ''), 2000);
  if cardinality(new.photos) > 12 then new.photos := new.photos[1:12]; end if;
  new.card := coalesce(new.card, '{}');
  if jsonb_typeof(new.card) <> 'object' or length(new.card::text) > 20000 then raise exception 'Слишком большая визитка'; end if;
  new.store_url := left(trim(coalesce(new.store_url, '')), 300);
  if new.store_url <> '' and new.store_url !~ '^https://[^\s<>"]+$' then raise exception 'Ссылка на магазин должна начинаться с https://'; end if;
  return new;
end $$;

-- ---------- заявки в приложении: грузоперевозки живут 2 часа ----------
create or replace function am_create_request(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare me am_profiles; t text := p->>'type'; nid bigint; ttl interval;
begin
  me := am_ensure_profile();
  if not me.consent then raise exception 'Нужно согласие на обработку персональных данных (Профиль)'; end if;
  if coalesce(me.phone,'') = '' then raise exception 'Укажите телефон в профиле — без него исполнитель не сможет связаться'; end if;
  if t not in ('sto','tow','wash','parts','urgent','cargo') then raise exception 'Неизвестный тип заявки'; end if;
  ttl := case t when 'parts' then interval '180 minutes' when 'cargo' then interval '120 minutes' when 'wash' then null else interval '60 minutes' end;
  insert into am_requests(type, user_id, city, category_id, subcategory, service_type, supplier_type, target_provider_id,
    description, vehicle_info, details, desired_time, expires_at)
  values (t, me.id, coalesce(nullif(p->>'city',''), me.city), nullif(p->>'category_id','')::int, p->>'subcategory',
    nullif(p->>'service_type',''), nullif(p->>'supplier_type',''), nullif(p->>'target_provider_id','')::int,
    left(coalesce(p->>'description',''), 2000), left(coalesce(p->>'vehicle_info',''), 300), coalesce(p->'details','{}'),
    nullif(p->>'desired_time','')::timestamptz, now() + ttl)
  returning id into nid;
  return nid;
end $$;

-- ---------- визитка без модерации: владелец = вошедший через Telegram ----------
-- Админ города может отключить (is_active) или поставить «Проверен» (verified).
create or replace function am_create_card(p jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare me am_profiles := am_ensure_profile(); k text := p->>'kind'; nid int;
begin
  if coalesce(trim(p->>'name'),'') = '' or coalesce(trim(coalesce(nullif(p->>'phone',''), p->>'whatsapp')),'') = '' or coalesce(p->>'city','') = '' then
    raise exception 'Заполните название, телефон и город'; end if;
  if k not in ('sto','tow','wash','parts','urgent','cargo') then raise exception 'Неизвестный тип'; end if;
  if not exists (select 1 from am_cities where name = p->>'city' and active) then raise exception 'Город пока не подключён'; end if;
  if (select count(*) from am_providers where owner_id = me.id) >= 10 then raise exception 'Не больше 10 визиток на одного владельца'; end if;
  if (select count(*) from am_providers where owner_id = me.id and created_at > now() - interval '1 hour') >= 5 then raise exception 'Слишком часто. Попробуйте через час'; end if;
  insert into am_providers(kind, owner_id, name, city, address, phone, whatsapp, working_hours, specs, supplier_type, service_type,
    boxes, slot_minutes, delivery, about, card, shop_enabled)
  values (k, me.id, left(trim(p->>'name'),120), p->>'city', left(coalesce(p->>'address',''),200), left(coalesce(p->>'phone',''),30),
    left(coalesce(nullif(p->>'whatsapp',''), p->>'phone', ''),30), left(coalesce(p->>'working_hours',''),120),
    coalesce((select array_agg(x::int) from jsonb_array_elements_text(case when jsonb_typeof(p->'specs') = 'array' then p->'specs' else '[]' end) x where x ~ '^\d{1,6}$'), '{}'),
    case when k = 'parts' then nullif(p->>'supplier_type','') end, case when k = 'urgent' then nullif(p->>'service_type','') end,
    greatest(1, least(50, coalesce(nullif(p->>'boxes','')::int, 1))), greatest(15, least(480, coalesce(nullif(p->>'slot_minutes','')::int, 60))),
    coalesce((p->>'delivery')::boolean, false), left(coalesce(p->>'about',''),2000),
    case when jsonb_typeof(p->'card') = 'object' then p->'card' else '{}' end, k = 'parts')
  returning id into nid;
  return nid;
end $$;

-- ---------- лиды: всё, что ушло владельцу в WhatsApp (визитка, витрина, гостевая заявка) ----------
create table if not exists am_leads (
  id bigserial primary key,
  provider_id int references am_providers(id) on delete cascade,   -- null = диспетчеру сервиса
  kind text not null default 'request' check (kind in ('request','order','callback')),
  source text not null default 'card' check (source in ('card','shop','site','app')),
  user_id uuid references am_profiles(id) on delete set null,
  customer_name text not null default '', customer_phone text not null default '',
  message text not null check (char_length(message) between 1 and 4000),
  payload jsonb not null default '{}', total int,
  status text not null default 'new' check (status in ('new','in_work','done','cancelled')),
  ip_hash text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists am_leads_provider on am_leads(provider_id, created_at desc);
alter table am_leads enable row level security;
drop policy if exists "owner or admin read" on am_leads;
create policy "owner or admin read" on am_leads for select to authenticated
  using ((provider_id is not null and am_owns(provider_id)) or user_id = auth.uid()
         or am_is_admin(case when provider_id is null then null else (select city from am_providers where id = provider_id) end));
-- прямой insert/update/delete запрещён: только через функции ниже
revoke all on am_leads from anon;
revoke insert, update, delete on am_leads from authenticated;

create or replace function am_create_lead(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare pid int := nullif(p->>'provider_id','')::int; nid bigint; h text; ph text := regexp_replace(coalesce(p->>'customer_phone',''), '\D', '', 'g');
begin
  if coalesce(trim(p->>'message'),'') = '' then raise exception 'Пустая заявка'; end if;
  if pid is not null and not exists (select 1 from am_providers where id = pid and is_active) then raise exception 'Исполнитель не найден'; end if;
  h := md5(coalesce(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', '') || coalesce(auth.uid()::text, ''));
  if (select count(*) from am_leads where ip_hash = h and created_at > now() - interval '10 minutes') >= 10 then raise exception 'Слишком много заявок. Попробуйте позже'; end if;
  if ph <> '' and (select count(*) from am_leads where regexp_replace(customer_phone, '\D', '', 'g') = ph and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Слишком много заявок с этого номера'; end if;
  insert into am_leads(provider_id, kind, source, user_id, customer_name, customer_phone, message, payload, total, ip_hash)
  values (pid, coalesce(nullif(p->>'kind',''), 'request'), coalesce(nullif(p->>'source',''), 'card'), auth.uid(),
    left(coalesce(p->>'customer_name',''),120), left(coalesce(p->>'customer_phone',''),30), left(p->>'message',4000),
    case when jsonb_typeof(p->'payload') = 'object' and length((p->'payload')::text) < 20000 then p->'payload' else '{}' end,
    nullif(p->>'total','')::numeric::int, h)
  returning id into nid;
  return nid;
end $$;

create or replace function am_set_lead_status(p_id bigint, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare l am_leads;
begin
  select * into l from am_leads where id = p_id for update;
  if not found then raise exception 'Заявка не найдена'; end if;
  if not ((l.provider_id is not null and am_owns(l.provider_id))
          or am_is_admin(case when l.provider_id is null then null else (select city from am_providers where id = l.provider_id) end)) then
    raise exception 'Нет прав'; end if;
  if p_status not in ('new','in_work','done','cancelled') then raise exception 'Неверный статус'; end if;
  update am_leads set status = p_status, updated_at = now() where id = p_id;
end $$;

-- ---------- витрина магазина ----------
create table if not exists am_products (
  id bigserial primary key,
  provider_id int not null references am_providers(id) on delete cascade,
  sku text not null default '', name text not null check (char_length(name) between 1 and 200),
  category text not null default '', price int not null check (price >= 0), stock int check (stock is null or stock >= 0),
  photo text not null default '', description text not null default '' check (char_length(description) <= 3000),
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists am_products_provider on am_products(provider_id, is_published);
create or replace function am_products_sku() returns trigger language plpgsql as $$
begin
  if coalesce(new.sku, '') = '' then new.sku := 'SKU-' || lpad(new.id::text, 6, '0'); end if;
  return new;
end $$;
drop trigger if exists am_products_sku on am_products;
create trigger am_products_sku before insert on am_products for each row execute function am_products_sku();
alter table am_products enable row level security;
drop policy if exists "public published" on am_products;
create policy "public published" on am_products for select
  using ((is_published and exists (select 1 from am_providers p where p.id = provider_id and p.is_active and p.shop_enabled)) or am_owns(provider_id) or am_is_admin());
drop policy if exists "owner insert" on am_products;
create policy "owner insert" on am_products for insert to authenticated with check (am_owns(provider_id));
drop policy if exists "owner update" on am_products;
create policy "owner update" on am_products for update to authenticated using (am_owns(provider_id) or am_is_admin()) with check (am_owns(provider_id) or am_is_admin());
drop policy if exists "owner delete" on am_products;
create policy "owner delete" on am_products for delete to authenticated using (am_owns(provider_id) or am_is_admin());
create or replace function am_products_limit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from am_products where provider_id = new.provider_id) >= 2000 then raise exception 'Не больше 2000 товаров на витрине'; end if;
  return new;
end $$;
drop trigger if exists am_products_limit on am_products;
create trigger am_products_limit before insert on am_products for each row execute function am_products_limit();

-- фото товаров: am-public/shop/<provider_id>/<файл> — загружает владелец организации
create or replace function am_can_edit_prov_photo(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when split_part(p_name, '/', 1) in ('prov','shop') and split_part(p_name, '/', 2) ~ '^\d{1,9}$'
    then am_owns(split_part(p_name, '/', 2)::int) or am_is_admin() else false end;
$$;

grant select on am_leads to authenticated;
revoke insert, update, delete on am_products from anon;
grant select on am_products to anon, authenticated;
grant insert, update, delete on am_products to authenticated;
grant execute on function am_create_lead(jsonb) to anon, authenticated;
grant execute on function am_create_card(jsonb), am_set_lead_status(bigint, text) to authenticated;
revoke execute on function am_create_card(jsonb), am_set_lead_status(bigint, text) from anon;
grant usage, select on all sequences in schema public to authenticated;
