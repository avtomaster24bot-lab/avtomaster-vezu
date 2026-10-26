-- Тест обновления 5 (после cards_test.sql). Локально, не запускать в Supabase.
\set ON_ERROR_STOP 1
create or replace function pg_temp.fails(q text, what text) returns void language plpgsql as $f$
begin execute q; raise exception 'FAIL %', what; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK %: %', what, sqlerrm; end $f$;
create or replace function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role','authenticated')::text, false) $$;
-- гость оформляет заказ с визитки перевозчика (провайдер владельца b), получает секрет
set role anon; select set_config('request.jwt.claims', '{"role":"anon"}', false);
select am_create_order(json_build_object('provider_id', (select max(id) from am_providers where kind = 'cargo'), 'kind', 'cargo', 'source', 'card',
  'customer_name', 'Ерлан Б', 'customer_phone', '+7 702 111 22 33', 'message', 'Переезд, 2 комнаты')::jsonb) as o \gset
select (:'o'::jsonb->>'id')::bigint as oid, :'o'::jsonb->>'token' as tok \gset
select 'роль гостя: ' || (am_order_get(:oid, :'tok')->>'role');
do $$ begin perform am_order_get(currval('am_leads_id_seq'), 'неверный'); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK чужой секрет: %', sqlerrm; end $$;
do $$ begin perform am_order_get(currval('am_leads_id_seq'), null); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK без секрета гость не видит: %', sqlerrm; end $$;
select (am_order_send(:oid, :'tok', '{"body":"Есть пианино, нужен грузчик"}')).author;
select pg_temp.fails(format('select am_order_send(%s, %L, %L)', :oid, :'tok', '{"offer_price":5000}'), 'клиент не предлагает цену');
do $$ begin perform am_order_messages_list(1, null, 0) from am_order_messages limit 1; perform count(*) from am_order_messages; raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK гость не читает таблицу: %', sqlerrm; end $$;
-- владелец: видит в RLS, не видит секрет, отвечает, предлагает цену
reset role; set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select 'владелец видит сообщений: ' || count(*) from am_order_messages where lead_id = :oid;
do $$ begin perform token from am_leads limit 1; raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK владелец не видит секрет: %', sqlerrm; end $$;
select 'роль владельца: ' || (am_order_get(:oid, null)->>'role');
select (am_order_send(:oid, null, '{"body":"Пианино — +3000, два грузчика"}')).author;
select 'статус после ответа: ' || status from am_leads where id = :oid;
select (am_order_send(:oid, null, '{"body":"Итого","offer_price":18000}')).id as offer1 \gset
select (am_order_send(:oid, null, '{"body":"Со скидкой","offer_price":16000}')).id as offer2 \gset
do $$ begin perform am_order_rate(currval('am_leads_id_seq'), null, 5, 'сам себе'); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK владелец не оценивает: %', sqlerrm; end $$;
-- чужой исполнитель не видит
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select 'чужой видит сообщений: ' || count(*) from am_order_messages;
do $$ begin perform am_order_get(currval('am_leads_id_seq'), null); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK чужой не открыл заказ: %', sqlerrm; end $$;
-- клиент принимает актуальную цену (старая устарела)
reset role; set role anon; select set_config('request.jwt.claims', '{"role":"anon"}', false);
do $$ begin perform am_order_accept_offer(currval('am_leads_id_seq'), (select 1)::text, 1); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK без секрета не принять'; end $$;
select 'старое предложение: ' || offer_state from am_order_messages_list(:oid, :'tok', 0) where id = :offer1;
select am_order_accept_offer(:oid, :'tok', :offer2);
select 'после согласия: ' || (am_order_get(:oid, :'tok')->>'status') || ' цена ' || (am_order_get(:oid, :'tok')->>'agreed_price');
select pg_temp.fails(format('select am_order_rate(%s, %L, 5, %L)', :oid, :'tok', ''), 'оценка до выполнения');
-- владелец: в работе → выполнено; клиент оценивает; владелец: оплачено → закрыт
reset role; set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select am_order_set_status(:oid, null, 'in_work'); select am_order_set_status(:oid, null, 'done');
reset role; set role anon; select set_config('request.jwt.claims', '{"role":"anon"}', false);
do $$ begin perform am_order_set_status(currval('am_leads_id_seq'), (select 'x'), 'cancelled'); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK нельзя без секрета'; end $$;
select am_order_rate(:oid, :'tok', 5, 'Аккуратно перевезли пианино');
select 'после оценки: ' || (am_order_get(:oid, :'tok')->>'status') || ', closed=' || coalesce(am_order_get(:oid, :'tok')->>'closed_at', 'нет');
reset role; set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select am_order_set_status(:oid, null, 'paid');
select provider_id as opid from am_leads where id = :oid \gset
select 'итог: ' || status || ' цена=' || agreed_price || ' оценка=' || rating || ' closed=' || (closed_at is not null) from am_leads where id = :oid;
select 'рейтинг визитки: ' || rating || ' (' || reviews_count || ')' from am_providers where id = (select provider_id from am_leads where id = :oid);
select pg_temp.fails('select am_recalc_rating(1)', 'нельзя вызвать пересчёт напрямую');
do $$ begin perform am_order_send(currval('am_leads_id_seq'), null, '{"body":"ещё"}'); raise exception 'FAIL'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK закрытый чат: %', sqlerrm; end $$;
select 'системных сообщений: ' || count(*) filter (where author = 'system') || ', всего: ' || count(*) from am_order_messages where lead_id = :oid;
-- отзывы на визитке (публично, без телефона)
reset role; set role anon; select set_config('request.jwt.claims', '{"role":"anon"}', false);
select 'отзыв на визитке: ' || rating || ' ' || name || ' — ' || review from am_provider_order_reviews(:opid);
-- очистка: «прошло 4 дня» → переписка удалена, итог остался
reset role;
update am_leads set closed_at = now() - interval '4 days' where id = :oid;
select 'удалено сообщений: ' || am_purge_order_chats();
select 'после очистки: сообщений ' || (select count(*) from am_order_messages where lead_id = :oid) || ', итог: ' || status || ' ' || agreed_price || ' ' || rating || '★ «' || review || '», purged=' || (chat_purged_at is not null) from am_leads where id = :oid;
-- автозакрытие: оплачен 8 дней назад без оценки
update am_leads set status = 'paid', paid_at = now() - interval '8 days', closed_at = null, rating = null where id = (select min(id) from am_leads where id <> :oid and provider_id is not null);
select am_purge_order_chats();
select 'автозакрыт: ' || (closed_at is not null) from am_leads where id = (select min(id) from am_leads where id <> :oid and provider_id is not null);
-- вернуться в чат по телефону (ссылка без секрета)
set role anon; select set_config('request.jwt.claims', '{"role":"anon"}', false);
select 'чужой телефон: ' || coalesce(am_order_claim(:oid, '+7 700 000 00 00'), 'нет секрета');
select am_order_claim(:oid, '+7 700 000 00 01'), am_order_claim(:oid, '+7 700 000 00 02'), am_order_claim(:oid, '+7 700 000 00 03'), am_order_claim(:oid, '+7 700 000 00 04');
reset role; select 'попыток: ' || claim_tries from am_leads where id = :oid; set role anon;
select pg_temp.fails(format('select am_order_claim(%s, %L)', :oid, '+7 702 111 22 33'), 'лимит попыток');
reset role; update am_leads set claim_at = now() - interval '2 hours' where id = :oid; set role anon;
select 'секрет по телефону совпал: ' || (am_order_claim(:oid, '8 702 111 22 33') = :'tok');
reset role;
-- клиент может отменить до начала работ
set role anon;
select am_create_order('{"message":"Нужна газель","source":"site"}') as o2 \gset
select am_order_set_status((:'o2'::jsonb->>'id')::bigint, :'o2'::jsonb->>'token', 'cancelled');
select 'отмена: ' || (am_order_get((:'o2'::jsonb->>'id')::bigint, :'o2'::jsonb->>'token')->>'status');
reset role;
select 'ИТОГО обновление 5: OK';
