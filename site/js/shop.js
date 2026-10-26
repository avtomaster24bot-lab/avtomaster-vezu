// Витрина магазина: shop.html?id=N — товары организации N (магазин привязан к владельцу визитки).
// Корзина хранится в браузере, заказ уходит владельцу в WhatsApp и сохраняется у него в кабинете (вкладка «WhatsApp»).
import { CONFIG } from './config.js';
import { api, IS_DEMO, FORCED_DEMO, leaveDemo } from './api.js';
import { SHOP_DELIVERY } from './consts.js';
import { REGION, money, mapSearch, validPhone } from './region.js';
import { PRIMARY, sendLink, orderText, ownerContact } from './messaging.js';
import { cardUrl, externalStore } from './cardkit.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 2600); };
const GRAD = [['#c026d3', '#701a75'], ['#2563eb', '#1e1b4b'], ['#65a30d', '#14532d'], ['#ea580c', '#7c2d12'], ['#0891b2', '#164e63'], ['#ca8a04', '#713f12'], ['#e11d48', '#4c0519'], ['#7c3aed', '#2e1065']];
const ICON = { 'Масла и жидкости': '🛢', 'Фильтры': '🧩', 'Тормоза': '🛑', 'Свет': '💡', 'Аккумуляторы': '🔋', 'Аксессуары': '🧰' };
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const ph = (x, big) => { const [a, b] = GRAD[hash(x.category || x.name) % GRAD.length];
  return `<div class="sh-ph" style="background:linear-gradient(135deg,${a},${b})">${x.stock != null && x.stock > 0 && x.stock <= 5 ? `<span class="sh-badge">Осталось ${x.stock} шт.</span>` : x.stock === 0 ? '<span class="sh-badge">Нет в наличии</span>' : ''}
    ${x.photo ? `<img src="${esc(x.photo)}" alt="${esc(x.name)}" loading="lazy">` : `${big ? '' : `<span class="nm">${esc(x.name)}</span>`}<span class="ico">${ICON[x.category] || '📦'}</span>`}</div>`; };

const id = +new URLSearchParams(location.search).get('id');
const CK = `am24-cart-${id}`;
const S = { p: null, items: [], cat: '', q: '', sort: 'new', caps: {} };
const cart = () => { try { return JSON.parse(localStorage.getItem(CK)) || {}; } catch { return {}; } };
const setCart = (c) => { localStorage.setItem(CK, JSON.stringify(c)); badge(); };
const lines = () => Object.entries(cart()).map(([pid, qty]) => ({ ...S.items.find((x) => x.id === +pid), qty })).filter((x) => x.name && x.qty > 0);
const total = () => lines().reduce((s, x) => s + x.qty * x.price, 0);
function badge() { const n = lines().reduce((s, x) => s + x.qty, 0); $('#cartN').textContent = n; $('#cartN').hidden = !n; }
function add(pid, d = 1) { const c = cart(); const x = S.items.find((i) => i.id === +pid); const max = x?.stock ?? 999; c[pid] = Math.max(0, Math.min(max, (c[pid] || 0) + d)); if (!c[pid]) delete c[pid]; setCart(c); }

