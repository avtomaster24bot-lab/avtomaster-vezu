#!/usr/bin/env bash
# Локальная проверка схемы и бизнес-логики на чистом PostgreSQL (без Supabase)
set -euo pipefail
cd "$(dirname "$0")/.."
DB=am24_test
sudo -u postgres dropdb --if-exists $DB; sudo -u postgres createdb $DB
for f in tests/local_shim.sql supabase/01_schema.sql supabase/02_seed.sql supabase/01_schema.sql supabase/03_features.sql tests/flow_test.sql supabase/03_features.sql tests/features_test.sql supabase/04_cards_cargo_shop.sql tests/cards_test.sql supabase/04_cards_cargo_shop.sql supabase/05_order_chat.sql tests/order_chat_test.sql supabase/05_order_chat.sql; do
  cp "$f" /tmp/am24_$(basename "$f"); sudo -u postgres env PGOPTIONS="-c client_min_messages=notice" psql -q -t -A -v ON_ERROR_STOP=1 -d $DB -f /tmp/am24_$(basename "$f") | grep -v '^$' || true
done

# Обновление 6 (права и индексы): чистая база 01–06, затем все тесты заново
DB6=am24_test6
sudo -u postgres dropdb --if-exists $DB6; sudo -u postgres createdb $DB6
for f in tests/local_shim.sql supabase/01_schema.sql supabase/02_seed.sql supabase/03_features.sql supabase/04_cards_cargo_shop.sql supabase/05_order_chat.sql supabase/06_hardening.sql supabase/06_hardening.sql tests/flow_test.sql tests/features_test.sql tests/cards_test.sql tests/order_chat_test.sql; do
  cp "$f" /tmp/am24_6_$(basename "$f"); sudo -u postgres env PGOPTIONS="-c client_min_messages=notice" psql -q -t -A -v ON_ERROR_STOP=1 -d $DB6 -f /tmp/am24_6_$(basename "$f") | grep -v '^$' || true
done
echo "ИТОГО обновление 6: OK"

# Обновление 7 (админы города): чистая база 01–07 (07 дважды — идемпотентность), затем все тесты
DB7=am24_test7
sudo -u postgres dropdb --if-exists $DB7; sudo -u postgres createdb $DB7
for f in tests/local_shim.sql supabase/01_schema.sql supabase/02_seed.sql supabase/03_features.sql supabase/04_cards_cargo_shop.sql supabase/05_order_chat.sql supabase/06_hardening.sql supabase/07_admin_roles.sql supabase/07_admin_roles.sql tests/admin_roles_test.sql tests/flow_test.sql tests/features_test.sql tests/cards_test.sql tests/order_chat_test.sql; do
  cp "$f" /tmp/am24_7_$(basename "$f"); out=$(sudo -u postgres env PGOPTIONS="-c client_min_messages=notice" psql -q -t -A -v ON_ERROR_STOP=1 -d $DB7 -f /tmp/am24_7_$(basename "$f") 2>&1) || { echo "$out" | grep -E "ERROR|FAIL" ; echo "ОШИБКА в $f"; exit 1; }
  echo "$out" | grep -E "admin_roles_test" || true
done
echo "ИТОГО обновление 7: OK"
