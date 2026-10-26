#!/usr/bin/env python3
"""Генерирует справочники (без личных данных) из SQLite-базы бота:
site/avto/js/seed.js (для демо-режима) и supabase/02_seed.sql (для Supabase).
Запуск: python3 tools/build_seed.py путь/avtomaster.db путь/старая_база.db
Из баз берутся ТОЛЬКО справочники: города, категории, услуги, марки, модели, интервалы ТО, справочный прайс.
Пользователи, телефоны, telegram id, админы, заявки — НЕ выгружаются."""
import sqlite3, sys, json, re
main_db, old_db = sys.argv[1], sys.argv[2]
a = sqlite3.connect(main_db); b = sqlite3.connect(old_db)
cities = [dict(id=i, name=n, region=r or '', active=bool(act)) for i, n, r, act in a.execute('select id,name,region,active from cities order by id')]
cats = [dict(id=i, name=n) for i, n in b.execute('select id,name from categories order by id')]
subs = [dict(id=i, name=n, category_id=c) for i, n, c in b.execute('select id,name,category_id from subcategories order by category_id,id')]
pcats = [n for (n,) in a.execute('select name from price_service_categories order by id')]
psvc = [dict(id=i, name=n, category=c) for i, n, c in a.execute('select id,name,category from price_services order by id')]
brands = [dict(id=i, name=n) for i, n in a.execute('select id,name from price_brands order by id')]
models = [dict(id=i, brand_id=bi, name=n) for i, bi, n in a.execute('select id,brand_id,name from price_models order by id')]
maint = [dict(name=n, km=k, months=m, note=d) for n, k, m, d in b.execute('select name,interval_km,interval_months,description from maintenance_intervals order by id')]
prices = []
for brand, model, svc, price in b.execute('select brand,model,service_name,price from station_services order by id'):
    model = re.sub(r'[\d,\s]+$', '', model or '').strip()
    prices.append(dict(brand=(brand or '').title(), model=model.title(), service=re.sub(r'\s+', ' ', svc).strip(), price=int(price)))
data = dict(cities=cities, categories=cats, subcategories=subs, price_categories=pcats, price_services=psvc,
            brands=brands, models=models, maintenance=maint, ref_prices=prices)
open('site/avto/js/seed.js', 'w').write('// Сгенерировано tools/build_seed.py из базы бота (только справочники, без личных данных)\nexport const SEED = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
q = lambda s: 'null' if s is None else "'" + str(s).replace("'", "''") + "'"
out = ['-- Справочники АвтоМастер24 (сгенерировано tools/build_seed.py, без личных данных). Повторный запуск безопасен.']
for c in cities: out.append(f"insert into am_cities(id,name,region,active) values ({c['id']},{q(c['name'])},{q(c['region'])},{str(c['active']).lower()}) on conflict (id) do nothing;")
for c in cats: out.append(f"insert into am_categories(id,name) values ({c['id']},{q(c['name'])}) on conflict (id) do nothing;")
for s in subs: out.append(f"insert into am_subcategories(id,name,category_id) values ({s['id']},{q(s['name'])},{s['category_id']}) on conflict (id) do nothing;")
for s in psvc: out.append(f"insert into am_price_services(id,name,category) values ({s['id']},{q(s['name'])},{q(s['category'])}) on conflict (id) do nothing;")
for x in brands: out.append(f"insert into am_brands(id,name) values ({x['id']},{q(x['name'])}) on conflict (id) do nothing;")
for x in models: out.append(f"insert into am_models(id,brand_id,name) values ({x['id']},{x['brand_id']},{q(x['name'])}) on conflict (id) do nothing;")
out.append("do $$ begin if not exists (select 1 from am_prices where provider_id is null) then")
for p in prices: out.append(f"  insert into am_prices(provider_id,service,brand,model,price,notes) values (null,{q(p['service'])},{q(p['brand'])},{q(p['model'])},{p['price']},'Справочная цена');")
out.append("end if; end $$;")
out.append("do $$ begin")
for t in ['am_cities','am_categories','am_subcategories','am_price_services','am_brands','am_models']:
    out.append(f"  perform setval(pg_get_serial_sequence('{t}','id'), (select coalesce(max(id),1) from {t}));")
out.append("end $$;")
open('supabase/02_seed.sql', 'w').write('\n'.join(out) + '\n')
print({k: len(v) for k, v in data.items()})
