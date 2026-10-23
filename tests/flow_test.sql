-- Локальный тест схемы (на чистом PostgreSQL с tests/local_shim.sql). Не запускать в Supabase.
\set ON_ERROR_STOP 1
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000c','c@x','{"tg_id":1,"username":"client1","first_name":"Клиент"}'),
 ('00000000-0000-0000-0000-00000000000b','b@x','{"tg_id":2,"username":"master1","first_name":"Мастер"}'),
 ('00000000-0000-0000-0000-00000000000a','a@x','{"tg_id":3,"username":"boss","first_name":"Админ"}'),
 ('00000000-0000-0000-0000-00000000000d','d@x','{"tg_id":4,"username":"other","first_name":"Чужой"}');
create or replace function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role','authenticated')::text, false) $$;
set role authenticated;
-- все создают профили
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); select (am_ensure_profile()).full_name;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); select (am_ensure_profile()).full_name;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d'); select (am_ensure_profile()).full_name;
reset role; select set_config('request.jwt.claims','',false); select am_make_admin('boss'); set role authenticated;
-- мастер регистрирует СТО и мойку, админ одобряет
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select am_register_business('{"kind":"sto","name":"СТО Тест","phone":"+77010000000","city":"Талдыкорган","details":{"specs":[2]}}');
select am_register_business('{"kind":"wash","name":"Мойка Тест","phone":"+77010000001","city":"Талдыкорган"}');
select am_register_business('{"kind":"parts","name":"Запчасти Тест","phone":"+77010000002","city":"Талдыкорган","details":{"supplier_type":"shop"}}');
do $$ begin perform am_review_registration(1, true, null); raise exception 'FAIL: не-админ одобрил'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select am_review_registration(id, true, null) from am_registrations where status='pending';
select id, kind, name from am_providers order by id;
-- клиент без телефона не может создать заявку
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin perform am_create_request('{"type":"sto","city":"Талдыкорган"}'); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK без телефона: %', sqlerrm; end $$;
select (am_update_profile('Клиент Иван', '+7 701 123 45 67', 'Талдыкорган', true)).phone;
select am_create_request('{"type":"sto","category_id":2,"subcategory":"Замена ГРМ","description":"Стучит","vehicle_info":"Toyota Camry 2015"}') as sto_req;
select am_create_request('{"type":"wash","target_provider_id":2,"service_type":"Комплексная","details":{"car_type":"Седан"},"desired_time":"2030-01-01T10:00:00Z"}') as wash_req;
select am_create_request('{"type":"parts","supplier_type":"shop","description":"Фара левая"}') as parts_req;
-- чужой пользователь не видит заявки и профиль клиента
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select 'чужой видит заявок: ' || count(*) from am_requests;
select 'чужой видит профилей: ' || count(*) from am_profiles;
do $$ begin perform am_accept_request(1, 1); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK чужой не принял: %', sqlerrm; end $$;
-- мастер видит ленту
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select 'лента СТО: ' || count(*) from am_provider_feed(1);
select 'видит заявок через RLS: ' || count(*) from am_requests;
do $$ begin perform * from am_client_contact(1); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK контакт скрыт до принятия'; end $$;
select am_accept_request(1, 1);
select full_name, phone from am_client_contact(1);
select am_complete_request(1, 1, 25000);
select am_wash_quote(2, 2, 5000, '2030-01-01T11:00:00Z');
select am_make_offer(3, 3, 18000, 'Оригинал, есть в наличии');
-- клиент
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select provider_name, price from am_request_offers(3);
select am_select_offer(id) from am_request_offers(3);
select provider_name, provider_phone from am_request_offers(3);
select am_wash_approve(2);
select am_leave_review(1, 5, 'Отлично');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select am_wash_status(2, 2, 'in_progress'); select am_wash_status(2, 2, 'waiting_client'); select am_wash_status(2, 2, 'completed');
select am_complete_request(3, 3, null);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select am_client_confirm(3);
select id, type, status, final_amount from am_requests order by id;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select am_moderate_review(id, true) from am_reviews;
select am_admin_stats();
reset role; set role anon; select set_config('request.jwt.claims', '', false);
select 'anon providers: ' || count(*) from am_providers;
select 'anon reviews: ' || count(*) from am_reviews;
do $$ begin perform count(*) from am_profiles; raise exception 'FAIL anon профили'; exception when insufficient_privilege then raise notice 'OK anon не видит профили'; end $$;
select 'ALL TESTS PASSED';
