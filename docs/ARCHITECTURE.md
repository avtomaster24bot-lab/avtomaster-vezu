# Архитектура: как перенести сервис в другую страну, не переписывая интерфейс

Интерфейс (все экраны в `site/js/app.js`, `card.js`, `shop.js`) **не знает**, где хранятся данные, каким мессенджером
уходят заявки и в какой стране работает сервис. Всё это закрыто тремя адаптерами:

```
            ┌──────────────── интерфейс (app.js, card.js, shop.js) ────────────────┐
            │  экраны, формы, тексты                                                │
            └──────┬───────────────────────┬────────────────────────┬──────────────┘
                   │ api.*                 │ messaging.*            │ region.*
         ┌─────────▼────────┐   ┌──────────▼─────────┐   ┌──────────▼──────────┐
         │ js/api.js        │   │ js/messaging.js    │   │ js/region.js        │
         │ выбирает бэкенд  │   │ WhatsApp / TG / SMS│   │ KZ / RU / US        │
         └──┬───────────┬───┘   └────────────────────┘   └─────────────────────┘
   backend-supabase.js  backend-demo.js   (+ любой другой: backend-<страна>.js)
```

## 1. Бэкенд (`js/api.js`)

`api.js` экспортирует один объект `api` с одинаковым набором методов. Сейчас две реализации:

- `backend-supabase.js` — Supabase (PostgreSQL + RLS + функции `am_*` + Storage + вход через Telegram);
- `backend-demo.js` — то же самое в localStorage (демо, тесты, работа без сервера).

Новая страна = новый файл с теми же методами (например, `backend-yandex.js` на Yandex Cloud Functions + Managed PostgreSQL
или `backend-rest.js` на собственный REST-сервер) и одна строка выбора в `api.js`. Экраны не меняются.

**Контракт методов** (все `async`, ошибки — `throw new Error('текст для пользователя')`):

| Группа | Методы |
|---|---|
| Справочники, сессия | `ref`, `session`, `loginTelegram`, `logout`, `updateProfile`, `deleteMyData`, `caps` |
| Организации | `listProviders`, `getProvider`, `myProviders`, `updateProvider`, `providerReviews`, `providerStats`, `pricesFrom`, `uploadProviderPhoto`, `photoUrls` |
| **Визитки (v4)** | `createCard(p)` → id |
| Заявки в приложении | `createRequest`, `myRequests`, `getRequest`, `cancelRequest`, `requestOffers`, `selectOffer`, `washApprove`, `clientConfirm`, `leaveReview`, `myReviewFor`, `uploadRequestPhoto` |
| Исполнитель | `providerFeed`, `myOffers`, `accept`, `decline`, `complete`, `makeOffer`, `washQuote`, `washStatus`, `clientContact`, `replyReview` |
| Чат | `messages`, `sendMessage`, `subscribeMessages` |
| **Лиды / WhatsApp (v4)** | `createLead(l)` (можно без входа), `myLeads(pid)`, `dispatchLeads()`, `setLeadStatus(id, status)` |
| **Чат по заказу (v5)** | `createOrder(l)` → {id, token, chan}, `getOrder(id, token)`, `orderMessages(id, token, after)`, `sendOrderMessage(id, token, {body, photo, offer_price})`, `acceptOffer`, `setOrderStatus`, `rateOrder`, `claimOrder(id, phone)`, `subscribeOrder(order, cb)`, `providerOrderReviews(pid)` |
| **Витрина (v4)** | `shopProducts(pid)`, `myProducts(pid)`, `saveProduct(pid, x)`, `deleteProduct(id)`, `uploadProductPhoto(pid, blob)` |
| Гараж, цены, бизнес, админ | `vehicles`, `addVehicle`, `deleteVehicle`, `searchPrices`, `providerPrices`, `addPrice`, `deletePrice`, `registerBusiness`, `myRegistrations`, `admin*`, `setProvider*`, `setCityActive`, `addCity`, `moderateReview`, `pendingReviews` |

`caps()` сообщает, какие возможности есть у бэкенда (`v3` — фото/чат, `v4` — визитки/лиды/витрина, `v5` — чат по заказу).
Интерфейс прячет то, чего нет, поэтому сайт можно выкатить раньше миграции базы.

**Модель данных v4** (таблицы, которые нужны любому бэкенду):

- `providers` + `card` (JSON: slogan, services[], payments[], tg, ig, cargo{vehicle, price, per, extras[], areas}, shop_title, shop_accent), `store_url`, `shop_enabled`, `whatsapp`;
- `leads`: provider_id (null = диспетчер), kind (request/order/callback), source (card/shop/site/app), customer_name/phone, message (ровно то, что ушло в мессенджер), payload (JSON), total, status (new/in_work/done/cancelled);
- `products`: provider_id, sku, name, category, price, stock, photo, description, is_published.

Правила доступа (в Supabase — RLS, в другом бэкенде — те же проверки на сервере): лиды читает только владелец
организации или админ; создать лид может кто угодно, но только через серверную функцию с лимитами; товары
публичны, только если витрина включена, менять их может только владелец.

## 2. Мессенджер (`js/messaging.js`)

Канал выбирается в `config.js`: `MESSENGER: 'whatsapp'`. Каналы — объекты `{ id, label, icon, link(to, text) }`:

- `whatsapp` — `https://wa.me/<номер>?text=…` (работает без API и без затрат; сообщение отправляет сам клиент);
- `telegram` — `https://t.me/<username>` или «поделиться текстом»;
- `sms` — `sms:<номер>?body=…`.

