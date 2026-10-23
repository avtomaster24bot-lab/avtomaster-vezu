#!/usr/bin/env python3
"""Переносит организации из базы бота (СТО, эвакуаторы, мойки, запчасти, выездные мастера) в Supabase.
Создаёт файл private/providers.sql (папка private/ в .gitignore — в GitHub НЕ попадает).
Запуск:  python3 tools/export_providers.py путь/avtomaster.db
Потом откройте private/providers.sql, скопируйте в Supabase → SQL Editor → Run.
Переносятся только данные организаций (название, город, адрес, телефон для клиентов, часы).
Telegram ID владельцев НЕ переносятся: владелец сам подаёт заявку «Для бизнеса» на сайте,
а админ привязывает её (или одобряет новую организацию)."""
import sqlite3, sys, os
db = sqlite3.connect(sys.argv[1]); db.row_factory = sqlite3.Row
q = lambda s: 'null' if s is None or s == '' else "'" + str(s).replace("'", "''") + "'"
def cols(t): return {r[1] for r in db.execute(f'pragma table_info({t})')}
out = ['-- Организации из базы бота. Повторный запуск не создаёт дублей (проверка по kind+name+city).']
def add(kind, row, extra=None):
    extra = extra or {}
    c = dict(kind=q(kind), name=q(row['name']), city=q(row['city']), address=q(row['address'] if 'address' in row.keys() else ''),
             phone=q(row['phone']), working_hours=q(row['working_hours'] if 'working_hours' in row.keys() else ''),
             rating=str(row['rating'] or 0), reviews_count=str(row['reviews_count'] or 0), **extra)
    out.append(f"insert into am_providers({','.join(c)}) select {','.join(c.values())} where not exists "
               f"(select 1 from am_providers where kind={c['kind']} and name={c['name']} and city={c['city']});")
for r in db.execute('select * from stations'): add('sto', r)
for r in db.execute('select * from tow_trucks'): add('tow', r)
if 'car_washes' in [x[0] for x in db.execute("select name from sqlite_master")]:
    for r in db.execute('select * from car_washes'): add('wash', r, dict(boxes=str(r['boxes'] or 1), slot_minutes=str(r['slot_duration'] or 60)))
for r in db.execute('select * from suppliers'):
    t = {'shop': 'shop', 'dismantler': 'razborka', 'razborka': 'razborka'}.get(r['type'])
    if t: add('parts', r, dict(supplier_type=q(t), delivery='true' if r['delivery_available'] else 'false'))
for r in db.execute('select * from service_providers'):
    if r['service_type'] in ('locksmith', 'tire', 'electrician', 'mechanic', 'delivery'): add('urgent', r, dict(service_type=q(r['service_type'])))
os.makedirs('private', exist_ok=True)
open('private/providers.sql', 'w').write('\n'.join(out) + '\n')
print('Готово: private/providers.sql, организаций:', len(out) - 1)