async function main() {
  if (IS_DEMO) { const bar = $('#demoBar'); bar.hidden = false; bar.innerHTML = `<b>ДЕМО</b><span>магазин и товары вымышленные, заказ уйдёт на демо-номер.</span>${FORCED_DEMO ? '<button data-leave>Выйти из демо</button>' : ''}`;
    const lv = $('[data-leave]', bar); if (lv) lv.onclick = () => { leaveDemo(); location.href = './'; }; }
  try { if (!id) throw 0; [S.p, S.caps] = await Promise.all([api.getProvider(id), api.caps().catch(() => ({}))]); } catch { $('#shop').innerHTML = `<h1 class="sh-h1">Магазин не найден</h1><p class="sh-muted">Ссылка неполная или витрину отключили.${IS_DEMO ? '' : ' Пример витрины — <a href="shop.html?id=8&demo=1">в демо</a>.'}</p><p><a class="btn ink" href="./">На главную</a></p>`; return; }
  const p = S.p, c = p.card || {};
  document.title = `${c.shop_title || p.name} — магазин`;
  if (c.shop_accent) document.documentElement.style.setProperty('--accent', c.shop_accent);
  $('#brand').innerHTML = `${esc(c.shop_title || p.name)}<span>.</span>`; $('#brand').href = location.href.replace(/#.*$/, '');
  $('#backCard').href = cardUrl(p.id);
  const ext = externalStore(p);
  if (!p.shop_enabled) {
    $('#shop').innerHTML = `<section class="sh-hero"><div><div class="sh-eyebrow">${esc(p.city)}</div><h1 class="sh-h1">${esc(p.name)}</h1>
      ${ext ? `<p>Магазин этой организации находится на отдельном сайте «Учёт + Магазин».</p><a class="btn ink" href="${esc(ext)}" target="_blank" rel="noopener">Перейти в магазин →</a>` : '<p class="sh-muted">Витрина пока не включена владельцем.</p>'}
      <a class="btn" href="${esc(cardUrl(p.id))}">🪪 Визитка</a></div></section>`;
    return;
  }
  S.items = S.caps.v4 ? await api.shopProducts(p.id) : [];
  $('#foot').innerHTML = `<b style="color:#fff">${esc(c.shop_title || p.name)}</b> · ${esc(p.city)}${p.address ? ', ' + esc(p.address) : ''}${ownerContact(p) ? ` · <a href="${esc(sendLink(ownerContact(p), 'Здравствуйте! Вопрос по товару из вашего магазина:'))}" target="_blank" rel="noopener">${PRIMARY.label}</a>` : ''}
    <br>Витрина работает на <a href="./">${esc(CONFIG.SITE_NAME)}</a>. Нужен полный магазин со складом, налогами 910 и Kaspi — <a href="https://biznes-shablon.vercel.app/prezentaciya#3" target="_blank" rel="noopener">«Учёт + Магазин»</a>.`;
  $('#searchF').onsubmit = (e) => { e.preventDefault(); S.q = $('#q').value.trim(); draw(); };
  $('#q').oninput = () => { S.q = $('#q').value.trim(); draw(); };
  $('#cartBtn').onclick = openCart;
  $('#drawer').onclick = (e) => { if (e.target.id === 'drawer') $('#drawer').hidden = true; };
  badge(); draw();
}
function draw() {
  const p = S.p, c = p.card || {};
  const cats = [...new Set(S.items.map((x) => x.category).filter(Boolean))];
  $('#topCats').innerHTML = cats.slice(0, 6).map((k) => `<a href="#" data-cat="${esc(k)}" class="${S.cat === k ? 'on' : ''}">${esc(k)}</a>`).join('');
  let list = S.items.filter((x) => (!S.cat || x.category === S.cat) && (!S.q || (x.name + ' ' + (x.sku || '') + ' ' + (x.category || '')).toLowerCase().includes(S.q.toLowerCase())));
  list = list.sort(S.sort === 'cheap' ? (a, b) => a.price - b.price : S.sort === 'dear' ? (a, b) => b.price - a.price : (a, b) => b.id - a.id);
  $('#shop').innerHTML = `<section class="sh-hero"><div><div class="sh-eyebrow">Интернет-магазин · ${esc(p.city)}</div><h1 class="sh-h1">${esc(c.shop_title || p.name)}</h1>
    <p class="sh-muted">${esc(p.about || c.slogan || 'Выберите товары, положите в корзину и отправьте заказ — магазин ответит в ' + PRIMARY.label + '.')}</p>
    <div class="sh-info">${p.address ? `<a class="btn sm" href="${esc(mapSearch(p.city, p.address))}" target="_blank" rel="noopener">📍 ${esc(p.address)}</a>` : ''}${p.working_hours ? `<span class="btn sm">🕘 ${esc(p.working_hours)}</span>` : ''}${p.delivery ? '<span class="btn sm">🚚 Доставка</span>' : ''}
    ${externalStore(p) ? `<a class="btn sm ink" href="${esc(externalStore(p))}" target="_blank" rel="noopener">Полный магазин →</a>` : ''}</div></div>
    <div class="sh-heroimg" style="background-image:url('${esc(p.photos?.[0] || 'assets/img/parts.webp')}')"></div></section>
  <div class="sh-layout"><aside class="sh-side"><h4>Категории</h4><a href="#" data-cat="" class="${S.cat ? '' : 'on'}">Все товары</a>${cats.map((k) => `<a href="#" data-cat="${esc(k)}" class="${S.cat === k ? 'on' : ''}">${esc(k)}</a>`).join('')}
    <h4>Сортировка</h4><div class="sh-sort">${[['new', 'Новые'], ['cheap', 'Дешевле'], ['dear', 'Дороже']].map(([k, t]) => `<button data-sort="${k}" class="${S.sort === k ? 'on' : ''}">${t}</button>`).join('')}</div></aside>
  <section><h2 class="sh-h1" style="font-size:34px">${S.cat ? esc(S.cat) : 'Каталог'}</h2><p class="sh-muted">Найдено: ${list.length}</p>
    <div class="sh-grid">${list.map((x) => `<div class="sh-card"><button class="sh-card" data-open="${x.id}" aria-label="${esc(x.name)}">${ph(x)}<div class="sh-pr"><b>${esc(x.name)}</b><span>${money(x.price)}</span></div></button>
      <div class="sh-cat">${esc(x.category || '')}${x.sku ? ' · ' + esc(x.sku) : ''}</div><button class="btn sm ink sh-add" data-add="${x.id}" ${x.stock === 0 ? 'disabled' : ''}>В корзину</button></div>`).join('') || '<p class="sh-muted">Ничего не нашли.</p>'}</div></section></div>`;
  $$('[data-cat]').forEach((a) => a.onclick = (e) => { e.preventDefault(); S.cat = a.dataset.cat; draw(); });
  $$('[data-sort]').forEach((b) => b.onclick = () => { S.sort = b.dataset.sort; draw(); });
  $$('[data-add]').forEach((b) => b.onclick = () => { add(b.dataset.add); toast('Добавлено в корзину'); });
  $$('[data-open]').forEach((b) => b.onclick = () => product(+b.dataset.open));
}
function product(pid) {
  const x = S.items.find((i) => i.id === pid); if (!x) return;
  const d = document.createElement('div'); d.className = 'sh-modal'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', x.name);
  d.innerHTML = `<div class="sh-modal-in"><div>${ph(x, true)}</div><div><button class="sh-x" aria-label="Закрыть">✕</button><div class="sh-cat">${esc(x.category || '')} · ${esc(x.sku || '')}</div><h2>${esc(x.name)}</h2>
    <div class="sh-total"><span>${money(x.price)}</span></div><p class="sh-muted">${esc(x.description || '')}</p>${x.stock != null ? `<p class="sh-muted">В наличии: ${x.stock} шт.</p>` : ''}
    <button class="btn ink block" id="mAdd" ${x.stock === 0 ? 'disabled' : ''}>В корзину</button></div></div>`;
  document.body.appendChild(d); d.onclick = (e) => { if (e.target === d || e.target.closest('.sh-x')) d.remove(); };
  $('#mAdd', d).onclick = () => { add(x.id); d.remove(); openCart(); };
}
function openCart() {
  const L = lines(), p = S.p; $('#drawer').hidden = false;
  $('#cart').innerHTML = `<button class="sh-x" id="cX" aria-label="Закрыть">✕</button><h2 style="margin-top:0">Корзина</h2>
  ${L.length ? `${L.map((x) => `<div class="sh-line"><div><b>${esc(x.name)}</b><div class="sh-cat">${money(x.price)} × ${x.qty}</div></div><div class="qty"><button data-q="${x.id}:-1" aria-label="Меньше">−</button><b>${x.qty}</b><button data-q="${x.id}:1" aria-label="Больше">+</button></div></div>`).join('')}
  <div class="sh-total"><span>Итого</span><span>${money(total())}</span></div>
  <form id="checkout"><h3>Оформление</h3><label>Ваше имя</label><input name="name" required autocomplete="name" maxlength="80"><label>Телефон</label><input name="phone" type="tel" required autocomplete="tel" placeholder="${esc(REGION.phone.placeholder)}">
    <label>Получение</label>${radio('delivery', SHOP_DELIVERY, SHOP_DELIVERY[0])}<div id="addrBox" hidden><label>Адрес доставки</label><input name="address" maxlength="200"></div>
    <label>Оплата</label>${radio('payment', REGION.payments.map(([, t]) => t), REGION.payments[0][1])}<label>Комментарий</label><textarea name="comment" rows="2" maxlength="500"></textarea>
    <button class="btn wa block" style="margin-top:14px">${PRIMARY.icon} Отправить заказ в ${PRIMARY.label}</button>
    <p class="sh-muted" style="font-size:12.5px">Откроется ${PRIMARY.label} магазина с готовым заказом. Оплата и доставка — по договорённости с магазином${REGION.code === 'KZ' ? ' (Kaspi перевод, наличные)' : ''}.</p><div id="done"></div></form>`
    : '<p class="sh-muted">Корзина пуста.</p><button class="btn ink" id="cX2">Смотреть товары</button>'}`;
  $('#cX').onclick = () => { $('#drawer').hidden = true; }; const x2 = $('#cX2'); if (x2) x2.onclick = () => { $('#drawer').hidden = true; };
  $$('[data-q]').forEach((b) => b.onclick = () => { const [i, d] = b.dataset.q.split(':'); add(i, +d); openCart(); });
  const f = $('#checkout'); if (!f) return;
  $$('[name=delivery]', f).forEach((r) => r.onchange = () => { $('#addrBox').hidden = f.delivery.value === SHOP_DELIVERY[0]; });
  f.onsubmit = (e) => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(f));
    if (!validPhone(d.phone)) return toast(`Телефон в формате ${REGION.phone.placeholder}`);
    if (d.delivery !== SHOP_DELIVERY[0] && !d.address) return toast('Укажите адрес доставки');
    const items = lines().map((x) => ({ id: x.id, sku: x.sku, name: x.name, price: x.price, qty: x.qty })), sum = total();
    const text = orderText({ shop: { name: p.card?.shop_title || p.name }, items, total: sum, customer: { name: d.name, phone: d.phone }, delivery: d.delivery, address: d.address, payment: d.payment, comment: d.comment });
    const link = sendLink(ownerContact(p), text);
    if (!link) return toast(`У магазина не указан ${PRIMARY.label}`);
    window.open(link, '_blank', 'noopener');
    $('#done').innerHTML = `<div class="sh-note">✅ Заказ сформирован — открываем ${PRIMARY.label}. Не открылся? <a class="btn sm wa" id="waOrder" href="${esc(link)}" target="_blank" rel="noopener">Открыть ещё раз</a></div>`;
    if (S.caps.v4) api.createLead({ provider_id: p.id, kind: 'order', source: 'shop', customer_name: d.name, customer_phone: d.phone, message: text, payload: { items, delivery: d.delivery, address: d.address || '', payment: d.payment }, total: sum })
      .then((n) => { $('#done').insertAdjacentHTML('beforeend', `<p class="sh-muted">Заказ №${n} сохранён у магазина.</p>`); localStorage.removeItem(CK); badge(); }).catch(() => {});
  };
}
const radio = (name, list, sel) => `<div class="opts">${list.map((t) => `<label class="opt"><input type="radio" name="${name}" value="${esc(t)}" ${t === sel ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>`;
main();
