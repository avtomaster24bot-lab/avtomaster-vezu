// Заказ = заявка с визитки/магазина/сайта + чат на сайте (order.html). WhatsApp — уведомление со ссылкой на чат.
import { api } from './api.js';
import { sendLink } from './messaging.js';
import { baseUrl } from './cardkit.js';

export const ownerOrderUrl = (id) => `${baseUrl()}order.html?id=${+id}&as=owner`;
export const orderUrl = (id, token) => `${baseUrl()}order.html?id=${+id}${token ? '&t=' + encodeURIComponent(token) : ''}`;
const MKEY = 'am24-my-orders';
export const myOrders = () => { try { return JSON.parse(localStorage.getItem(MKEY)) || []; } catch { return []; } };
export function rememberOrder(o) {
  const L = myOrders().filter((x) => !(x.id === o.id && x.demo === o.demo));
  L.unshift(o); localStorage.setItem(MKEY, JSON.stringify(L.slice(0, 50)));
}
export const forgetOrder = (id) => localStorage.setItem(MKEY, JSON.stringify(myOrders().filter((x) => x.id !== +id)));

// Вызывать СИНХРОННО из обработчика нажатия: окно открывается сразу (иначе браузер заблокирует),
// а адрес WhatsApp подставляется, когда заказ создан и есть ссылка на чат.
export function startOrder(args) {
  let w = null;
  try { w = window.open('', '_blank'); if (w) w.opener = null; } catch { w = null; }
  const go = (link) => { if (!w) return; if (link) w.location.href = link; else try { w.close(); } catch { /* ignore */ } };
  return (async () => {
    const { to, text, lead, title, providerName, demo } = typeof args === 'function' ? await args() : args;
    const caps = await api.caps().catch(() => ({}));
    let o = null;
    try {
      if (caps.v5) o = await api.createOrder(lead);
      else if (caps.v4) await api.createLead(lead).catch(() => null);
    } catch (e) { go(to ? sendLink(to, text) : ''); throw e; }
    const full = o ? `${text}\n\n💬 Чат по заявке №${o.id} на сайте (ответить клиенту, предложить цену):\n${ownerOrderUrl(o.id)}` : text;
    const link = to ? sendLink(to, full) : '';
    go(link);
    if (o && link) try { sessionStorage.setItem('am24-last-wa-' + o.id, link); } catch { /* ignore */ }
    if (o) rememberOrder({ id: o.id, token: o.token, title, provider: providerName || '', created_at: new Date().toISOString(), demo: !!demo });
    return { ...(o || {}), link, chatUrl: o ? orderUrl(o.id, o.token) : null, opened: !!w, to, text };
  })().catch((e) => { try { if (w && !w.closed && w.location.href === 'about:blank') w.close(); } catch { /* ignore */ } throw e; });
}
