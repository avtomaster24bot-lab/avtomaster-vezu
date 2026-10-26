# АвтоМастер24 + ВЕЗУ — гибридный сайт

Автосервис и грузоперевозки в одном сайте (GitHub Pages):
**https://avtomaster24bot-lab.github.io/avtomaster-vezu/**

| Раздел | Адрес | Что это |
|---|---|---|
| Общая главная | `/avtomaster-vezu/` | выбор: 🔧 АвтоМастер24 (авто-услуги) или 🚚 ВЕЗУ (грузоперевозки) |
| АвтоМастер24 | `/avtomaster-vezu/avto/` | СТО, эвакуатор, мойка, запчасти, выездная помощь, калькулятор цен, гараж, кабинеты исполнителя и админа (Supabase + вход через Telegram, ДЕМО-режим без базы) |
| ВЕЗУ | `/avtomaster-vezu/vezu/` | грузоперевозки до 3 тонн по Казахстану, заказ в WhatsApp, цифровые визитки водителей с QR (`card.html`, `new.html`, `tarify.html`), PWA |

На каждой странице обоих разделов сверху есть общая полоска-навигация (`site/shared/hubbar.css`):
«⌂ АвтоМастер24 + ВЕЗУ» → общая главная, «🔧 Авто-услуги», «🚚 Грузоперевозки».

## Структура

```
site/                    ← публикуется на GitHub Pages целиком
  index.html, hub.css    ← общая главная (хаб)
  404.html               ← «страница не найдена» со ссылками на разделы
  shared/hubbar.css      ← общая навигация для обоих разделов
  avto/                  ← АвтоМастер24 (бывший site/ из avtomaster24-web)
    js/config.js         ← настройки Supabase/Telegram (публичные данные, без секретов)
  vezu/                  ← ВЕЗУ (бывший корень dogruz): index, card, new, tarify, sw.js, manifest
supabase/                ← SQL-схема и справочники АвтоМастер24 (01_schema.sql, 02_seed.sql, all_in_one.sql)
tests/                   ← проверка схемы на чистом PostgreSQL: bash tests/run_db_tests.sh
tools/                   ← build_seed.py (пишет site/avto/js/seed.js и supabase/02_seed.sql), export_providers.py
docs/README-avtomaster24.md, docs/README-vezu.md ← исходные README проектов
.github/workflows/pages.yml ← деплой site/ на Pages при push в main
```

## Откуда собрано

- **АвтоМастер24** — https://github.com/avtomaster24bot-lab/avtomaster24-web (папка `site/` → `site/avto/`, остальное — в корень)
- **ВЕЗУ** — https://github.com/avtomaster24bot-lab/dogruz (весь сайт → `site/vezu/`)

История коммитов обоих проектов сохранена (слияние с `--allow-unrelated-histories`, файлы перенесены через `git mv`;
смотрите `git log --follow site/vezu/js/common.js`). Исходные репозитории не изменялись и продолжают работать по своим адресам.

## Что изменено при объединении

- Все пути в обоих приложениях относительные — после переноса в подпапки они работают без правок.
- ВЕЗУ: `og:url` / `og:image` указывают на новый адрес; service worker работает в области `/avtomaster-vezu/vezu/`,
  кэш назван `avtovezu-vezu-v1` и при обновлении удаляет только свои старые кэши (на домене `github.io` живут и другие сайты).
  `manifest.webmanifest` — `start_url: ./new.html`, `scope: ./` (относительно `/vezu/`). Номер WhatsApp — `SITE_PHONE` в `site/vezu/js/common.js`.
- АвтоМастер24: настройки Supabase в `site/avto/js/config.js` оставлены как есть (anon-ключ публичный, защита — RLS).
  Вход через Telegram работает, т.к. домен `avtomaster24bot-lab.github.io` уже привязан к боту входа.
- `tools/build_seed.py` теперь пишет в `site/avto/js/seed.js`.

## Секреты

В репозиторий не кладутся токены ботов, `service_role` ключ, `.env` (см. `.gitignore`).
