// ============================================================
//  РЕГИОН: страна, валюта, формат телефона, карты, оплата, мессенджер.
//  Интерфейс не знает, в какой стране работает сервис, — он берёт всё отсюда.
//  Сменить страну = поменять CONFIG.REGION (config.js). Как переносить бэкенд — docs/ARCHITECTURE.md.
// ============================================================
import { CONFIG } from './config.js';

const enc = encodeURIComponent;
export const REGIONS = {
  KZ: {
    code: 'KZ', country: 'Казахстан', lang: 'ru', locale: 'ru-RU', currency: 'KZT', symbol: '₸', tz: 'Asia/Almaty',
    phone: { cc: '7', len: 11, re: /^7\d{10}$/, placeholder: '+7 7XX XXX XX XX', example: '+7 000 000 00 00', fix: (d) => d.replace(/^8(?=\d{10}$)/, '7') },
    maps: { name: '2ГИС', search: (q) => `https://2gis.kz/search/${enc(q)}`, point: (lat, lon) => `https://2gis.kz/geo/${lon},${lat}`,
      alt: { name: 'Google Maps', search: (q) => `https://www.google.com/maps/search/?api=1&query=${enc(q)}`, point: (lat, lon) => `https://www.google.com/maps?q=${lat},${lon}` } },
    payments: [['kaspi', 'Kaspi перевод / Kaspi QR'], ['cash', 'Наличные'], ['card', 'Безнал / карта']],
    messenger: 'whatsapp', backend: 'supabase', law: 'Закон РК «О персональных данных и их защите»',
  },
  RU: {
    code: 'RU', country: 'Россия', lang: 'ru', locale: 'ru-RU', currency: 'RUB', symbol: '₽', tz: 'Europe/Moscow',
    phone: { cc: '7', len: 11, re: /^7\d{10}$/, placeholder: '+7 9XX XXX XX XX', example: '+7 000 000 00 00', fix: (d) => d.replace(/^8(?=\d{10}$)/, '7') },
    maps: { name: 'Яндекс Карты', search: (q) => `https://yandex.ru/maps/?text=${enc(q)}`, point: (lat, lon) => `https://yandex.ru/maps/?pt=${lon},${lat}&z=16&l=map`,
      alt: { name: '2ГИС', search: (q) => `https://2gis.ru/search/${enc(q)}`, point: (lat, lon) => `https://2gis.ru/geo/${lon},${lat}` } },
    payments: [['sbp', 'СБП (перевод по номеру)'], ['cash', 'Наличные'], ['card', 'Карта']],
    messenger: 'telegram', backend: 'supabase-selfhost-ru', law: '152-ФЗ «О персональных данных»',
  },
  US: {
    code: 'US', country: 'USA', lang: 'en', locale: 'en-US', currency: 'USD', symbol: '$', tz: 'America/New_York',
    phone: { cc: '1', len: 11, re: /^1\d{10}$/, placeholder: '+1 (555) 123-4567', example: '+1 555 123 4567', fix: (d) => (d.length === 10 ? '1' + d : d) },
    maps: { name: 'Google Maps', search: (q) => `https://www.google.com/maps/search/?api=1&query=${enc(q)}`, point: (lat, lon) => `https://www.google.com/maps?q=${lat},${lon}`,
      alt: { name: 'Apple Maps', search: (q) => `https://maps.apple.com/?q=${enc(q)}`, point: (lat, lon) => `https://maps.apple.com/?ll=${lat},${lon}` } },
    payments: [['card', 'Card (Stripe)'], ['cash', 'Cash'], ['zelle', 'Zelle / Venmo']],
    messenger: 'sms', backend: 'supabase', law: 'CCPA / state privacy laws, TCPA for SMS',
  },
};
export const REGION = REGIONS[CONFIG.REGION] || REGIONS.KZ;

// Телефон → только цифры в международном формате (без +), или '' если не похоже на номер страны
export function normPhone(p, R = REGION) {
  let d = String(p || '').replace(/\D/g, '');
  if (!d) return '';
  d = R.phone.fix(d);
  return d;
}
export const validPhone = (p, R = REGION) => R.phone.re.test(normPhone(p, R));
export function fmtPhone(p, R = REGION) {
  const d = normPhone(p, R);
  if (R.phone.cc === '7' && d.length === 11) return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
  if (R.phone.cc === '1' && d.length === 11) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return d ? '+' + d : '';
}
export const money = (n, R = REGION) => n == null || n === '' ? '—' : Number(n).toLocaleString(R.locale) + ' ' + R.symbol;
export const mapSearch = (...parts) => REGION.maps.search(parts.filter(Boolean).join(', '));
export const mapPoint = (lat, lon) => REGION.maps.point(lat, lon);
