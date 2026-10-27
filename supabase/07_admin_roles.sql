-- АвтоМастер24 + ВЕЗУ — Обновление 7: админы города и права (перенос из avtomaster24-web 08_admin.sql, только объекты am_*).
--   * главный админ (global_admin): все города; назначает и снимает админов (в т.ч. региональных — «админов города»);
--     общие настройки; пользователи всех городов; журнал;
--   * региональный админ (regional_admin, managed_city): то же в пределах своего города, без назначения админов;
--   * блокировка пользователя: не создаёт заявки, отзывы, сообщения и заявки на бизнес;
--   * журнал действий администраторов (am_admin_log), объявление для города (настройка city_notice).
-- Повторный запуск безопасен. Применять после 01–06. vz_* не трогает.

create or replace function am_is_global_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from am_profiles where id = (select auth.uid()) and role = 'global_admin');
$$;

alter table am_profiles add column if not exists blocked_at timestamptz;
alter table am_profiles add column if not exists blocked_reason text;

-- ---------------- журнал
create table if not exists am_admin_log (
  id bigserial primary key,
  actor_id uuid references am_profiles(id) on delete set null,
  action text not null,
  target_user uuid references am_profiles(id) on delete set null,
  city text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists am_admin_log_created_idx on am_admin_log(created_at desc);
create index if not exists am_admin_log_actor_idx on am_admin_log(actor_id);
create index if not exists am_admin_log_target_idx on am_admin_log(target_user);
alter table am_admin_log enable row level security;
drop policy if exists "admins" on am_admin_log;
create policy "admins" on am_admin_log for select to authenticated using (am_is_global_admin() or (city is not null and am_is_admin(city)));
revoke all on am_admin_log from anon;
revoke insert, update, delete on am_admin_log from authenticated;
grant select on am_admin_log to authenticated;

create or replace function am_log(p_action text, p_target uuid, p_city text, p_details jsonb default '{}') returns void
language sql security definer set search_path = public as $$
  insert into am_admin_log(actor_id, action, target_user, city, details) values (auth.uid(), p_action, p_target, p_city, coalesce(p_details, '{}'));
$$;

-- ---------------- настройки (пока одна: объявление для города; общие — '' )
create table if not exists am_settings (
  key text not null, city text not null default '', value jsonb not null,
  updated_by uuid references am_profiles(id) on delete set null, updated_at timestamptz not null default now(),
  primary key (key, city)
);
create index if not exists am_settings_updated_by_idx on am_settings(updated_by);
alter table am_settings enable row level security;
drop policy if exists "read" on am_settings;
create policy "read" on am_settings for select using (true);
revoke insert, update, delete on am_settings from anon, authenticated;
grant select on am_settings to anon, authenticated;

create or replace function am_setting_spec(p_key text) returns jsonb language sql immutable set search_path = public as $$
  select case p_key when 'city_notice' then '{"text":true,"city":true}' end::jsonb $$;

create or replace function am_set_setting(p_key text, p_city text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare sp jsonb := am_setting_spec(p_key); c text := coalesce(p_city, '');
begin
  if sp is null then raise exception 'Неизвестная настройка'; end if;
  if c = '' and not am_is_global_admin() then raise exception 'Общие настройки меняет только главный администратор'; end if;
  if c <> '' and not am_is_admin(c) then raise exception 'Нет прав на этот город'; end if;
  if p_value is null or p_value = 'null'::jsonb or coalesce(trim(p_value #>> '{}'), '') = '' then
    delete from am_settings where key = p_key and city = c;
  else
    if jsonb_typeof(p_value) <> 'string' or char_length(p_value #>> '{}') > 500 then raise exception 'Текст до 500 символов'; end if;
    insert into am_settings(key, city, value, updated_by) values (p_key, c, p_value, auth.uid())
    on conflict (key, city) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
  end if;
  perform am_log('setting', null, nullif(c, ''), jsonb_build_object('key', p_key, 'value', p_value));
end $$;

-- ---------------- блокировка
create or replace function am_is_blocked(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select blocked_at is not null from am_profiles where id = p_user), false);
$$;
create or replace function am_block_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare u uuid := coalesce(to_jsonb(new)->>'sender_id', to_jsonb(new)->>'user_id')::uuid;
begin
  if u is not null and am_is_blocked(u) then raise exception 'Аккаунт заблокирован администратором'; end if;
  return new;
end $$;
drop trigger if exists am_block_guard on am_reviews;
create trigger am_block_guard before insert on am_reviews for each row execute function am_block_guard();
drop trigger if exists am_block_guard on am_messages;
create trigger am_block_guard before insert on am_messages for each row execute function am_block_guard();
drop trigger if exists am_block_guard on am_registrations;
create trigger am_block_guard before insert on am_registrations for each row execute function am_block_guard();
drop trigger if exists am_block_guard on am_requests;
create trigger am_block_guard before insert on am_requests for each row execute function am_block_guard();

create or replace function am_admin_block(p_user uuid, p_block boolean, p_reason text default '') returns void
language plpgsql security definer set search_path = public as $$
declare u am_profiles;
begin
  select * into u from am_profiles where id = p_user;
  if not found then raise exception 'Пользователь не найден'; end if;
  if not (am_is_global_admin() or (u.city is not null and am_is_admin(u.city))) then raise exception 'Нет прав'; end if;
  if p_user = auth.uid() then raise exception 'Нельзя заблокировать себя'; end if;
  if u.role <> 'client' then raise exception 'Сначала снимите с пользователя права администратора'; end if;
  if p_block and coalesce(trim(p_reason), '') = '' then raise exception 'Укажите причину блокировки'; end if;
  update am_profiles set blocked_at = case when p_block then now() end, blocked_reason = case when p_block then left(trim(p_reason), 300) end where id = p_user;
  perform am_log(case when p_block then 'block' else 'unblock' end, p_user, u.city, jsonb_build_object('reason', p_reason));
end $$;

-- ---------------- админы и права
create or replace function am_admin_set_role(p_user uuid, p_role text, p_city text default null) returns text
language plpgsql security definer set search_path = public as $$
declare u am_profiles;
begin
  if not am_is_global_admin() then raise exception 'Назначать администраторов может только главный администратор'; end if;
  if p_role not in ('client','regional_admin','global_admin') then raise exception 'Неизвестная роль'; end if;
  select * into u from am_profiles where id = p_user;
  if not found then raise exception 'Пользователь не найден'; end if;
  if u.blocked_at is not null and p_role <> 'client' then raise exception 'Пользователь заблокирован'; end if;
  if p_role = 'regional_admin' and not exists (select 1 from am_cities where name = p_city) then raise exception 'Выберите город'; end if;
  if u.role = 'global_admin' and p_role <> 'global_admin' and (select count(*) from am_profiles where role = 'global_admin') <= 1 then
    raise exception 'Нельзя снять последнего главного администратора';
  end if;
  update am_profiles set role = p_role, managed_city = case when p_role = 'regional_admin' then p_city end where id = p_user;
  perform am_log('role', p_user, case when p_role = 'regional_admin' then p_city end,
    jsonb_build_object('from', u.role, 'to', p_role, 'city', p_city, 'username', u.username));
  return 'Готово';
end $$;

create or replace function am_admin_list() returns table(id uuid, username text, full_name text, role text, managed_city text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not am_is_admin() then raise exception 'Нет прав'; end if;
  return query select p.id, p.username, p.full_name, p.role, p.managed_city, p.created_at from am_profiles p
    where p.role in ('global_admin','regional_admin') order by p.role, p.managed_city, p.username;
end $$;

create or replace function am_admin_users(p_q text default '', p_limit int default 50)
returns table(id uuid, username text, full_name text, phone text, city text, role text, managed_city text,
              blocked_at timestamptz, blocked_reason text, created_at timestamptz, requests bigint, orgs bigint)
language plpgsql security definer set search_path = public as $$
declare q text := '%' || lower(trim(coalesce(p_q, ''))) || '%'; qd text := regexp_replace(coalesce(p_q, ''), '\D', '', 'g');
begin
  if not am_is_admin() then raise exception 'Нет прав'; end if;
  return query select p.id, p.username, p.full_name, p.phone, p.city, p.role, p.managed_city, p.blocked_at, p.blocked_reason, p.created_at,
      (select count(*) from am_requests r where r.user_id = p.id), (select count(*) from am_providers o where o.owner_id = p.id)
    from am_profiles p
    where (am_is_global_admin() or am_is_admin(p.city))
      and (coalesce(trim(p_q), '') = '' or lower(coalesce(p.username, '')) like q or lower(coalesce(p.full_name, '')) like q
           or (length(qd) >= 4 and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || qd || '%'))
    order by p.created_at desc limit least(greatest(coalesce(p_limit, 50), 1), 200);
end $$;

-- журнал: действия админов над организациями и регистрациями
create or replace function am_providers_admin_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and am_is_admin(new.city) and (new.is_active is distinct from old.is_active or new.verified is distinct from old.verified) then
    perform am_log('provider', new.owner_id, new.city, jsonb_build_object('provider', new.id, 'name', new.name, 'is_active', new.is_active, 'verified', new.verified));
  end if;
  return null;
end $$;
drop trigger if exists am_providers_admin_log on am_providers;
create trigger am_providers_admin_log after update on am_providers for each row execute function am_providers_admin_log();

create or replace function am_registrations_admin_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and auth.uid() is not null then
    perform am_log('registration', new.user_id, new.city, jsonb_build_object('name', new.name, 'status', new.status, 'reason', new.reason));
  end if;
  return null;
end $$;
drop trigger if exists am_registrations_admin_log on am_registrations;
create trigger am_registrations_admin_log after update on am_registrations for each row execute function am_registrations_admin_log();

-- ---------------- права на функции
do $$
declare f text;
begin
  foreach f in array array['am_log(text,uuid,text,jsonb)','am_block_guard()','am_providers_admin_log()','am_registrations_admin_log()','am_setting_spec(text)','am_is_blocked(uuid)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['am_is_global_admin()','am_set_setting(text,text,jsonb)','am_admin_block(uuid,boolean,text)',
                           'am_admin_set_role(uuid,text,text)','am_admin_list()','am_admin_users(text,integer)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
