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
