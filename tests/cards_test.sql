-- Тест обновления 4 (после features_test.sql). Локально, не запускать в Supabase.
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role','authenticated')::text, false) $$;
create or replace function pg_temp.as_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', false) $$;
set role authenticated;
-- мастер создаёт визитку грузоперевозчика сразу (без модерации)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select am_create_card('{"kind":"cargo","name":"Газель Тест","phone":"+77010000009","city":"Талдыкорган","card":{"slogan":"Переезды","cargo":{"vehicle":"gazel","price":6000}}}') as cargo_id \gset
select 'визитка: ' || kind || ' ' || name || ' wa=' || whatsapp || ' shop=' || shop_enabled from am_providers where id = :cargo_id;
select am_create_card('{"kind":"parts","name":"Магазин Тест","phone":"+77010000010","city":"Талдыкорган","supplier_type":"shop"}') as shop_id \gset
select 'магазин shop_enabled: ' || shop_enabled from am_providers where id = :shop_id;
do $$ begin perform am_create_card('{"kind":"bank","name":"X","phone":"1","city":"Талдыкорган"}'); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK неизвестный тип: %', sqlerrm; end $$;
do $$ begin perform am_create_card('{"kind":"sto","name":"X","phone":"1","city":"Марс"}'); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK чужой город: %', sqlerrm; end $$;
-- владелец правит визитку; нельзя сменить тип, verified и http-ссылку
update am_providers set card = '{"slogan":"Новый"}', kind = 'sto', verified = true where id = :cargo_id;
select 'после правки: ' || kind || ' verified=' || verified || ' slogan=' || (card->>'slogan') from am_providers where id = :cargo_id;
do $$ begin update am_providers set store_url = 'javascript:alert(1)' where id = (select max(id) from am_providers); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK плохая ссылка: %', sqlerrm; end $$;
update am_providers set store_url = 'https://biznes-shablon.vercel.app/catalog' where id = :shop_id;
-- товары: владелец добавляет, чужой не может
insert into am_products(provider_id, name, category, price, stock) values (:shop_id, 'Масло 5W-30', 'Масла', 18900, 5), (:shop_id, 'Фильтр', 'Фильтры', 2500, 10);
insert into am_products(provider_id, name, price, is_published) values (:shop_id, 'Черновик', 100, false);
select 'sku: ' || string_agg(sku, ',' order by id) from am_products;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin insert into am_products(provider_id, name, price) values ((select max(provider_id) from am_products), 'Спам', 1); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK чужой не добавил товар: %', sqlerrm; end $$;
with u as (update am_products set price = 1 returning 1) select 'чужой обновил товаров: ' || count(*) from u;
-- гость (anon) видит только опубликованные товары; создаёт лид
reset role; set role anon; select pg_temp.as_anon();
select 'гость видит товаров: ' || count(*) from am_products;
select am_create_lead(json_build_object('provider_id', :shop_id, 'kind', 'order', 'source', 'shop', 'customer_name', 'Айдос', 'customer_phone', '+7 701 234 56 78',
  'message', 'Заказ: Масло 5W-30 × 1', 'payload', json_build_object('items', json_build_array(json_build_object('name','Масло','qty',1))), 'total', 18900)::jsonb) as lead_id \gset
select am_create_lead('{"kind":"request","source":"site","message":"Нужна газель на завтра"}') as disp_lead;
do $$ begin perform count(*) from am_leads; raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK гость не читает лиды: %', sqlerrm; end $$;
do $$ begin insert into am_leads(message) values ('x'); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK прямой insert лида запрещён: %', sqlerrm; end $$;
do $$ begin perform am_create_lead('{"message":""}'); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK пустой лид: %', sqlerrm; end $$;
do $$ begin perform am_set_lead_status(1, 'done'); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK гость не меняет статус: %', sqlerrm; end $$;
-- лимит частоты
do $$ begin for i in 1..20 loop perform am_create_lead('{"message":"спам"}'); end loop; raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK лимит лидов: %', sqlerrm; end $$;
-- владелец видит и меняет статус; чужой нет
reset role; set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select 'чужой видит лидов: ' || count(*) from am_leads;
do $$ begin perform am_set_lead_status((select max(id) from am_leads), 'done'); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK чужой не меняет статус: %', sqlerrm; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select 'владелец видит лидов: ' || count(*) from am_leads;
select am_set_lead_status(:lead_id, 'in_work');
select 'статус: ' || status || ' total=' || total from am_leads where id = :lead_id;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select 'админ видит диспетчерских лидов: ' || count(*) from am_leads where provider_id is null;
-- заявка на грузоперевозку в приложении живёт 2 часа и видна перевозчику
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select am_create_request('{"type":"cargo","description":"Переезд","details":{"from":"А","to":"Б","vehicle":"gazel"}}') as cargo_req \gset
select 'ttl мин: ' || round(extract(epoch from expires_at - created_at) / 60) from am_requests where id = :cargo_req;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select 'лента перевозчика: ' || count(*) from am_provider_feed(:cargo_id);
select am_accept_request(:cargo_req, :cargo_id);
select 'принята: ' || status from am_requests where id = :cargo_req;
-- фото товара: только в папку своего магазина
select 'фото своего: ' || am_can_edit_prov_photo('shop/' || :shop_id || '/a.jpg') || ', чужого: ' || am_can_edit_prov_photo('shop/999/a.jpg');
reset role;
select 'ИТОГО обновление 4: OK';
