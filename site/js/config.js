// ============================================================
//  НАСТРОЙКИ САЙТА АвтоМастер24 — меняйте только этот файл
// ============================================================
// Здесь только ПУБЛИЧНЫЕ данные. Токен бота и service_role ключ сюда НЕ вставлять никогда!
// Сайт сам проверяет базу: если таблицы am_* в Supabase ещё не созданы — работает ДЕМО-режим
// (всё кликается, данные хранятся только в этом браузере).
export const CONFIG = {
  SITE_NAME: 'АвтоМастер24',
  // Подпись «какой это сайт» — на кнопке входа, в кабинете и админке (на том же домене есть старый сайт АвтоМастер24)
  SITE_LABEL: 'АвтоМастер24 + ВЕЗУ',
  SITE_TAGLINE: 'СТО, эвакуатор, мойка, запчасти, выездные мастера и грузоперевозки — в одном месте',

  // Supabase: проект VEZU (общий с сайтом ВЕЗУ; наши объекты — только am_*). anon-ключ публичный, защита — RLS в базе.
  SUPABASE_URL: 'https://sfgrwquitlnzlkyzashb.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZ3J3cXVpdGxuemxreXphc2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMjUzODgsImV4cCI6MjEwODYwMTM4OH0.ZbGQavzc2Zlj0J1Ip-kQP2J4YNWNTGZI1YkPNMzhPQo',

  // Вход через Telegram: функция проверки подписи и бот, токеном которого она проверяет подпись.
  // Функция am-telegram-auth (проект VEZU). Без секрета подпись виджета проверяет та же функция, что и на старом
  // сайте (бот @VeloMaster24bot, домен уже привязан). Права и профиль — только в базе VEZU (am_profiles).
  // Если когда-нибудь задать секрет TELEGRAM_BOT_TOKEN другого бота — поменяйте здесь TELEGRAM_LOGIN_BOT на него.
  TELEGRAM_AUTH_URL: 'https://sfgrwquitlnzlkyzashb.supabase.co/functions/v1/am-telegram-auth',
  TELEGRAM_LOGIN_BOT: 'VeloMaster24bot',

  // Основной Telegram-бот сервиса (кнопка «Открыть бота»)
  TELEGRAM_BOT: 'TochkaSborki_A24_bot',

  DEFAULT_CITY: 'Талдыкорган',

  // Регион: KZ (сейчас), RU, US — валюта, телефоны, карты, оплата (js/region.js). Перенос по странам — docs/ARCHITECTURE.md
  REGION: 'KZ',
  // Канал, куда уходят заявки и заказы владельцу: whatsapp (сейчас), telegram, sms (js/messaging.js)
  MESSENGER: 'whatsapp',
  // WhatsApp диспетчера: сюда уходит заявка, если клиент не выбрал исполнителя (номер ВЕЗУ из dogruz/js/common.js)
  DISPATCH_WHATSAPP: '77714105797',

  FORCE_DEMO: false,          // true — всегда демо-режим
  REFRESH_SECONDS: 20,        // как часто обновлять ленту заявок у исполнителя
};
