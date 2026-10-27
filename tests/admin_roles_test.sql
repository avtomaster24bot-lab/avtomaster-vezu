-- Тест обновления 7: админы города
do $$
declare g uuid := gen_random_uuid(); r uuid := gen_random_uuid(); c uuid := gen_random_uuid(); x text; n int;
begin
  insert into auth.users(id, raw_user_meta_data) values (g, '{"tg_id":1,"username":"boss"}'), (r, '{"tg_id":2,"username":"city"}'), (c, '{"tg_id":3,"username":"cli"}');
  insert into am_profiles(id, username, full_name, city, role) values (g,'boss','Boss','Алматы','global_admin'), (r,'city','City','Алматы','client'), (c,'cli','Cli','Астана','client');
  -- клиент не может назначать
  perform set_config('request.jwt.claim.sub', c::text, true);
  begin perform am_admin_set_role(r, 'regional_admin', 'Алматы'); raise exception 'FAIL client set role'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform am_admin_users('', 10); raise exception 'FAIL client users'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- главный назначает админа города
  perform set_config('request.jwt.claim.sub', g::text, true);
  perform am_admin_set_role(r, 'regional_admin', 'Алматы');
  select count(*) into n from am_admin_list() a where a.id in (g, r); if n <> 2 then raise exception 'FAIL admin list %', n; end if;
  begin perform am_admin_set_role(g, 'client', null); raise exception 'FAIL last global'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- админ города: видит только свой город, не назначает, блокирует только своих
  perform set_config('request.jwt.claim.sub', r::text, true);
  select count(*) into n from am_admin_users('', 50) u where u.city = 'Астана'; if n <> 0 then raise exception 'FAIL regional sees other city'; end if;
  begin perform am_admin_set_role(c, 'global_admin', null); raise exception 'FAIL regional escalates'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform am_admin_block(c, true, 'спам'); raise exception 'FAIL regional blocks other city'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform am_set_setting('city_notice', 'Алматы', to_jsonb('Тест объявления'::text));
  begin perform am_set_setting('city_notice', 'Астана', to_jsonb('x'::text)); raise exception 'FAIL regional other city setting'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- главный блокирует клиента, тот не может создать регистрацию
  perform set_config('request.jwt.claim.sub', g::text, true);
  perform am_admin_block(c, true, 'спам');
  begin insert into am_registrations(user_id, kind, name, phone, city) values (c, 'sto', 'X', '+77010000000', 'Астана'); raise exception 'FAIL blocked inserts'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  select count(*) into n from am_admin_log; if n < 3 then raise exception 'FAIL log %', n; end if;
  raise notice 'admin_roles_test OK (log %)', n;
end $$;
