// Визитки: QR-код (библиотека qrcode.js из ВЕЗУ, MIT), PNG для печати, vCard «В контакты», ссылки.
import { fmtPhone, normPhone } from './region.js';

let loading = null;
export function loadQr() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  return loading || (loading = new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = new URL('./vendor/qrcode.js', import.meta.url).href;
    s.onload = () => ok(window.qrcode); s.onerror = () => no(new Error('QR-код не загрузился')); document.head.appendChild(s);
  }));
}
async function matrix(text) { const qr = await loadQr(); const q = qr(0, 'M'); q.addData(String(text), 'Byte'); q.make(); return q; }
export async function qrSvg(text, { size = 220, dark = '#111', light = '#fff', label = 'QR-код' } = {}) {
  const q = await matrix(text), n = q.getModuleCount(); let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + 2},${r + 2}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 4} ${n + 4}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="${label}"><rect width="100%" height="100%" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
export async function qrPng(text, { size = 1024, title = '', sub = '' } = {}) {
  const q = await matrix(text), n = q.getModuleCount(), pad = Math.round(size * 0.08), cell = Math.floor((size - pad * 2) / n);
  const extra = title ? Math.round(size * 0.2) : 0;
  const cv = document.createElement('canvas'); cv.width = size; cv.height = size + extra; const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#111';
  const off = Math.round((size - cell * n) / 2);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect(off + c * cell, off + r * cell, cell, cell);
  if (title) { g.textAlign = 'center'; g.font = `800 ${Math.round(size * 0.06)}px Manrope, sans-serif`; g.fillText(title.slice(0, 32), size / 2, size + extra * 0.42);
    if (sub) { g.font = `600 ${Math.round(size * 0.04)}px Manrope, sans-serif`; g.fillStyle = '#555'; g.fillText(sub.slice(0, 48), size / 2, size + extra * 0.8); } }
  return cv.toDataURL('image/png');
}
export function download(name, href) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
export function vcard(p, url) {
  const ph = normPhone(p.phone || p.whatsapp); const e = (s) => String(s || '').replace(/[,;\\]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const v = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${e(p.name)}`, `ORG:${e(p.name)}`, ph && `TEL;TYPE=CELL:+${ph}`, p.address && `ADR;TYPE=WORK:;;${e(p.address)};${e(p.city)};;;`, url && `URL:${url}`, p.about && `NOTE:${e(p.about.slice(0, 300))}`, 'END:VCARD'].filter(Boolean).join('\r\n');
  return URL.createObjectURL(new Blob([v], { type: 'text/vcard;charset=utf-8' }));
}
export async function share(title, url, toast) {
  try { if (navigator.share) { await navigator.share({ title, url }); return; } await navigator.clipboard.writeText(url); toast?.('Ссылка скопирована'); }
  catch { /* отмена */ }
}
export const baseUrl = () => location.origin + location.pathname.replace(/[^/]*$/, '');
export const cardUrl = (id) => `${baseUrl()}card.html?id=${+id}`;
const ext = (p) => !!(p && p.store_url && /^https:\/\//.test(p.store_url));
// витрина здесь (shop_enabled) важнее внешней ссылки; внешний сайт «Учёт + Магазин» — если своей витрины нет
export const shopUrl = (p) => (!p.shop_enabled && ext(p) ? p.store_url : `${baseUrl()}shop.html?id=${+p.id}`);
export const hasShop = (p) => !!(p && (p.shop_enabled || ext(p)));
export const isExternalShop = (p) => !!(p && !p.shop_enabled && ext(p));
export const externalStore = (p) => (ext(p) ? p.store_url : '');
export { fmtPhone };
