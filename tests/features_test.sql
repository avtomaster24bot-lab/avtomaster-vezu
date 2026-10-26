-- Тест обновления 3 (после flow_test.sql). Локально, не запускать в Supabase.
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role','authenticated')::text, false) $$;
set role authenticated;
-- клиент создаёт заявку с фото, мастер принимает → accepted_at
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select am_create_request('{"type":"sto","category_id":2,"description":"Фото-тест","details":{"photos":["req/00000000-0000-0000-0000-00000000000c/a.jpg"]}}') as rid \gset
insert into storage.objects(bucket_id, name) values ('am-photos', 'req/00000000-0000-0000-0000-00000000000c/a.jpg');
do $$ begin insert into storage.objects(bucket_id, name) values ('am-photos', 'req/00000000-0000-0000-0000-00000000000d/x.jpg'); raise exception 'FAIL чужая папка'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK нельзя грузить в чужую папку'; end $$;
-- чужой не видит фото
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select 'чужой видит фото: ' || count(*) from storage.objects where bucket_id='am-photos';
-- мастер видит фото новой заявки (заявка ему видна)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select 'мастер видит фото: ' || count(*) from storage.objects where bucket_id='am-photos';
-- чат до принятия закрыт
do $$ begin perform am_send_message(currval('am_requests_id_seq'), 'привет'); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK чат до принятия: %', sqlerrm; end $$;
select am_accept_request(:rid, 1);
select (am_send_message(:rid, 'Здравствуйте, когда сможете подъехать?')).from_provider;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select (am_send_message(:rid, 'Через час')).from_provider;
select 'клиент видит сообщений: ' || count(*) from am_messages where request_id = :rid;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select 'чужой видит сообщений: ' || count(*) from am_messages;
do $$ begin perform am_send_message(1, 'спам'); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK чужой не пишет: %', sqlerrm; end $$;
-- статистика и ответ на отзыв
select am_provider_stats(1);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select am_reply_review((select id from am_reviews where provider_id = 1 limit 1), 'Спасибо, ждём снова!');
-- мастер не может сам себе поставить «Проверен», но может описание и фото
update am_providers set verified = true, about = 'Работаем с 2010 года', photos = '{prov/1/a.jpg}' where id = 1;
select verified, about, photos from am_providers where id = 1;
insert into storage.objects(bucket_id, name) values ('am-public', 'prov/1/a.jpg');
do $$ begin insert into storage.objects(bucket_id, name) values ('am-public', 'prov/999/a.jpg'); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK чужая организация'; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin perform am_reply_review(1, 'взлом'); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK чужой не отвечает на отзыв'; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update am_providers set verified = true where id = 1;
select 'verified after admin: ' || verified from am_providers where id = 1;
reset role; set role anon; select set_config('request.jwt.claims', '', false);
select 'anon stats: ' || am_provider_stats(1)::text;
select 'anon public photos: ' || count(*) from storage.objects where bucket_id = 'am-public';
do $$ begin perform count(*) from am_messages; raise exception 'FAIL anon чат'; exception when insufficient_privilege then raise notice 'OK anon не видит чат'; end $$;
select 'FEATURE TESTS PASSED';
