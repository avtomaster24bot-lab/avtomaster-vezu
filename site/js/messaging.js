// ============================================================
//  МЕССЕНДЖЕРЫ: как заявка/заказ доходит до владельца.
//  Сейчас основной канал — WhatsApp (wa.me с готовым текстом). Telegram и SMS — те же функции,
//  другой адрес. Добавить канал = добавить объект в CHANNELS (см. docs/ARCHITECTURE.md).
// ============================================================
import { REGION, normPhone, fmtPhone, money } from './region.js';
import { CONFIG } from './config.js';

export const CHANNELS = {
  whatsapp: {
    id: 'whatsapp', label: 'WhatsApp', icon: '💬',
    // https://wa.me/<номер>?text=<текст> — открывает чат с владельцем и готовым сообщением (телефон и компьютер)
    link: (to, text) => { const d = normPhone(to); return d ? `https://wa.me/${d}${text ? '?text=' + encodeURIComponent(text) : ''}` : ''; },
  },
  telegram: {
    id: 'telegram', label: 'Telegram', icon: '✈️',
    // username — откроет чат (текст Telegram в ссылку на чат не подставляет, поэтому даём «Поделиться» с текстом)
    link: (to, text) => { const u = String(to || '').replace(/^@/, '').replace(/^https?:\/\/t\.me\//, ''); return u ? `https://t.me/${u}` : `https://t.me/share/url?url=&text=${encodeURIComponent(text || '')}`; },
  },
  sms: { id: 'sms', label: 'SMS', icon: '✉️', link: (to, text) => { const d = normPhone(to); return d ? `sms:+${d}${text ? '?body=' + encodeURIComponent(text) : ''}` : ''; } },
};
export const channel = (id) => CHANNELS[id] || CHANNELS.whatsapp;
// Главный канал для заявок (по умолчанию WhatsApp; регион может предложить другой — CONFIG.MESSENGER перекрывает)
export const PRIMARY = channel(CONFIG.MESSENGER || 'whatsapp');
// Куда писать, если исполнитель не выбран: диспетчер сервиса
export const dispatcherPhone = () => CONFIG.DISPATCH_WHATSAPP || '';
export const ownerContact = (p) => (p && (p.whatsapp || p.phone)) || '';
export const sendLink = (to, text, ch = PRIMARY) => ch.link(to, text);

// ---------- тексты сообщений (одинаковые для сайта, визиток и магазина) ----------
const line = (k, v) => (v == null || v === '' || (Array.isArray(v) && !v.length) ? '' : `${k}: ${Array.isArray(v) ? v.join(', ') : v}\n`);
export function requestText({ title, provider, fields = [], customer = {}, id, url, site = CONFIG.SITE_NAME }) {
  let s = `Здравствуйте${provider?.name ? ', ' + provider.name : ''}! 👋\n`;
  s += `Новая заявка${id ? ' №' + id : ''} с ${site}: *${title}*\n\n`;
  for (const [k, v] of fields) s += line(k, v);
  if (customer.name || customer.phone) s += `\n👤 ${[customer.name, customer.phone && fmtPhone(customer.phone)].filter(Boolean).join(', ')}\n`;
  if (url) s += `\n🔗 ${url}\n`;
  return s.trim();
}
export function orderText({ shop, items, total, customer = {}, delivery, address, payment, comment, id, url }) {
  let s = `Здравствуйте, ${shop?.name || 'магазин'}! 🛍\nЗаказ${id ? ' №' + id : ''} с витрины ${CONFIG.SITE_NAME}:\n\n`;
  items.forEach((x, i) => { s += `${i + 1}. ${x.name}${x.sku ? ' (' + x.sku + ')' : ''} — ${x.qty} × ${money(x.price)} = ${money(x.qty * x.price)}\n`; });
  s += `\nИтого: *${money(total)}*\n`;
  s += line('Получение', delivery) + line('Адрес', address) + line('Оплата', payment) + line('Комментарий', comment);
  if (customer.name || customer.phone) s += `👤 ${[customer.name, customer.phone && fmtPhone(customer.phone)].filter(Boolean).join(', ')}\n`;
  if (url) s += `\n🔗 ${url}\n`;
  return s.trim();
}
export { REGION };
