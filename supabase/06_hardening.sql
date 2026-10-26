-- ============================================================
--  АвтоМастер24 — обновление 6: укрепление прав и производительность (после 01–05)
--  Только объекты am_*; чужие таблицы/функции в общей базе не трогает. Можно запускать повторно.
-- ============================================================

-- 1) am_make_admin: в Supabase функции по умолчанию исполняемы через PUBLIC, а проверка внутри
--    пропускала вызов без входа (auth.uid() is null) → гость мог назначить администратора. Закрываем.
revoke execute on function am_make_admin(text, text) from public, anon;
grant execute on function am_make_admin(text, text) to authenticated;
create or replace function am_make_admin(p_username text, p_city text default null) returns text
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- из SQL Editor (postgres) — можно всегда; через API — только администратору
  if current_user not in ('postgres', 'supabase_admin') and not am_is_admin() then raise exception 'Нет прав'; end if;
  update am_profiles set role = case when p_city is null then 'global_admin' else 'regional_admin' end, managed_city = p_city
  where lower(username) = lower(trim(leading '@' from p_username));
  get diagnostics n = row_count;
  return case when n = 0 then 'Пользователь не найден: сначала войдите на сайт через Telegram' else 'Готово' end;
end $$;
revoke execute on function am_make_admin(text, text) from public, anon;
grant execute on function am_make_admin(text, text) to authenticated;

-- 2) фиксированный search_path у функций без него
alter function am_matches(am_requests, am_providers) set search_path = public;
alter function am_requests_accepted_at() set search_path = public;
alter function am_products_sku() set search_path = public;

-- 3) права на функции:
--    внутренние (триггеры, служебные) — никому через API;
--    гостевые (заказ/чат по секретной ссылке, отзывы, проверки в политиках) — anon и authenticated;
--    остальные — только вошедшим (authenticated).
do $$
declare f record;
  internal text[] := array['am_providers_guard','am_products_limit','am_products_sku','am_requests_accepted_at',
                           'am_order_role','am_order_sys','am_order_close','am_recalc_rating','am_purge_order_chats'];
  guest text[] := array['am_create_lead','am_create_order','am_order_get','am_order_messages_list','am_order_send',
                        'am_order_accept_offer','am_order_set_status','am_order_rate','am_order_claim',
                        'am_provider_order_reviews','am_provider_stats','am_is_admin','am_owns','am_can_see_request'];
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.proname like 'am\_%' loop
    if f.proname = any(internal) then
      execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    elsif f.proname = any(guest) then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    elsif f.proname <> 'am_make_admin' then
      execute format('revoke execute on function %s from public, anon', f.sig);
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;

-- 4) политики: auth.uid() считается один раз на запрос, а не на каждую строку
drop policy if exists "own or admin" on am_profiles;
create policy "own or admin" on am_profiles for select to authenticated using (id = (select auth.uid()) or am_is_admin(city));
drop policy if exists "public active" on am_providers;
create policy "public active" on am_providers for select using (is_active or owner_id = (select auth.uid()) or am_is_admin(city));
drop policy if exists "owner update" on am_providers;
create policy "owner update" on am_providers for update to authenticated
  using (owner_id = (select auth.uid()) or am_is_admin(city)) with check (owner_id = (select auth.uid()) or am_is_admin(city));
drop policy if exists "published or own" on am_reviews;
create policy "published or own" on am_reviews for select using (is_published or user_id = (select auth.uid()) or am_is_admin());
drop policy if exists "own" on am_vehicles;
create policy "own" on am_vehicles for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own or admin" on am_registrations;
create policy "own or admin" on am_registrations for select to authenticated using (user_id = (select auth.uid()) or am_is_admin(city));
drop policy if exists "owner or admin read" on am_leads;
create policy "owner or admin read" on am_leads for select to authenticated
  using ((provider_id is not null and am_owns(provider_id)) or user_id = (select auth.uid())
         or am_is_admin(case when provider_id is null then null else (select city from am_providers where id = provider_id) end));

-- 5) индексы на внешние ключи
create index if not exists am_declines_provider on am_declines(provider_id);
create index if not exists am_leads_user on am_leads(user_id);
create index if not exists am_messages_sender on am_messages(sender_id);
create index if not exists am_models_brand on am_models(brand_id);
create index if not exists am_offers_provider on am_offers(provider_id);
create index if not exists am_prices_provider on am_prices(provider_id);
create index if not exists am_providers_owner on am_providers(owner_id);
create index if not exists am_registrations_user on am_registrations(user_id);
create index if not exists am_requests_accepted_by on am_requests(accepted_by);
create index if not exists am_requests_target_provider on am_requests(target_provider_id);
create index if not exists am_reviews_provider on am_reviews(provider_id);
create index if not exists am_reviews_user on am_reviews(user_id);
create index if not exists am_subcategories_category on am_subcategories(category_id);
create index if not exists am_vehicles_user on am_vehicles(user_id);