Тексты заявок и заказов собираются в одном месте — `requestText()` и `orderText()`, поэтому их легко перевести
или переделать под другой мессенджер. Добавить канал (MAX, Viber, LINE, iMessage) = добавить объект в `CHANNELS`.

**Роль мессенджера после обновления 5 — уведомление, а не место переписки.** Сама переписка идёт в чате заказа на сайте
(`order.html`), а `sendLink()` гарантирует, что в любом сообщении есть ссылка на сайт; сообщения о заказе содержат ссылку
на его чат (владельцу — `order.html?id=N&as=owner`, клиенту — `order.html?id=N&c=1` с подтверждением телефона).

Уведомления владельцу о новых сообщениях:
1. **Браузер** (сделано): страница чата и Кабинет показывают системное уведомление, если разрешить «🔔 Уведомления».
2. **Telegram-бот** (готово, не развёрнуто): `supabase/functions/am-notify` — Database Webhook на вставку в `am_leads` и
   `am_order_messages` → сообщение владельцу от бота входа (у владельца есть `tg_id`, кнопка входа запрашивает право писать).
   Идея взята из бота `avtomaster24-v2perviy` (handlers/chat.py, services/notify.py): анонимный чат клиент ↔ исполнитель
   с пересылкой текста и фото, уведомление исполнителю, «Завершить чат».
3. **WhatsApp Business Cloud API** (позже): тот же webhook, шаблонное сообщение «Новое сообщение по заявке №N: <ссылка>».

Следующий шаг (нужен сервер): **уведомление владельцу без участия клиента** — WhatsApp Business Cloud API (Meta)
или Telegram-бот. Для этого после `am_create_lead` вызывается Edge Function / webhook, который отправляет
шаблонное сообщение. Токены хранятся только в секретах сервера, не в GitHub.

## 3. Регион (`js/region.js`)

`config.js` → `REGION: 'KZ' | 'RU' | 'US'`. Каждый регион задаёт: язык и локаль, валюту и знак, часовой пояс,
формат и проверку телефона, сервис карт (+ запасной), способы оплаты, мессенджер и бэкенд по умолчанию, закон о данных.
Интерфейс использует только `money()`, `validPhone()`, `fmtPhone()`, `mapSearch()`, `mapPoint()`, `REGION.payments`.

| | Казахстан (сейчас) | Россия | США |
|---|---|---|---|
| Валюта, телефон | ₸, +7 7XX | ₽, +7 9XX | $, +1 (XXX) XXX-XXXX |
| Карты | 2ГИС (+ Google) | Яндекс Карты (+ 2ГИС) | Google Maps (+ Apple) |
| Оплата | Kaspi перевод / Kaspi QR, наличные, карта (позже Kaspi Pay, Halyk ePay, CloudPayments) | СБП, ЮKassa, CloudPayments, Т-Банк | Stripe, Square, Apple/Google Pay |
| Мессенджер | WhatsApp | Telegram / MAX / SMS (WhatsApp в РФ ограничивают — проверять на дату запуска) | SMS + WhatsApp; часто звонок |
| Вход | Telegram | Telegram, VK ID, Яндекс ID | Google, Apple, телефон (SMS-код) |
| Хранение данных | Закон РК «О персональных данных и их защите»: базы с персональными данными граждан РК — на территории РК | 152-ФЗ: первичный сбор и хранение данных россиян — на серверах в РФ | нет требования локализации; CCPA/законы штатов, TCPA для SMS |
| Где держать бэкенд | Supabase (сейчас) для пилота; для масштаба — self-hosted Supabase / PostgreSQL у казахстанского облака (PS Cloud, QazCloud, Kazteleport) | self-hosted Supabase или Yandex Cloud / Selectel / VK Cloud | Supabase Cloud (регион US) |

> Юридические требования приведены как ориентир для планирования; перед запуском в стране их нужно проверить у местного юриста.

**Перенос в другую страну по шагам:**

1. Скопировать `site/` (или собрать отдельную сборку), в `config.js` поставить `REGION`, `MESSENGER`, `DISPATCH_WHATSAPP`, `SITE_NAME`, `DEFAULT_CITY`.
2. Поднять бэкенд в стране: самый короткий путь — self-hosted Supabase (Docker) и прогон `supabase/all_in_one.sql`;
   тогда `backend-supabase.js` работает без изменений, меняются только `SUPABASE_URL` и ключ.
   Если в стране нужен другой стек — написать `backend-<имя>.js` по контракту выше.
3. Справочники (города, услуги, марки) — свои для страны (`02_seed.sql`, `js/seed.js`).
4. Вход: для РФ/США добавить провайдера входа (OAuth) в бэкенде; интерфейс вызывает только `api.login*`.
5. Оплату тарифов (Про, Магазин) подключать через провайдера страны на сервере (webhook → отметка тарифа в базе).

## 4. Связь с «Учёт + Магазин»

Встроенная витрина (`shop.html`) — лёгкая: товары, остатки, корзина, заказ в WhatsApp. Полная система
«Учёт + Магазин» (Next.js + Prisma: склад, кассы, налоги, Kaspi-выгрузка) — отдельное приложение.
Варианты связи, от простого к сложному:

1. **Ссылка**: у магазина в визитке `store_url` = адрес его «Учёт + Магазин». Работает уже сейчас.
2. **Выгрузка товаров**: «Учёт + Магазин» по расписанию отправляет каталог в `am_products` (service-ключ на сервере,
   сопоставление по `provider_id`), визитка показывает актуальные цены и остатки.
3. **Общий владелец**: вход через тот же Telegram-аккаунт в обеих системах, `owner_id` один; заказы из витрины
   пишутся в «Учёт + Магазин» как продажи (webhook из `am_create_lead`).
