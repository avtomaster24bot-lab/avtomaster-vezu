import { CONFIG } from './config.js';
import { api, IS_DEMO, FORCED_DEMO, leaveDemo } from './api.js';
import { KINDS, URGENT, SUPPLIER, TOW_VEHICLES, WHEELS, WASH_SERVICES, CAR_TYPES, PARTS_URGENCY, PARTS_ORIG, PARTS_DELIVERY, STATUS, effStatus,
  CARD_ROLE, CARGO_SERVICES, CARGO_VEHICLES, CARGO_WHEN, CARGO_EXTRAS, LEAD_STATUS } from './consts.js';
import { REGION, money as rMoney, mapSearch, mapPoint, fmtPhone, validPhone } from './region.js';
import { PRIMARY, sendLink, requestText, ownerContact, dispatcherPhone } from './messaging.js';
import { startOrder, orderUrl, ownerOrderUrl, myOrders } from './orders.js';
import { ic, KIND_IC } from './icons.js';
import { qrSvg, qrPng, download, cardUrl, shopUrl, hasShop, isExternalShop, share as shareLink } from './cardkit.js';

// ------------------------------------------------------------ утилиты
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => rMoney(n);
const dt = (s) => s ? new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const hm = (s) => new Date(s).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const stars = (r) => `<span class="stars" aria-label="Рейтинг ${Number(r || 0).toFixed(1)} из 5">${'★'.repeat(Math.round(r || 0))}${'☆'.repeat(5 - Math.round(r || 0))}</span>`;
const badge = (st) => { const [t, c] = STATUS[st] || [st, 'grey']; return `<span class="badge ${c}">${esc(t)}</span>`; };
const digits = (p) => String(p || '').replace(/[^\d+]/g, '');
const tel = (p) => p ? `<a class="btn sm" href="tel:${esc(digits(p))}">📞 ${esc(p)}</a>` : '';
const wa = (p, text = '', label = `${PRIMARY.icon} ${PRIMARY.label}`, cls = 'btn sm wa') => p && sendLink(p, text) ? `<a class="${cls}" target="_blank" rel="noopener" href="${esc(sendLink(p, text))}">${label}</a>` : '';
const tip = (t) => `<button type="button" class="tip" aria-label="Подсказка: ${esc(t)}" data-tip="${esc(t)}">?</button>`;
const opts = (name, list, sel, type = 'radio') => `<div class="opts">${list.map(([v, t]) => `<label class="opt"><input type="${type}" name="${name}" value="${esc(v)}" ${(Array.isArray(sel) ? sel.includes(v) : sel === v) ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>`;
const pairs = (arr) => arr.map((x) => [x, x]);
const mapUrl = (city, address) => mapSearch(city, address);
function toast(msg, err = false) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 3500); }
const formData = (f) => { const o = {}; for (const [k, v] of new FormData(f)) { if (v instanceof File) continue; o[k] = o[k] !== undefined ? [].concat(o[k], v) : v; } return o; };
async function act(btn, fn, okMsg) {
  if (btn) btn.disabled = true;
  try { await fn(); if (okMsg) toast(okMsg); await render(); } catch (e) { toast(e.message || String(e), true); } finally { if (btn) btn.disabled = false; }
}
const IMG = { sto: 'assets/img/sto.webp', tow: 'assets/img/tow.webp', wash: 'assets/img/wash.webp', parts: 'assets/img/parts.webp', urgent: 'assets/img/help.webp', cargo: 'assets/img/cargo.webp' };

// «Открыто сейчас» по строке вида 09:00-19:00 / Круглосуточно
function openNow(wh) {
  if (!wh) return null;
  if (/кругл|24\s*\/\s*7|24 часа/i.test(wh)) return true;
  const m = /(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/.exec(wh); if (!m) return null;
  const n = new Date(), t = n.getHours() * 60 + n.getMinutes(), a = +m[1] * 60 + +m[2], b = +m[3] * 60 + +m[4];
  return b > a ? t >= a && t < b : t >= a || t < b;
}
const openChip = (wh) => { const o = openNow(wh); return o == null ? '' : o ? '<span class="chip-s ok">● Открыто</span>' : '<span class="chip-s off">● Закрыто</span>'; };

// избранное — хранится в браузере
const favs = () => { try { return JSON.parse(localStorage.getItem('am24v-fav')) || []; } catch { return []; } };
const isFav = (id) => favs().includes(+id);
const toggleFav = (id) => { const f = favs(); const i = f.indexOf(+id); if (i >= 0) f.splice(i, 1); else f.push(+id); localStorage.setItem('am24v-fav', JSON.stringify(f)); return i < 0; };

// сжатие фото перед загрузкой
async function compress(file, max = IS_DEMO ? 900 : 1600, q = IS_DEMO ? 0.7 : 0.82) {
  if (!/^image\//.test(file.type)) throw new Error('Можно загрузить только фото');
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error('Не удалось открыть фото');
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob((b) => ok(b), 'image/jpeg', q));
}
const photoStrip = (paths, cls = '') => paths?.length ? `<div class="photos ${cls}" data-photos="${esc(JSON.stringify(paths))}">${paths.map(() => '<span class="ph sk"></span>').join('')}</div>` : '';
async function hydratePhotos(root) {
  for (const el of $$('[data-photos]', root)) {
    try {
      const urls = await api.photoUrls(JSON.parse(el.dataset.photos));
      el.innerHTML = urls.map((u, i) => u ? `<button type="button" class="ph" data-full="${esc(u)}" aria-label="Открыть фото ${i + 1}"><img src="${esc(u)}" alt="Фото ${i + 1}" loading="lazy"></button>` : '<span class="ph miss">нет доступа</span>').join('');
    } catch { el.innerHTML = '<span class="small muted">Фото недоступны</span>'; }
  }
}
function lightbox(src) {
  const d = document.createElement('div'); d.className = 'lightbox'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Фото');
  d.innerHTML = `<img src="${esc(src)}" alt="Фото"><button class="lb-x" aria-label="Закрыть">✕</button>`;
  d.onclick = () => d.remove(); document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { d.remove(); document.removeEventListener('keydown', k); } });
  document.body.appendChild(d); $('.lb-x', d).focus();
}

// ------------------------------------------------------------ состояние
const S = { ref: null, me: null, city: localStorage.getItem('am24v-city') || CONFIG.DEFAULT_CITY, myProv: [], timer: null, caps: { v3: false }, cleanups: [], installEvt: null };
const isAdmin = () => ['global_admin', 'regional_admin'].includes(S.me?.role);
const catName = (id) => S.ref.categories.find((c) => c.id === +id)?.name || '';
const siteUrl = () => location.origin + location.pathname;

async function boot() {
  try { window.Telegram?.WebApp?.ready(); window.Telegram?.WebApp?.expand(); } catch { /* ignore */ }
  applyTheme(localStorage.getItem('am24v-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  try { S.ref = await api.ref(); }
  catch (e) {
    $('#view').innerHTML = `<div class="card center"><div class="big-i">📡</div><h2>Не удалось загрузить данные</h2><p class="muted">${esc(e.message || e)}</p>
      <p class="small muted">Проверьте интернет. Если не помогло — сбросьте сохранённые данные сайта (вход и кэш), заказы в базе не пропадут.</p>
      <div class="row" style="justify-content:center"><button class="p" onclick="location.reload()">Повторить</button><button onclick="window.am24Reset&&am24Reset()">Сбросить и открыть заново</button></div></div>`;
    return;
  }
  try { S.caps = await api.caps(); } catch { S.caps = { v3: false }; }
  await refreshMe();
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  $('#citySel').addEventListener('change', (e) => { S.city = e.target.value; localStorage.setItem('am24v-city', S.city); render(); });
  $('#themeBtn').onclick = () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true);
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.tip'); $$('.tip.open').forEach((x) => x !== t && x.classList.remove('open')); if (t) { e.preventDefault(); t.classList.toggle('open'); }
    const ph = e.target.closest('[data-full]'); if (ph) lightbox(ph.dataset.full);
    const fv = e.target.closest('[data-fav]'); if (fv) { e.preventDefault(); const on = toggleFav(fv.dataset.fav); fv.classList.toggle('on', on); fv.setAttribute('aria-pressed', on); fv.textContent = on ? '♥' : '♡'; toast(on ? 'Добавлено в избранное' : 'Убрано из избранного'); }
  });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEvt = e; $$('[data-install]').forEach((b) => { b.hidden = false; }); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => r.update?.()).catch(() => {});
  render();
}
function applyTheme(t, save) { document.documentElement.dataset.theme = t; $('meta[name=theme-color]')?.setAttribute('content', t === 'light' ? '#F6F4EF' : '#0F0F0F'); $('#themeBtn').innerHTML = ic(t === 'light' ? 'moon' : 'sun'); $('#themeBtn').setAttribute('aria-label', t === 'light' ? 'Тёмная тема' : 'Светлая тема'); if (save) localStorage.setItem('am24v-theme', t); }
async function refreshMe() {
  try { S.me = await api.session(); } catch (e) { S.me = null; toast(e.message, true); }
  if (S.me?.city && !localStorage.getItem('am24v-city')) S.city = S.me.city;
  try { S.myProv = S.me ? await api.myProviders() : []; } catch { S.myProv = []; }
}

function chrome(route) {
  const cs = S.ref.cities.filter((c) => c.active || c.name === S.city);
  $('#citySel').innerHTML = cs.map((c) => `<option ${c.name === S.city ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  $('#meChip').textContent = S.me ? '👤 ' + (S.me.full_name || 'Профиль') : 'Войти';
  $('#meChip').href = S.me ? '#/profile' : '#/login';
  const bar = $('#demoBar');
  if (IS_DEMO) {
    bar.hidden = false;
    bar.innerHTML = `<b>ДЕМО</b><span>данные только в этом браузере, люди и организации вымышленные. Войти как:</span>
      <button data-demo="client">Клиент</button><button data-demo="master">Исполнитель</button><button data-demo="admin">Админ</button><button data-reset>Сбросить</button>${FORCED_DEMO ? '<button data-leave>Выйти из демо</button>' : ''}`;
    $$('[data-demo]', bar).forEach((b) => b.onclick = async () => { await api.loginDemo(b.dataset.demo); await refreshMe(); toast('Вы вошли: ' + S.me.full_name);
      location.hash = b.dataset.demo === 'master' ? '#/cabinet' : b.dataset.demo === 'admin' ? '#/admin' : '#/'; render(); });
    $('[data-reset]', bar).onclick = async () => { await api.resetDemo(); await refreshMe(); toast('Демо-данные сброшены'); render(); };
    const lv = $('[data-leave]', bar); if (lv) lv.onclick = () => { leaveDemo(); location.href = location.pathname + '#/'; location.reload(); };
  } else bar.hidden = true;
  const items = [['', 'home', 'Главная'], ['requests', 'list', 'Заявки'], ['catalog', 'search', 'Мастера'],
    S.myProv.length ? ['cabinet', 'wrench', 'Кабинет'] : ['garage', 'car', 'Гараж'], isAdmin() ? ['admin', 'shield', 'Админ'] : ['profile', 'user', 'Профиль']];
  $('#nav').innerHTML = items.map(([h, i, t]) => `<a href="#/${h}" class="${route === h ? 'on' : ''}" ${route === h ? 'aria-current="page"' : ''}><span aria-hidden="true">${ic(i)}</span>${t}</a>`).join('');
}

// ------------------------------------------------------------ роутер
const routes = { '': home, catalog, provider, new: newRequest, requests, request, chat, garage, prices, profile, login, business, cabinet, admin, tariffs };
const skeleton = () => `<div class="sk-wrap" aria-busy="true" aria-label="Загрузка"><div class="sk sk-h"></div><div class="sk sk-c"></div><div class="sk sk-c"></div><div class="sk sk-c short"></div></div>`;
let renderSeq = 0;
async function render() {
  clearInterval(S.timer); S.timer = null; S.cleanups.splice(0).forEach((f) => { try { f(); } catch { /* ignore */ } });
  const seq = ++renderSeq;
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const [name, arg] = path.split('/');
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  const fn = routes[name] || home;
  chrome(name in routes ? name : '');
  const v = $('#view');
  const same = S.lastHash === location.hash; S.lastHash = location.hash;
  const sk = same ? 0 : setTimeout(() => { if (seq === renderSeq) v.innerHTML = skeleton(); }, 250);
  try {
    const html = await fn(arg, q) || ''; clearTimeout(sk); if (seq !== renderSeq) return;
    v.innerHTML = html; fn.after?.(v, arg, q); hydratePhotos(v);
  } catch (e) { clearTimeout(sk); if (seq === renderSeq) v.innerHTML = `<div class="card"><h3>Ошибка</h3><p>${esc(e.message)}</p><a class="btn" href="#/">На главную</a></div>`; }
}
const needLogin = (what = 'этого действия') => `<div class="card center"><div class="big-i">🔐</div><h2>Нужно войти</h2><p class="muted">Для ${what} войдите через Telegram — это занимает 5 секунд. Телефон вы укажете сами, и его увидит только исполнитель, который возьмёт вашу заявку.</p><a class="btn p" href="#/login">Войти</a></div>`;
const autoRefresh = () => { S.timer = setInterval(() => { if (!document.hidden && !document.activeElement?.closest('form')) render(); }, CONFIG.REFRESH_SECONDS * 1000); };
const empty = (icon, text, cta = '', hint = '') => `<div class="empty"><div class="empty-i">${icon}</div><p>${text}</p>${hint ? `<p class="small muted">${hint}</p>` : ''}<div class="row" style="justify-content:center">${cta}</div></div>`;
const hint = (text) => `<div class="hint">${ic('bulb')}<span>${text}</span></div>`;
const HOW = {
  client: [['search', 'Опишите, что случилось', 'Выберите услугу или напишите своими словами: «стучит подвеска», «сел аккумулятор».'],
    ['chat', 'Мастера откликнутся', 'Заявку увидят подходящие исполнители города. Цену и детали уточните в чате на сайте.'],
    ['star', 'Сделано — оцените', 'После работы поставьте оценку: рейтинг помогает другим выбрать честного мастера.']],
  biz: [['idcard', 'Создайте визитку', 'Бесплатно за минуту: услуги, цены, фото, адрес и QR-код для клиентов.'],
    ['chat', 'Получайте заявки', `Заказы приходят в ${PRIMARY.label} и в кабинет, переписка и цена — в чате на сайте.`],
    ['star', 'Растите в рейтинге', 'Оценки клиентов поднимают визитку в каталоге. Магазину — витрина с корзиной.']],
};
const howBlock = () => `<section class="how" aria-labelledby="howH"><div class="row between"><h2 id="howH">Как это работает</h2>
  <div class="seg" role="tablist"><button type="button" role="tab" class="on" aria-selected="true" data-how="client">Клиентам</button><button type="button" role="tab" aria-selected="false" data-how="biz">Бизнесу</button></div></div>
  ${Object.entries(HOW).map(([k, steps]) => `<ol class="how-steps" data-how-panel="${k}" ${k === 'biz' ? 'hidden' : ''}>${steps.map(([i, h, s], n) => `<li><span class="how-i">${ic(i)}<b>${n + 1}</b></span><div><b>${h}</b><small>${s}</small></div></li>`).join('')}</ol>`).join('')}
  <div class="row how-cta"><a class="btn p" href="#/new/sto">${ic('plus')} Оставить заявку</a><a class="btn" href="#/business">${ic('idcard')} Визитка для бизнеса</a></div></section>`;

// ------------------------------------------------------------ умный поиск «что случилось?»
const KW = [
  ['tow', null, 'эваку дтп авари увез буксир не едет сломал заглох'],
  ['wash', null, 'мойк помыть мыть химчист полиров детейл грязн'],
  ['parts', null, 'запчаст купить фара бампер деталь разбор зеркал стекло фильтр'],
  ['urgent', 'locksmith', 'ключ замок закрыл захлоп вскры'],
  ['urgent', 'tire', 'колес прокол шина спустил балон шиномонтаж'],
  ['urgent', 'electrician', 'аккумулятор акб прикурить сел разряд'],
  ['urgent', 'delivery', 'перегон перегнать доставить машину'],
  ['cargo', null, 'груз перевез переезд газел грузчик вывоз мусор стройматериал мебел перевоз'],
];
const stem = (w) => w.length > 5 ? w.slice(0, w.length - 2) : w;
function suggest(text) {
  const words = (text || '').toLowerCase().split(/[^a-zа-яё0-9]+/i).filter((w) => w.length > 2).map(stem);
  if (!words.length) return [];
  const out = [];
  for (const [k, t, keys] of KW) if (words.some((w) => keys.split(' ').some((x) => x.startsWith(w) || w.startsWith(x))))
    out.push({ href: `#/new/${k}${t ? '?type=' + t : ''}`, icon: t ? '' : KINDS[k].icon, title: t ? URGENT[t] : KINDS[k].title, hint: t ? 'Выездная помощь — мастер приедет к вам' : KINDS[k].desc });
  for (const s of S.ref.subcategories) if (words.every((w) => s.name.toLowerCase().includes(w)))
    out.push({ href: `#/new/sto?cat=${s.category_id}&sub=${encodeURIComponent(s.name)}`, icon: '🔧', title: s.name, hint: catName(s.category_id) });
  for (const c of S.ref.categories) if (words.some((w) => c.name.toLowerCase().includes(w)))
    out.push({ href: `#/new/sto?cat=${c.id}`, icon: '🔧', title: c.name, hint: 'СТО' });
  out.push({ href: `#/new/sto?desc=${encodeURIComponent(text)}`, icon: '📝', title: 'Описать своими словами', hint: 'Заявка в СТО — мастера уточнят' });
  return out.slice(0, 7);
}

// ------------------------------------------------------------ главная
// «Франшиза в твоём городе» (инвесторам, НЕ добавление бизнеса): чат с главным ботом, текст подставляется в поле ввода
const franchiseUrl = () => `https://t.me/${CONFIG.PARTNER_BOT}?text=${encodeURIComponent(`Хочу выкупить права на представительство АвтоМастер24 в городе ${S.city || CONFIG.DEFAULT_CITY}`)}`;
async function home() {
  const fv = favs();
  const favList = fv.length ? (await Promise.all(fv.slice(0, 6).map((id) => api.getProvider(id).catch(() => null)))).filter(Boolean) : [];
  const onboard = localStorage.getItem('am24v-onboarded') ? '' : `<div class="card onboard" id="onb" role="region" aria-label="Подсказки для первого визита"><button class="x" id="onbX" aria-label="Скрыть подсказки">${ic('x')}</button>
    <div class="onb-h">${ic('bulb')}<div><b>Впервые здесь? Три подсказки</b><small>Займёт 10 секунд</small></div></div>
    <ul class="onb-tips"><li>${ic('search')}<span><b>Поиск понимает простые слова.</b> Напишите «стучит подвеска» или «закрыл ключи» — подскажем нужную услугу.</span></li>
    <li>${ic('lock')}<span><b>Можно без регистрации.</b> Заявка уйдёт мастеру в ${PRIMARY.label}, а переписка и цена останутся в чате на сайте.</span></li>
    <li>${ic('star')}<span><b>Выбирайте по рейтингу.</b> Оценки ставят только клиенты с выполненным заказом.</span></li></ul>
    <div class="row"><button class="p sm" id="onbOk" type="button">Понятно</button>${IS_DEMO ? '' : '<a class="btn sm" href="?demo=1#/">Посмотреть демо</a>'}</div></div>`;
  return `<section class="hero"><picture><source media="(max-width:700px)" srcset="assets/img/hero-640.webp"><img class="hero-img" src="assets/img/hero.webp" alt="" width="1024" height="576" fetchpriority="high"></picture>
    <div class="hero-in"><span class="eyebrow">${ic('pin')} ${esc(S.city)} · бесплатно для автовладельцев</span>
    <h1>Помощь с машиной —<br><span class="grad">за пару минут</span></h1><p>${esc(CONFIG.SITE_TAGLINE)}. Опишите, что случилось, — мастера откликнутся сами.</p>
    <div class="search" role="search">${ic('search', 'search-ic')}<input id="q" type="search" placeholder="Что случилось? Например: стучит подвеска, сел аккумулятор" aria-label="Что случилось с машиной?" autocomplete="off"><div id="sugg" class="sugg" role="listbox"></div></div>
    <div class="row"><a class="btn p" href="#/new/sto">${ic('plus')} Новая заявка</a><a class="btn glass" href="#/catalog/sto">${ic('search')} Выбрать мастера</a><a class="btn glass" href="#/prices">${ic('tag')} Цены</a></div>
    <ul class="trust"><li>${ic('check')} Бесплатно для клиентов</li><li>${ic('clock')} Отклик обычно за 5–15 минут</li><li>${ic('star')} Рейтинг по реальным заказам</li></ul></div></section>
  ${onboard}
  <div class="sec-h"><h2>Что случилось?</h2><a class="small" href="#/catalog/sto">Все мастера ${ic('arrow')}</a></div>
  <div class="grid photo-grid">${Object.entries(KINDS).map(([k, x]) => `<a class="tile ph-tile" href="#/new/${k}"><img src="${IMG[k]}" alt="" loading="lazy" width="560" height="420"><span class="kind-ic">${ic(KIND_IC[k])}</span><span class="ph-txt"><b>${x.title}</b><small>${x.desc}</small></span></a>`).join('')}</div>
  ${howBlock()}
  <div class="card promo"><div class="promo-ic">${ic('idcard')}</div><div class="grow"><b>Бесплатная визитка для вашего бизнеса</b><small>СТО, эвакуатор, мойка, магазин запчастей, выездной мастер или грузоперевозчик: своя страница и QR-код, кнопки «Позвонить» и ${PRIMARY.label}. Заявки приходят вам в ${PRIMARY.label} и видны в кабинете. Магазину — витрина с товарами.</small></div>
    <div class="row"><a class="btn p" href="#/business">Создать визитку</a><a class="btn" href="card.html?id=14${IS_DEMO ? '' : '&demo=1'}">Пример${IS_DEMO ? '' : ' (демо)'}</a><a class="btn ghost" href="#/tariffs">Тарифы</a></div></div>
  ${favList.length ? `<h2>Избранные</h2><div class="hscroll">${favList.map((p) => `<a class="mini" href="#/provider/${p.id}"><b>${KINDS[p.kind].icon} ${esc(p.name)}</b><small>★ ${Number(p.rating || 0).toFixed(1)} · ${esc(p.working_hours || '')}</small></a>`).join('')}</div>` : ''}
  <h2>Почему удобно</h2>
  <div class="grid feats">
    <div class="tile"><div class="i">${ic('zap')}</div><b>Один запрос — много мастеров</b><small>Не обзваниваете всех: заявку видят все подходящие исполнители города.</small></div>
    <div class="tile"><div class="i">${ic('camera')}</div><b>Фото и чат</b><small>Приложите фото поломки, уточните детали и цену в чате прямо по заявке.</small></div>
    <div class="tile"><div class="i">${ic('lock')}</div><b>Телефон под защитой</b><small>Ваш номер видит только тот, кто взял заявку. Поставщики запчастей анонимны до выбора.</small></div>
    <div class="tile"><div class="i">${ic('star')}</div><b>Честный рейтинг</b><small>Оценить может только тот, чья заявка выполнена. Мастера отвечают на отзывы.</small></div>
  </div>
  <h2>Для своих</h2>
  <div class="grid">
    <a class="tile" href="#/business"><div class="i">${ic('idcard')}</div><b>Добавить свой бизнес</b><small>Есть СТО, эвакуатор, мойка, магазин или грузовик? Бесплатная визитка с QR и заявки от клиентов</small></a>
    <a class="tile" href="#/tariffs"><div class="i">${ic('card')}</div><b>Тарифы</b><small>Визитка бесплатно, Про, магазин, печать</small></a>
    <a class="tile" href="#/garage"><div class="i">${ic('car')}</div><b>Мой гараж</b><small>Авто и регламент ТО</small></a>
    <a class="tile franchise" href="${franchiseUrl()}" target="_blank" rel="noopener" data-franchise><span class="pt-badge">Для инвесторов</span><div class="i">${ic('crown')}</div><b>Франшиза в твоём городе</b><small>Выкупите права на представительство. Успейте занять свой город!</small><span class="pt-go">${ic('pin')} ${esc(S.city || CONFIG.DEFAULT_CITY)} · написать в Telegram ${ic('arrow')}</span></a>
    ${S.myProv.length ? `<a class="tile" href="#/cabinet"><div class="i">${ic('wrench')}</div><b>Кабинет исполнителя</b><small>Входящие заявки</small></a>` : ''}
    ${isAdmin() ? `<a class="tile" href="#/admin"><div class="i">${ic('shield')}</div><b>Админ-панель</b><small>Модерация и статистика</small></a>` : ''}
    <button class="tile" data-install hidden><div class="i">${ic('phone')}</div><b>Установить приложение</b><small>Иконка на экране телефона, работает как приложение</small></button></div>
  <footer class="foot small muted">© АвтоМастер24 · <a href="#/tariffs">Тарифы</a> · <a href="#/business">Для бизнеса</a> · <a href="order.html">Мои заказы</a> · <a href="${franchiseUrl()}" target="_blank" rel="noopener" data-franchise>Франшиза</a></footer>`;
}
home.after = (v) => {
  $$('[data-franchise]', v).forEach((a) => a.addEventListener('click', () => { a.href = franchiseUrl(); }));
  const q = $('#q', v), sg = $('#sugg', v);
  q.oninput = () => { const list = suggest(q.value); sg.innerHTML = list.map((x) => `<a href="${x.href}" role="option"><span>${x.icon}</span><b>${esc(x.title)}</b><small>${esc(x.hint)}</small></a>`).join(''); sg.classList.toggle('on', !!list.length); };
  q.onkeydown = (e) => { if (e.key === 'Enter') { const a = $('a', sg); if (a) location.hash = a.getAttribute('href'); } };
  const hide = () => { localStorage.setItem('am24v-onboarded', '1'); const o = $('#onb', v); if (o) { o.classList.add('bye'); setTimeout(() => o.remove(), 250); } };
  [$('#onbX', v), $('#onbOk', v)].forEach((b) => { if (b) b.onclick = hide; });
  $$('[data-how]', v).forEach((b) => b.onclick = () => { $$('[data-how]', v).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
    $$('[data-how-panel]', v).forEach((p) => { p.hidden = p.dataset.howPanel !== b.dataset.how; }); });
  installBtns(v);
};
function installBtns(v) {
  $$('[data-install]', v).forEach((b) => { b.hidden = !S.installEvt; b.onclick = async () => { if (!S.installEvt) return; S.installEvt.prompt(); await S.installEvt.userChoice.catch(() => {}); S.installEvt = null; b.hidden = true; }; });
}

// ------------------------------------------------------------ каталог и карточка исполнителя
const verifiedBadge = (p) => p.verified ? '<span class="vbadge" title="Проверен администратором АвтоМастер24">✔ Проверен</span>' : '';
const favBtn = (p) => `<button class="fav ${isFav(p.id) ? 'on' : ''}" data-fav="${p.id}" aria-pressed="${isFav(p.id)}" aria-label="В избранное">${isFav(p.id) ? '♥' : '♡'}</button>`;
const provMeta = (p) => `${esc(p.city)}${p.address ? ' · ' + esc(p.address) : ''}${p.working_hours ? ' · 🕘 ' + esc(p.working_hours) : ''}`;
const provSpec = (p) => `${p.kind === 'sto' && p.specs?.length ? `<div class="small">${p.specs.map((c) => esc(catName(c))).filter(Boolean).join(' · ')}</div>` : ''}
  ${p.kind === 'urgent' && p.service_type ? `<div class="small">${URGENT[p.service_type]}</div>` : ''}
  ${p.kind === 'parts' && p.supplier_type ? `<div class="small">${SUPPLIER[p.supplier_type]}${p.delivery ? ' · 🚚 доставка' : ''}${hasShop(p) ? ' · 🛍 интернет-магазин' : ''}</div>` : ''}
  ${p.kind === 'cargo' && p.card?.cargo ? `<div class="small">${esc(cargoVeh(p.card.cargo.vehicle)?.name || '')} ${esc(cargoVeh(p.card.cargo.vehicle)?.cap || '')}${p.card.cargo.extras?.length ? ' · ' + esc(p.card.cargo.extras.join(', ')) : ''}${p.card.cargo.price ? ' · от ' + money(p.card.cargo.price) + '/' + esc(p.card.cargo.unit || 'час') : ''}</div>` : ''}`;
const cargoVeh = (id) => CARGO_VEHICLES.find((v) => v.id === id);
const provCard = (p, extra = '', from = null) => `<div class="card pcard">
  <a class="pthumb" href="#/provider/${p.id}" aria-hidden="true" tabindex="-1">${p.photos?.length ? `<img src="${esc(p.photos[0])}" alt="" loading="lazy">` : `<span>${KINDS[p.kind].icon}</span>`}</a>
  ${favBtn(p)}<div class="pbody"><div><b><a href="#/provider/${p.id}">${esc(p.name)}</a></b> ${verifiedBadge(p)}</div>
  <div class="small">${stars(p.rating)} <span class="muted">${Number(p.rating || 0).toFixed(1)} · ${p.reviews_count || 0} отз.</span> ${openChip(p.working_hours)} ${from ? `<span class="chip-s">от ${money(from)}</span>` : ''}</div>
  <div class="small muted">${provMeta(p)}</div>${provSpec(p)}
  <div class="row" style="margin-top:8px">${extra}</div></div></div>`;

async function catalog(kind = 'sto', q) {
  if (!KINDS[kind]) kind = 'sto';
  let list = await api.listProviders({ kind, city: S.city });
  const from = await api.pricesFrom(list.map((p) => p.id)).catch(() => ({}));
  if (q.cat) list = list.filter((p) => !p.specs?.length || p.specs.includes(+q.cat));
  if (q.s) { const w = q.s.toLowerCase(); list = list.filter((p) => [p.name, p.address, p.about].join(' ').toLowerCase().includes(w)); }
  if (q.open) list = list.filter((p) => openNow(p.working_hours));
  if (q.ver) list = list.filter((p) => p.verified);
  if (q.r4) list = list.filter((p) => +p.rating >= 4);
  if (q.fav) list = list.filter((p) => isFav(p.id));
  const sort = q.sort || 'rating';
  list.sort(sort === 'reviews' ? (a, b) => b.reviews_count - a.reviews_count : sort === 'price' ? (a, b) => (from[a.id] ?? 1e12) - (from[b.id] ?? 1e12) : (a, b) => (b.verified - a.verified) || (b.rating - a.rating));
  const link = (patch) => { const n = { ...q, ...patch }; Object.keys(n).forEach((k) => !n[k] && delete n[k]); const s = new URLSearchParams(n).toString(); return `#/catalog/${kind}${s ? '?' + s : ''}`; };
  const chip = (k, t) => `<a class="fchip ${q[k] ? 'on' : ''}" href="${link({ [k]: q[k] ? '' : '1' })}" aria-pressed="${!!q[k]}">${t}</a>`;
  return `<h1>Мастера и сервисы</h1><div class="tabs">${Object.entries(KINDS).map(([k, x]) => `<a href="#/catalog/${k}" class="${k === kind ? 'on' : ''}">${x.icon} ${x.short}</a>`).join('')}</div>
   <form class="filters" id="cf"><input name="s" type="search" value="${esc(q.s || '')}" placeholder="Поиск по названию или адресу" aria-label="Поиск">
   ${kind === 'sto' ? `<select name="cat" aria-label="Направление"><option value="">Все направления</option>${S.ref.categories.map((c) => `<option value="${c.id}" ${+q.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : ''}
   <select name="sort" aria-label="Сортировка"><option value="rating">По рейтингу</option><option value="reviews" ${sort === 'reviews' ? 'selected' : ''}>По числу отзывов</option><option value="price" ${sort === 'price' ? 'selected' : ''}>Сначала дешевле</option></select></form>
   <div class="fchips">${chip('open', '🕘 Открыто сейчас')}${chip('ver', '✔ Проверенные')}${chip('r4', '★ 4+')}${chip('fav', '♥ Избранное')}</div>
   <p class="small muted">${list.length} ${list.length === 1 ? 'исполнитель' : 'исполнителей'} в городе ${esc(S.city)}</p>
   ${list.length ? list.map((p) => provCard(p, `<a class="btn p sm" href="#/new/${kind}?to=${p.id}">Оставить заявку</a><a class="btn sm" href="#/provider/${p.id}">Подробнее</a>`, from[p.id])).join('')
    : empty('🔎', `Никого не нашли${Object.keys(q).length ? ' с такими фильтрами' : ` в городе ${esc(S.city)}`}.`, `<a class="btn" href="#/catalog/${kind}">Сбросить фильтры</a> <a class="btn" href="#/business">Подключить свой бизнес</a>`)}`;
}
catalog.after = (v, kind = 'sto') => {
  const f = $('#cf', v); if (!f) return;
  const go = () => { const d = formData(f); const cur = Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] || '')); const n = { ...cur, ...d }; Object.keys(n).forEach((k) => !n[k] && delete n[k]); location.hash = `#/catalog/${KINDS[kind] ? kind : 'sto'}?${new URLSearchParams(n)}`; };
  $$('select', f).forEach((s) => s.onchange = go); f.onsubmit = (e) => { e.preventDefault(); go(); };
  let t; $('[name=s]', f).oninput = () => { clearTimeout(t); t = setTimeout(go, 600); };
  const s = $('[name=s]', f); if (s.value) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
};

async function provider(id) {
  const p = await api.getProvider(id);
  const [revs, pr, st] = await Promise.all([api.providerReviews(id), p.kind === 'sto' ? api.providerPrices(id) : [], S.caps.v3 ? api.providerStats(id).catch(() => ({})) : {}]);
  const pub = revs.filter((r) => r.is_published);
  const mine = S.myProv.some((x) => x.id === p.id);
  const dist = [5, 4, 3, 2, 1].map((n) => [n, pub.filter((r) => r.rating === n).length]);
  const url = `${siteUrl()}#/provider/${p.id}`;
  return `<a href="#/catalog/${p.kind}" class="small">← ${KINDS[p.kind].title}</a>
   ${p.photos?.length ? `<div class="gallery">${p.photos.map((u, i) => `<button class="gph" data-full="${esc(u)}" aria-label="Фото ${i + 1}"><img src="${esc(u)}" alt="Фото ${i + 1}: ${esc(p.name)}" ${i ? 'loading="lazy"' : ''}></button>`).join('')}</div>` : `<div class="gallery none"><img src="${IMG[p.kind]}" alt=""></div>`}
   <div class="card"><div class="row between"><h1 style="margin:0">${esc(p.name)}</h1>${favBtn(p)}</div>
    <div class="row small">${verifiedBadge(p)}<span>${KINDS[p.kind].icon} ${KINDS[p.kind].title}</span>${openChip(p.working_hours)}</div>
    <div class="row" style="margin:10px 0">${stars(p.rating)} <b>${Number(p.rating || 0).toFixed(1)}</b> <span class="muted small">${p.reviews_count || 0} отзывов</span></div>
    <div class="stats">${st.completed != null ? `<div><b>${st.completed}</b><small>выполнено заявок</small></div>` : ''}${st.response_min != null ? `<div><b>~${Math.max(1, st.response_min)} мин</b><small>обычно отвечает ${tip('Медиана времени от заявки до принятия по последним заявкам')}</small></div>` : ''}${st.price_from ? `<div><b>от ${money(st.price_from)}</b><small>по прайсу</small></div>` : ''}</div>
    ${p.about ? `<p>${esc(p.about)}</p>` : ''}
    <dl class="kv">${p.address ? `<dt>Адрес</dt><dd>${esc(p.address)} · <a href="${mapUrl(p.city, p.address)}" target="_blank" rel="noopener">на карте ${REGION.maps.name}</a></dd>` : ''}<dt>Город</dt><dd>${esc(p.city)}</dd>${p.working_hours ? `<dt>Часы</dt><dd>${esc(p.working_hours)}</dd>` : ''}</dl>
    ${provSpec(p)}
    <div class="row" style="margin-top:12px"><a class="btn p" href="#/new/${p.kind}?to=${p.id}">📝 Оставить заявку</a>${tel(p.phone)}${wa(ownerContact(p), `Здравствуйте! Нашёл вас на ${CONFIG.SITE_NAME}.`)}
     ${S.caps.v4 ? `<a class="btn sm" href="card.html?id=${p.id}">🪪 Визитка и QR</a>` : ''}${S.caps.v4 && hasShop(p) ? `<a class="btn sm p" href="${esc(shopUrl(p))}" ${isExternalShop(p) ? 'target="_blank" rel="noopener"' : ''}>🛍 Магазин</a>` : ''}
     <button class="btn sm" id="share">🔗 Поделиться</button></div></div>
   ${pr.length ? `<div class="card"><h3>Прайс</h3><table><tr><th>Услуга</th><th>Авто</th><th>Цена</th><th></th></tr>${pr.map((x) => `<tr><td>${esc(x.service)}</td><td>${esc([x.brand, x.model].filter(Boolean).join(' ') || 'Все')}</td><td><b>${money(x.price)}</b></td><td><a class="btn sm" href="#/new/sto?to=${p.id}&sub=${encodeURIComponent(x.service)}">Записаться</a></td></tr>`).join('')}</table></div>` : ''}
   <div class="card"><h3>Отзывы</h3>
    ${pub.length ? `<div class="dist">${dist.map(([n, c]) => `<div><span>${n}★</span><i><b style="width:${pub.length ? Math.round(c / pub.length * 100) : 0}%"></b></i><span>${c}</span></div>`).join('')}</div>` : ''}
    ${pub.map((r) => `<div class="rev"><div>${stars(r.rating)} <span class="small muted">${dt(r.created_at)}</span></div>${r.comment ? `<p>${esc(r.comment)}</p>` : ''}
      ${r.reply ? `<div class="reply"><b>Ответ ${esc(p.name)}:</b> ${esc(r.reply)}</div>` : ''}
      ${mine && S.caps.v3 ? `<form class="row" data-reply="${r.id}"><input name="t" class="grow" placeholder="Ответить на отзыв" value="${esc(r.reply || '')}"><button class="sm">Ответить</button></form>` : ''}</div>`).join('') || '<p class="muted">Пока нет отзывов. Оценки ставят только клиенты с выполненной заявкой.</p>'}</div>
   <div class="card small muted">Ссылка на эту страницу: <span class="mono">${esc(url)}</span></div>`;
}
provider.after = (v, id) => {
  const sh = $('#share', v); if (sh) sh.onclick = async () => { const url = `${siteUrl()}#/provider/${id}`; try { if (navigator.share) await navigator.share({ title: 'АвтоМастер24', url }); else { await navigator.clipboard.writeText(url); toast('Ссылка скопирована'); } } catch { /* отмена */ } };
  $$('[data-reply]', v).forEach((f) => f.onsubmit = (e) => { e.preventDefault(); act($('button', f), () => api.replyReview(+f.dataset.reply, f.t.value), 'Ответ опубликован'); });
};

// ------------------------------------------------------------ новая заявка
const dayOpts = () => [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return [iso, i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' })]; });
async function newRequest(kind = 'sto', q) {
  if (!KINDS[kind]) kind = 'sto';
  const tabs = `<div class="tabs">${Object.entries(KINDS).map(([k, x]) => `<a href="#/new/${k}${q.to ? '' : ''}" class="${k === kind ? 'on' : ''}">${x.icon} ${x.short}</a>`).join('')}</div>`;
  const guest = !S.me;
  const warn = guest ? `<div class="notice">📲 Можно без входа: заявка уйдёт исполнителю в ${PRIMARY.label} готовым сообщением${S.caps.v4 ? ' и сохранится у него в кабинете' : ''}. <a href="#/login">Войдите</a>, чтобы видеть статус, чат и историю заявок.</div>`
    : !S.me.phone || !S.me.consent ? `<div class="notice warn">Перед первой заявкой заполните <a href="#/profile">профиль</a>: телефон и согласие на обработку данных. Телефон увидит только тот, кто возьмёт заявку.</div>` : '';
  const [provs, cars, prev] = await Promise.all([api.listProviders({ kind, city: S.city }), guest ? [] : api.vehicles(), q.repeat && !guest ? api.myRequests().then((l) => l.find((r) => r.id === +q.repeat)) : null]);
  const R = prev || {}; const D = R.details || {};
  const car = `<label>Автомобиль ${tip('Выберите машину из гаража или впишите марку и год — так мастер сразу поймёт, о чём речь')}</label>${cars.length ? `<select name="car"><option value="">— ввести вручную —</option>${cars.map((c) => `<option>${esc(`${c.brand} ${c.model} ${c.year || ''}`.trim())}</option>`).join('')}</select>` : ''}
    <input name="vehicle_info" value="${esc(R.vehicle_info || '')}" placeholder="Марка, модель, год (например Toyota Camry 2015)">`;
  const to = q.to || R.target_provider_id || '';
  const pick = (label, required) => `<label>${label} ${tip(guest ? `Выберите, кому написать в ${PRIMARY.label}. «Диспетчер» сам подберёт исполнителя.` : required ? 'Выберите мойку — она предложит цену и точное время' : '«Всем в городе» — заявку увидят все подходящие мастера, первый откликнувшийся возьмёт её. Можно выбрать конкретного.')}</label><select name="target_provider_id" ${required ? 'required' : ''}>${required ? '' : guest ? (dispatcherPhone() ? `<option value="">📢 Диспетчер ${esc(CONFIG.SITE_NAME)} — подберёт исполнителя</option>` : '') : '<option value="">📢 Отправить всем в городе</option>'}${provs.map((p) => `<option value="${p.id}" ${+to === p.id ? 'selected' : ''}>${esc(p.name)} · ★${Number(p.rating).toFixed(1)}${p.verified ? ' · ✔' : ''}</option>`).join('')}</select>`;
  const photo = S.caps.v3 && !guest ? `<label>Фото (до 5) ${tip('Фото поломки, вмятины, ошибки на приборной панели или нужной детали — мастер точнее оценит работу и цену')}</label>
    <label class="drop"><input type="file" id="ph" accept="image/*" multiple hidden><span>📷 Добавить фото</span></label><div class="photos prev" id="phPrev"></div>` : '';
  const when = (title) => `<label>${title} ${tip('Выберите день и время — мастер подтвердит или предложит другое в чате')}</label>${opts('day', [['', '⚡ Как можно скорее'], ...dayOpts()], '')}<div class="slots" id="slots"></div>`;
  const desc = q.desc || (q.sub && !S.ref.subcategories.some((s) => s.name === q.sub) ? 'Интересует: ' + q.sub : '') || R.description || '';
  let body = '';
  if (kind === 'sto') {
    const cat = +(q.cat || R.category_id || 0);
    body = `<label>Что нужно сделать? ${tip('Не знаете точно — выберите ближайшее направление и опишите симптомы своими словами')}</label><select name="category_id" id="catSel" required><option value="">— выберите направление —</option>${S.ref.categories.map((c) => `<option value="${c.id}" ${cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <label>Уточните</label><select name="subcategory" id="subSel" data-sel="${esc(q.sub || R.subcategory || '')}"><option value="">— сначала выберите направление —</option></select>
      ${pick('Куда отправить')}${car}<label>Опишите проблему</label><textarea name="description" rows="3" placeholder="Например: стук спереди справа на кочках, появился неделю назад">${esc(desc)}</textarea>
      ${photo}${when('Когда удобно приехать?')}`;
  } else if (kind === 'tow') {
    body = `<label>Тип транспорта</label>${opts('vehicle', pairs(TOW_VEHICLES), D.vehicle || TOW_VEHICLES[0])}<label>Колёса ${tip('Если колёса заблокированы (ручник, АКПП в P, после ДТП) — нужен эвакуатор с манипулятором или подкатными тележками')}</label>${opts('wheels', pairs(WHEELS), D.wheels || WHEELS[0])}
      <label>Где машина?</label><div class="row"><input name="location" class="grow" required placeholder="Адрес или ориентир" value="${esc(D.location || '')}"><button type="button" id="geo">📍 Моё место</button></div>
      <input type="hidden" name="lat"><input type="hidden" name="lon">${pick('Кому отправить')}${car}<label>Куда везти и комментарий</label><textarea name="description" rows="2" placeholder="Куда везти, особенности">${esc(desc)}</textarea>${photo}`;
  } else if (kind === 'wash') {
    if (!provs.length) return `<h1>Автомойка</h1>${tabs}${empty('🧽', `В городе ${esc(S.city)} пока нет моек.`, '<a class="btn" href="#/business">Подключить свою мойку</a>')}`;
    const days = dayOpts();
    body = `${pick('Мойка', true)}<label>Услуга</label>${opts('service_type', pairs(WASH_SERVICES), R.service_type || WASH_SERVICES[1])}<label>Кузов</label>${opts('car_type', pairs(CAR_TYPES), D.car_type || CAR_TYPES[0])}
      <label>День</label>${opts('day', days, days[0][0])}<label>Желаемое время ${tip('Мойка подтвердит время и назовёт цену — запись станет окончательной после вашего подтверждения')}</label><div class="slots" id="slots"></div><label>Комментарий</label><textarea name="description" rows="2">${esc(desc)}</textarea>`;
  } else if (kind === 'parts') {
    body = `<label>Где искать ${tip('Магазины — новые запчасти, авторазборки — б/у. «Везде» — получите больше предложений')}</label>${opts('supplier_type', [['', '📋 Везде'], ...Object.entries(SUPPLIER)], R.supplier_type || '')}<label>Какая запчасть нужна?</label><input name="description" required placeholder="Например: фара передняя левая" value="${esc(desc)}">
      ${car}<label>Срочность</label>${opts('urgency', pairs(PARTS_URGENCY), D.urgency || PARTS_URGENCY[1])}<label>Оригинал или аналог</label>${opts('original', pairs(PARTS_ORIG), D.original || PARTS_ORIG[2])}
      <label>Получение</label>${opts('delivery', pairs(PARTS_DELIVERY), D.delivery || PARTS_DELIVERY[0])}<label>Бюджет (необязательно), ₸</label><input name="budget" type="number" min="0" step="500" value="${esc(D.budget || '')}">${photo}
      <p class="small muted">🔒 Поставщики пришлют цены анонимно, вы выберете лучшее — тогда обе стороны увидят контакты. Заявка активна 3 часа.</p>`;
  } else if (kind === 'cargo') {
    body = `<label>Что везём?</label>${opts('what', pairs(CARGO_SERVICES), D.what || q.what || CARGO_SERVICES[0])}
      <label>Машина ${tip('Каблук — коробки и мелкий груз, Газель — переезд 1–2 комнат, удлинённая — мебель и длинномер, грузовик — стройматериалы')}</label>
      <div class="opts veh">${[['', '🤝 Подберите сами', '', ''], ...CARGO_VEHICLES.map((x) => [x.id, x.name, x.cap, x.img])].map(([v, t, c, img]) => `<label class="opt"><input type="radio" name="cargo_vehicle" value="${v}" ${(D.cargo_vehicle || '') === v ? 'checked' : ''}><span>${img ? `<img src="${img}" alt="" loading="lazy">` : ''}${esc(t)}${c ? `<small>${esc(c)}</small>` : ''}</span></label>`).join('')}</div>
      <label>Откуда</label><div class="row"><input name="location" class="grow" required placeholder="Адрес погрузки" value="${esc(D.location || '')}"><button type="button" id="geo">📍 Я здесь</button></div>
      <input type="hidden" name="lat"><input type="hidden" name="lon">
      <label>Куда</label><input name="to" required placeholder="Адрес выгрузки или город" value="${esc(D.to || '')}">
      <label>Когда</label>${opts('when', pairs(CARGO_WHEN), D.when || CARGO_WHEN[1])}
      <label>Дополнительно</label>${opts('extras', pairs(CARGO_EXTRAS), [].concat(D.extras || []), 'checkbox')}
      <label>Ваша цена (необязательно), ${REGION.symbol}</label><input name="budget" type="number" min="0" step="500" value="${esc(D.budget || '')}">
      ${pick('Кому отправить')}<label>Что за груз</label><textarea name="description" rows="2" placeholder="Например: диван, холодильник и 10 коробок, 3 этаж без лифта">${esc(desc)}</textarea>${photo}`;
  } else {
    body = `<label>Что нужно?</label>${opts('service_type', Object.entries(URGENT), q.type || R.service_type || 'locksmith')}
      <label>Где вы?</label><div class="row"><input name="location" class="grow" required placeholder="Адрес или ориентир" value="${esc(D.location || '')}"><button type="button" id="geo">📍 Моё место</button></div>
      <input type="hidden" name="lat"><input type="hidden" name="lon">${car}<label>Опишите ситуацию</label><textarea name="description" rows="2" placeholder="Например: ключи в закрытой машине">${esc(desc)}</textarea>${photo}`;
  }
  const HINTS = { sto: 'Опишите симптомы: когда появилось, при каких условиях (на холодную, на кочках, при торможении). Фото ошибки на панели сильно помогает.',
    tow: 'Нажмите «📍 Моё место» — водитель получит точку на карте. Укажите, крутятся ли колёса: от этого зависит, какой эвакуатор приедет.',
    wash: 'Выберите день и удобное время — мойка подтвердит запись и назовёт точную цену.',
    parts: 'Лучше всего — VIN или фото старой детали. Поставщики пришлют цены анонимно, контакты откроются после вашего выбора.',
    urgent: 'Укажите точный адрес или ориентир и что случилось — мастер возьмёт нужный инструмент.',
    cargo: 'Перечислите крупные вещи и этаж (есть ли лифт) — так водитель сразу назовёт честную цену и подберёт машину.' };
  return `<h1 class="pg-h"><span class="pg-ic">${ic(KIND_IC[kind])}</span>${KINDS[kind].title}</h1>${tabs}${warn}${hint(HINTS[kind])}${prev ? '<div class="notice">🔁 Заполнили по прошлой заявке — проверьте и отправьте.</div>' : ''}
    <form id="reqForm" class="card" data-kind="${kind}"><div class="small muted">Город: <b>${esc(S.city)}</b> (меняется вверху)</div>${body}
    ${guest ? `<div class="row"><div class="grow"><label>Ваше имя</label><input name="g_name" autocomplete="name" maxlength="80"></div><div class="grow"><label>Телефон (необязательно)</label><input name="g_phone" type="tel" autocomplete="tel" placeholder="${esc(REGION.phone.placeholder)}"></div></div>` : ''}
    <button class="p block" style="margin-top:16px">${guest ? `${PRIMARY.icon} Отправить в ${PRIMARY.label}` : 'Отправить заявку'}</button><p class="small muted center" style="margin:8px 0 0">${guest ? `Откроется ${PRIMARY.label} с готовым сообщением — останется нажать «Отправить».` : `Бесплатно. Телефон увидит только тот, кто возьмёт заявку. Заявку можно продублировать в ${PRIMARY.label}.`}</p></form>`;
}
newRequest.after = (v, kind) => {
  const f = $('#reqForm', v); if (!f) return;
  const cs = $('#catSel', v), ss = $('#subSel', v);
  const fillSub = () => { ss.innerHTML = '<option value="">— не знаю / другое —</option>' + S.ref.subcategories.filter((s) => s.category_id === +cs.value).map((s) => `<option ${s.name === ss.dataset.sel ? 'selected' : ''}>${esc(s.name)}</option>`).join(''); };
  if (cs) { cs.onchange = fillSub; if (cs.value) fillSub(); }
  const g = $('#geo', v);
  if (g) g.onclick = () => { g.disabled = true; navigator.geolocation?.getCurrentPosition((p) => { g.disabled = false; f.lat.value = p.coords.latitude.toFixed(6); f.lon.value = p.coords.longitude.toFixed(6);
    if (!f.location.value) f.location.value = 'По геолокации'; g.textContent = '✅ Место добавлено'; toast('Координаты добавлены — исполнитель увидит точку на карте'); }, () => { g.disabled = false; toast('Не удалось определить место — разрешите доступ к геолокации', true); }, { enableHighAccuracy: true, timeout: 10000 }); };
  if (f.car) f.car.onchange = () => { if (f.car.value) f.vehicle_info.value = f.car.value; };
  // фото
  const files = []; const ph = $('#ph', v), prev = $('#phPrev', v);
  const drawPrev = () => { prev.innerHTML = files.map((b, i) => `<span class="ph"><img src="${URL.createObjectURL(b)}" alt="Фото ${i + 1}"><button type="button" class="rm" data-rm="${i}" aria-label="Убрать фото">✕</button></span>`).join('');
    $$('[data-rm]', prev).forEach((b) => b.onclick = () => { files.splice(+b.dataset.rm, 1); drawPrev(); }); };
  if (ph) ph.onchange = async () => { for (const file of [...ph.files].slice(0, 5 - files.length)) { try { files.push(await compress(file)); } catch (e) { toast(e.message, true); } } ph.value = ''; drawPrev(); };
  // время
  const slots = $('#slots', v);
  const drawSlots = async () => {
    if (!slots) return;
    const day = f.querySelector('[name=day]:checked')?.value;
    if (!day) { slots.innerHTML = ''; return; }
    const pid = f.target_provider_id?.value; const p = pid ? await api.getProvider(pid).catch(() => ({})) : {};
    const m = /(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/.exec(p.working_hours || '') || [0, 9, 0, kind === 'wash' ? 20 : 19, 0];
    const step = kind === 'wash' ? (p.slot_minutes || 60) : 60, d0 = new Date(day + 'T00:00:00'), out = [];
    for (let t = +m[1] * 60 + +m[2]; t + step <= +m[3] * 60 + +m[4]; t += step) { const d = new Date(d0); d.setMinutes(t); if (d > new Date()) out.push(d); }
    slots.innerHTML = out.length ? out.map((d, i) => `<label class="opt"><input type="radio" name="desired_time" value="${d.toISOString()}" ${i === 0 ? 'checked' : ''}><span>${hm(d)}</span></label>`).join('') : '<span class="muted small">На этот день свободного времени нет — выберите другой</span>';
  };
  if (slots) { if (f.target_provider_id) f.target_provider_id.addEventListener('change', drawSlots); $$('[name=day]', f).forEach((r) => r.addEventListener('change', drawSlots)); drawSlots(); }
  f.onsubmit = async (e) => { e.preventDefault(); const d = formData(f); const btn = $('button.p', f);
    const details = {}; for (const k of ['vehicle', 'wheels', 'location', 'lat', 'lon', 'car_type', 'urgency', 'original', 'delivery', 'budget', 'what', 'to', 'when', 'cargo_vehicle', 'extras']) if (d[k] && (!Array.isArray(d[k]) || d[k].length)) details[k] = d[k];
    const p = { type: kind, city: S.city, category_id: d.category_id || null, subcategory: d.subcategory || null, service_type: d.service_type || null,
      supplier_type: d.supplier_type || null, target_provider_id: d.target_provider_id || null, description: d.description || '', vehicle_info: d.vehicle_info || '', details, desired_time: d.desired_time || null };
    if (kind === 'wash' && !p.desired_time) return toast('Выберите время', true);
    if (!S.me || (kind === 'cargo' && !S.caps.v4)) return sendGuest(v, btn, kind, p, d);
    btn.disabled = true;
    try {
      if (files.length) { details.photos = []; for (const [i, b] of files.entries()) { btn.textContent = `Загружаем фото ${i + 1} из ${files.length}…`; details.photos.push(await api.uploadRequestPhoto(b)); } }
      btn.textContent = 'Отправляем…';
      const id = await api.createRequest(p); toast('Заявка отправлена! Исполнители уже видят её.'); location.hash = '#/request/' + id + '?sent=1';
    } catch (er) { toast(er.message, true); btn.disabled = false; btn.textContent = 'Отправить заявку'; }
  };
};

// заявка без входа: сохраняем у исполнителя (WhatsApp-заявки в кабинете) и открываем WhatsApp с готовым текстом
async function sendGuest(v, btn, kind, p, d) {
  if (d.g_phone && !validPhone(d.g_phone)) return toast(`Телефон в формате ${REGION.phone.placeholder}`, true);
  btn.disabled = true;
  const prep = async () => {
    const prov = p.target_provider_id ? await api.getProvider(p.target_provider_id) : null;
    const to = prov ? ownerContact(prov) : dispatcherPhone();
    if (!to) throw new Error(`У исполнителя не указан ${PRIMARY.label} — выберите другого или позвоните ему`);
    const text = requestText({ title: reqTitleText(p), provider: prov, fields: reqPlain(p), customer: { name: d.g_name || S.me?.full_name, phone: d.g_phone || S.me?.phone } });
    return { to, text, prov, title: reqTitleText(p), providerName: prov?.name || '', demo: IS_DEMO,
      lead: { provider_id: prov?.id || null, kind, source: 'app', customer_name: d.g_name || S.me?.full_name || '', customer_phone: d.g_phone || S.me?.phone || '', message: text, payload: p } };
  };
  if (S.caps.v5) { // заявка → чат на сайте; WhatsApp исполнителя/диспетчера — уведомление со ссылкой на чат
    let info = null;
    return startOrder(async () => (info = await prep())).then((r) => { location.href = r.chatUrl + '&new=1'; })
      .catch((e) => { toast(e.message, true); btn.disabled = false; if (info) v.innerHTML = sentCard({ to: info.to, text: info.text, prov: info.prov, leadId: null }); });
  }
  try {
    const { to, text, prov, lead } = await prep();
    let leadId = null;
    if (S.caps.v4) leadId = await api.createLead(lead);
    v.innerHTML = sentCard({ to, text, prov, leadId });
    $('#copyTxt', v).onclick = () => { navigator.clipboard?.writeText(text); toast('Текст скопирован'); };
    try { window.open(sendLink(to, text), '_blank', 'noopener'); } catch { /* блокировщик окон — есть кнопка */ }
  } catch (e) { toast(e.message, true); btn.disabled = false; }
}
const sentCard = ({ to, text, prov, leadId }) => `<div class="card center sent"><div class="big-i">✅</div><h2>Заявка готова</h2>
  <p>Нажмите кнопку — откроется ${PRIMARY.label} ${prov ? `<b>${esc(prov.name)}</b>` : 'диспетчера'} с готовым сообщением, останется нажать «Отправить».</p>
  ${wa(to, text, `${PRIMARY.icon} Открыть ${PRIMARY.label}`, 'btn wa big')}
  ${leadId ? `<p class="small muted">Заявка №${leadId} сохранена — исполнитель видит её в кабинете.</p>` : ''}
  <details class="small"><summary>Текст сообщения</summary><pre class="msgtext">${esc(text)}</pre><button class="sm" id="copyTxt">Скопировать текст</button></details>
  <div class="row" style="justify-content:center;margin-top:12px">${prov ? `<a class="btn" href="card.html?id=${prov.id}">🪪 Визитка исполнителя</a>` : ''}<a class="btn" href="#/">На главную</a><a class="btn" href="#/login">Войти и отслеживать</a></div></div>`;
const reqTitleText = (r) => r.type === 'cargo' ? `Грузоперевозка: ${r.details?.what || ''}` : r.type === 'sto' ? `СТО: ${catName(r.category_id) || 'ремонт'}` : r.type === 'urgent' ? (URGENT[r.service_type] || 'Выездная помощь') : r.type === 'wash' ? `Мойка: ${r.service_type || ''}` : KINDS[r.type].title;
const reqPlain = (r) => { const d = r.details || {};
  return [['Город', r.city], ['Уточнение', r.subcategory], ['Авто', r.vehicle_info], ['Машина', d.cargo_vehicle && (cargoVeh(d.cargo_vehicle)?.name + ' ' + (cargoVeh(d.cargo_vehicle)?.cap || ''))],
    [r.type === 'cargo' ? 'Откуда' : 'Место', d.location], ['Куда', d.to], ['Точка на карте', d.lat ? mapPoint(d.lat, d.lon) : null], ['Когда', d.when],
    ['Дополнительно', d.extras && [].concat(d.extras)], ['Транспорт', d.vehicle], ['Колёса', d.wheels], ['Кузов', d.car_type], ['Где искать', r.supplier_type && SUPPLIER[r.supplier_type]],
    ['Срочность', d.urgency], ['Оригинал/аналог', d.original], ['Получение', d.delivery], [r.type === 'cargo' ? 'Цена клиента' : 'Бюджет', d.budget && money(d.budget)],
    ['Желаемое время', r.desired_time && dt(r.desired_time)], ['Описание', r.description]]; };

// ------------------------------------------------------------ мои заявки
const reqTitle = (r) => r.type === 'cargo' ? `🚚 ${esc(r.details?.what || 'Грузоперевозка')}` : `${KINDS[r.type].icon} ${r.type === 'sto' ? esc(catName(r.category_id) || 'СТО') : r.type === 'urgent' ? esc(URGENT[r.service_type] || 'Выездная помощь') : r.type === 'wash' ? esc(r.service_type || 'Мойка') : KINDS[r.type].title}`;
const reqInfo = (r) => {
  const d = r.details || {};
  const rows = [['Номер', `<span class="mono">#${r.id}</span>`], ['Создана', dt(r.created_at)], ['Город', esc(r.city)],
    r.subcategory && ['Уточнение', esc(r.subcategory)], r.vehicle_info && ['Авто', esc(r.vehicle_info)], r.description && ['Описание', esc(r.description)],
    d.vehicle && ['Транспорт', esc(d.vehicle)], d.wheels && ['Колёса', esc(d.wheels)],
    d.location && [r.type === 'cargo' ? 'Откуда' : 'Место', esc(d.location) + (d.lat ? ` · <a target="_blank" rel="noopener" href="${esc(mapPoint(d.lat, d.lon))}">📍 на карте</a>` : '')],
    d.what && ['Груз', esc(d.what)], d.to && ['Куда', esc(d.to)], d.when && ['Когда', esc(d.when)], d.cargo_vehicle && ['Машина', esc(cargoVeh(d.cargo_vehicle)?.name || d.cargo_vehicle)], d.extras && ['Дополнительно', esc([].concat(d.extras).join(', '))],
    d.car_type && ['Кузов', esc(d.car_type)], r.desired_time && ['Желаемое время', dt(r.desired_time)], r.assigned_time && ['Назначено', dt(r.assigned_time)],
    r.supplier_type && ['Где искать', SUPPLIER[r.supplier_type]], d.urgency && ['Срочность', esc(d.urgency)], d.original && ['Оригинал/аналог', esc(d.original)],
    d.delivery && ['Получение', esc(d.delivery)], d.budget && ['Бюджет', money(d.budget)], r.price && ['Цена мойки', money(r.price)], r.final_amount && ['Сумма', money(r.final_amount)],
    r.expires_at && ['Активна до', dt(r.expires_at)]].filter(Boolean);
  return `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>${photoStrip(d.photos)}`;
};
// шкала статуса
const FLOW = {
  sto: [['new', 'Заявка отправлена'], ['active', 'Мастер взял заявку'], ['completed', 'Работа выполнена']],
  tow: [['new', 'Заявка отправлена'], ['active', 'Эвакуатор едет'], ['completed', 'Доставлено']],
  urgent: [['new', 'Заявка отправлена'], ['active', 'Мастер выехал'], ['completed', 'Готово']],
  cargo: [['new', 'Заявка отправлена'], ['active', 'Перевозчик взял заявку'], ['completed', 'Доставлено']],
  parts: [['new', 'Заявка отправлена'], ['offers', 'Есть предложения'], ['active', 'Поставщик выбран'], ['delivered', 'Передано'], ['completed', 'Получено']],
  wash: [['new', 'Заявка отправлена'], ['price_offered', 'Цена и время'], ['client_approved', 'Запись подтверждена'], ['in_progress', 'Моют'], ['waiting_client', 'Готово'], ['completed', 'Забрали']],
};
function timeline(r) {
  const st = effStatus(r), flow = FLOW[r.type];
  if (['cancelled', 'expired'].includes(st)) return `<div class="tl"><div class="step done"><i></i><span>Заявка отправлена<small>${dt(r.created_at)}</small></span></div><div class="step bad"><i></i><span>${st === 'cancelled' ? 'Отменена' : 'Время вышло — никто не взял'}</span></div></div>`;
  const idx = Math.max(0, flow.findIndex(([s]) => s === st));
  return `<div class="tl" aria-label="Ход заявки">${flow.map(([, t], i) => `<div class="step ${i < idx || st === 'completed' ? 'done' : i === idx ? 'cur' : ''}"><i></i><span>${t}${i === 0 ? `<small>${dt(r.created_at)}</small>` : i === 1 && r.accepted_at ? `<small>${dt(r.accepted_at)}</small>` : ''}</span></div>`).join('')}</div>`;
}
const myChats = () => { const n = myOrders().filter((x) => !!x.demo === IS_DEMO).length; return n ? `<a class="card promo" href="order.html"><span class="big-i">💬</span><div><b>Чаты по заявкам с визиток и магазинов (${n})</b><small>Переписка с исполнителями на сайте — без входа, с этого устройства</small></div></a>` : ''; };
async function requests(_, q) {
  if (!S.me) return `<h1>Мои заявки</h1>${myChats()}${needLogin('просмотра заявок')}`;
  const all = await api.myRequests(); autoRefresh();
  const act_ = all.filter((r) => !['completed', 'cancelled', 'expired'].includes(effStatus(r)));
  const tab = q.t || (act_.length ? 'a' : 'h');
  const list = tab === 'a' ? act_ : all.filter((r) => !act_.includes(r));
  return `<h1>Мои заявки</h1>${myChats()}<div class="tabs"><a href="#/requests?t=a" class="${tab === 'a' ? 'on' : ''}">Активные (${act_.length})</a><a href="#/requests?t=h" class="${tab === 'h' ? 'on' : ''}">История (${all.length - act_.length})</a></div>
    ${list.length ? list.map((r) => `<a class="card req" href="#/request/${r.id}"><div class="row between"><b>${reqTitle(r)}</b>${badge(effStatus(r))}</div>
    <div class="small muted">#${r.id} · ${dt(r.created_at)}${r.vehicle_info ? ' · ' + esc(r.vehicle_info) : ''}${r.details?.photos?.length ? ' · 📷 ' + r.details.photos.length : ''}</div><div class="small">${esc((r.description || r.subcategory || '').slice(0, 120))}</div></a>`).join('')
    : empty('📋', tab === 'a' ? 'Активных заявок нет.' : 'История пуста.', '<a class="btn p" href="#/new/sto">Создать заявку</a>')}`;
}
async function request(id, q = {}) {
  if (!S.me) return needLogin();
  const r = (await api.myRequests()).find((x) => x.id === +id); if (!r) return empty('🤷', 'Заявка не найдена', '<a class="btn" href="#/requests">Мои заявки</a>');
  const st = effStatus(r); autoRefresh();
  let block = '';
  const prov = r.accepted_by ? await api.getProvider(r.accepted_by).catch(() => null) : null;
  if (r.type === 'parts' && ['new', 'offers'].includes(st)) {
    const offs = await api.requestOffers(r.id);
    block = `<div class="card"><h3>Предложения поставщиков ${tip('Поставщики анонимны, пока вы не выберете предложение. После выбора обе стороны увидят контакты.')}</h3>${offs.length ? offs.map((o, i) => `<div class="offer"><div><span class="price">${money(o.price)}</span> ${i === 0 && offs.length > 1 ? '<span class="chip-s ok">лучшая цена</span>' : ''}<br><span class="small">${esc(o.provider_name)} · ★${Number(o.provider_rating).toFixed(1)}${o.delivery ? ' · 🚚 доставка' : ''}</span><br><span class="small muted">${esc(o.comment)}</span></div>
      <button class="p" data-offer="${o.id}">Выбрать</button></div>`).join('') : '<p class="muted"><span class="pulse"></span> Ждём предложения… Страница обновляется сама.</p>'}</div>`;
  } else if (['new'].includes(st)) {
    block = `<div class="card"><p><span class="pulse"></span> Заявку видят исполнители. Как только кто-то примет — здесь появятся его контакты и чат.</p></div>`;
    if (['tow', 'sto', 'urgent', 'cargo'].includes(r.type) && Date.now() - new Date(r.created_at) > 5 * 60000) {
      const all = await api.listProviders({ kind: r.type, city: r.city });
      block += `<div class="card"><h3>Пока никто не ответил — позвоните напрямую</h3>${all.map((p) => `<div class="row between small" style="padding:4px 0"><a href="#/provider/${p.id}">${esc(p.name)}</a>${tel(p.phone)}</div>`).join('') || '<p class="muted">Нет исполнителей в городе</p>'}</div>`;
    }
  }
  let waBlock = '';
  if (!['completed', 'cancelled', 'expired'].includes(st)) {
    const tid = r.accepted_by || r.target_provider_id;
    const list = tid ? [prov || await api.getProvider(tid).catch(() => null)].filter(Boolean) : (await api.listProviders({ kind: r.type, city: r.city })).filter((p) => ownerContact(p)).slice(0, 8);
    const txt = (p) => requestText({ title: reqTitleText(r), provider: p, fields: reqPlain(r), customer: { name: S.me.full_name, phone: S.me.phone }, id: r.id, url: location.origin + location.pathname + '#/request/' + r.id });
    const btns2 = list.filter((p) => ownerContact(p)).map((p) => wa(ownerContact(p), txt(p), `${PRIMARY.icon} ${esc(p.name)}`, 'btn wa')).join('') + (!tid && dispatcherPhone() ? wa(dispatcherPhone(), txt(null), '📢 Диспетчер', 'btn') : '');
    if (btns2) waBlock = `<div class="card wa-card"><h3>📲 ${q.sent ? `Заявка сохранена — отправьте в ${PRIMARY.label}` : `Написать в ${PRIMARY.label}`}</h3><p class="small muted">${tid ? 'Исполнитель получит готовое сообщение с номером заявки.' : 'Заявку уже видят подходящие исполнители города. Чтобы ответили быстрее — отправьте её напрямую:'}</p><div class="row">${btns2}</div></div>`;
  }
  const chatOk = S.caps.v3 && r.accepted_by && !['cancelled'].includes(st) && !(r.type === 'parts' && ['new', 'offers'].includes(st));
  if (prov && !['new', 'offers'].includes(st)) block += `<h2>Исполнитель</h2>${provCard(prov, `${tel(prov.phone)}${wa(prov.whatsapp, `Здравствуйте! По заявке #${r.id} на АвтоМастер24 (чат на сайте): ${location.origin + location.pathname}#/request/${r.id}`)}${chatOk ? `<a class="btn p sm" href="#/chat/${r.id}">💬 Написать в чат</a>` : ''}`)}`;
  const btns = [];
  if (r.type === 'wash' && st === 'price_offered') btns.push(`<div class="notice">Мойка предлагает: <b>${money(r.price)}</b>, время <b>${dt(r.assigned_time)}</b></div><button class="ok" data-a="washApprove">✅ Подтвердить запись</button>`);
  if (r.type === 'wash' && st === 'waiting_client') btns.push('<div class="notice">🚗 Машина готова — можно забирать!</div><button class="ok" data-a="clientConfirm">Забрал машину</button>');
  if (r.type === 'parts' && st === 'delivered') btns.push('<button class="ok" data-a="clientConfirm">📦 Получил запчасть</button>');
  if (['tow', 'sto', 'urgent', 'cargo'].includes(r.type) && st === 'active') btns.push('<button class="ok" data-a="clientConfirm">✅ Работа выполнена</button>');
  if (!['completed', 'cancelled', 'expired'].includes(st)) btns.push('<button class="danger" data-a="cancelRequest">Отменить заявку</button>');
  else btns.push(`<a class="btn" href="#/new/${r.type}?repeat=${r.id}">🔁 Повторить заявку</a>`);
  let review = '';
  if (st === 'completed' && r.accepted_by) {
    const mine = await api.myReviewFor(r.id);
    review = mine ? `<div class="card"><h3>Ваша оценка</h3>${stars(mine.rating)} ${esc(mine.comment)} ${mine.is_published ? '' : '<span class="small muted">(отзыв на модерации)</span>'}${mine.reply ? `<div class="reply"><b>Ответ исполнителя:</b> ${esc(mine.reply)}</div>` : ''}</div>`
      : `<form class="card" id="revForm"><h3>Оцените исполнителя</h3><div class="rate" role="radiogroup" aria-label="Оценка">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" name="rating" id="rt${n}" value="${n}" ${n === 5 ? 'checked' : ''}><label for="rt${n}" title="${n}">★</label>`).join('')}</div>
        <label>Отзыв (необязательно) ${tip('Отзыв с текстом публикуется после проверки модератором. Оценка без текста — сразу.')}</label><textarea name="comment" rows="2" placeholder="Что понравилось, что нет"></textarea><button class="p" style="margin-top:10px">Отправить оценку</button></form>`;
  }
  return `<a href="#/requests" class="small">← Мои заявки</a><div class="card"><div class="row between"><h2>${reqTitle(r)}</h2>${badge(st)}</div>${timeline(r)}${reqInfo(r)}</div>${waBlock}${block}
    ${btns.length ? `<div class="card row">${btns.join('')}</div>` : ''}${review}`;
}
request.after = (v, id) => {
  $$('[data-offer]', v).forEach((b) => b.onclick = () => act(b, () => api.selectOffer(+b.dataset.offer), 'Предложение выбрано — контакты открыты'));
  $$('[data-a]', v).forEach((b) => b.onclick = () => { if (b.dataset.a === 'cancelRequest' && !confirm('Отменить заявку?')) return; act(b, () => api[b.dataset.a](+id), 'Готово'); });
  const f = $('#revForm', v); if (f) f.onsubmit = (e) => { e.preventDefault(); const d = formData(f); act($('button', f), () => api.leaveReview(+id, +d.rating, d.comment), 'Спасибо за оценку!'); };
};

// ------------------------------------------------------------ чат по заявке
async function chat(id) {
  if (!S.me) return needLogin('чата');
  if (!S.caps.v3) return empty('💬', 'Чат скоро появится.');
  const r = await api.getRequest(+id);
  const iAmClient = r.user_id === S.me.id;
  const prov = r.accepted_by ? await api.getProvider(r.accepted_by).catch(() => null) : null;
  const msgs = await api.messages(+id);
  const other = iAmClient ? (prov?.name || 'Исполнитель') : 'Клиент';
  const back = iAmClient ? `#/request/${r.id}` : `#/cabinet?p=${r.accepted_by}`;
  return `<a href="${back}" class="small">← ${iAmClient ? 'К заявке' : 'В кабинет'}</a><div class="card chat"><div class="chat-h"><b>💬 ${esc(other)}</b><span class="small muted">${reqTitle(r)} · #${r.id}</span></div>
    <div class="msgs" id="msgs" aria-live="polite">${msgs.map((m) => msgHtml(m, iAmClient)).join('') || '<p class="muted small center" id="noMsg">Сообщений пока нет. Напишите первым — например, уточните время или пришлите детали.</p>'}</div>
    ${r.accepted_by ? `<form class="chat-f" id="chatF"><input name="t" class="grow" placeholder="Сообщение…" autocomplete="off" maxlength="2000" aria-label="Сообщение"><button class="p" aria-label="Отправить">➤</button></form>
    <div class="quick">${(iAmClient ? ['Когда сможете?', 'Сколько будет стоить?', 'Я на месте'] : ['Выезжаю', 'Буду через 30 минут', 'Пришлите фото, пожалуйста']).map((t) => `<button type="button" class="sm" data-q="${esc(t)}">${esc(t)}</button>`).join('')}</div>`
    : '<p class="small muted">Чат откроется, когда исполнитель возьмёт заявку.</p>'}</div>
    <p class="small muted">🔒 Переписка видна только вам и ${iAmClient ? 'исполнителю' : 'клиенту'}. Не отправляйте данные карт и коды из SMS.</p>`;
}
const msgHtml = (m, iAmClient) => { const mine = m.from_provider !== iAmClient; return `<div class="msg ${mine ? 'me' : ''}" data-mid="${m.id}"><span>${esc(m.body)}</span><small>${hm(m.created_at)}</small></div>`; };
chat.after = (v, id) => {
  const box = $('#msgs', v), f = $('#chatF', v); if (!box) return;
  box.scrollTop = box.scrollHeight;
  const r0 = api.getRequest(+id);
  const add = async (m) => {
    if (!m?.id) { const all = await api.messages(+id); const ic = (await r0).user_id === S.me.id; all.forEach((x) => add2(x, ic)); return; }
    add2(m, (await r0).user_id === S.me.id);
  };
  const add2 = (m, ic) => { if ($(`[data-mid="${m.id}"]`, box)) return; $('#noMsg', box)?.remove(); box.insertAdjacentHTML('beforeend', msgHtml(m, ic)); box.scrollTop = box.scrollHeight; };
  S.cleanups.push(api.subscribeMessages(+id, add));
  const poll = setInterval(() => { if (!document.hidden) add(null).catch(() => {}); }, 8000); S.cleanups.push(() => clearInterval(poll));
  if (!f) return;
  const send = async (text) => { if (!text.trim()) return; const b = $('button', f); b.disabled = true; try { const m = await api.sendMessage(+id, text); f.t.value = ''; add(m); } catch (e) { toast(e.message, true); } finally { b.disabled = false; f.t.focus(); } };
  f.onsubmit = (e) => { e.preventDefault(); send(f.t.value); };
  $$('[data-q]', v).forEach((b) => b.onclick = () => send(b.dataset.q));
};

// ------------------------------------------------------------ гараж
async function garage() {
  const reg = `<div class="card"><h3>Регламент ТО</h3><table><tr><th>Что</th><th>Каждые</th><th></th></tr>${S.ref.maintenance.map((m) => `<tr><td>${esc(m.name)}</td><td>${[m.km && m.km.toLocaleString('ru-RU') + ' км', m.months && m.months + ' мес.'].filter(Boolean).join(' / ')}</td><td class="small muted">${esc(m.note || '')}</td></tr>`).join('')}</table></div>`;
  if (!S.me) return `<h1>Мой гараж</h1>${needLogin('гаража')}${reg}`;
  const cars = await api.vehicles();
  return `<h1>Мой гараж</h1>${cars.map((c) => `<div class="card row between"><div><b>🚗 ${esc(c.brand)} ${esc(c.model)}</b> ${c.year ? esc(c.year) : ''}<div class="small muted">${esc(c.plate || '')} ${c.engine_volume ? '· ' + esc(c.engine_volume) + ' л' : ''}</div></div><button class="danger" data-del="${c.id}">Удалить</button></div>`).join('') || '<p class="muted">Машин пока нет — добавьте, чтобы быстрее заполнять заявки.</p>'}
    <form class="card" id="carForm"><h3>Добавить авто</h3><label>Марка</label><input name="brand" list="brands" required><datalist id="brands">${S.ref.brands.map((b) => `<option>${esc(b.name)}</option>`).join('')}</datalist>
    <label>Модель</label><input name="model" list="models"><datalist id="models">${S.ref.models.map((m) => `<option>${esc(m.name)}</option>`).join('')}</datalist>
    <div class="row"><div class="grow"><label>Год</label><input name="year" type="number" min="1950" max="2030"></div><div class="grow"><label>Объём, л</label><input name="engine_volume" placeholder="2.0"></div></div>
    <label>Госномер (необязательно)</label><input name="plate"><button class="p" style="margin-top:12px">Добавить</button></form>${reg}
    <div class="card row between"><span>Пора на ТО?</span><a class="btn p" href="#/new/sto?desc=${encodeURIComponent('Плановое ТО: замена масла и фильтров')}">Записаться на ТО</a></div>`;
}
garage.after = (v) => {
  $$('[data-del]', v).forEach((b) => b.onclick = () => act(b, () => api.deleteVehicle(+b.dataset.del), 'Удалено'));
  const f = $('#carForm', v); if (f) f.onsubmit = (e) => { e.preventDefault(); const d = formData(f); act($('button', f), () => api.addVehicle({ ...d, year: d.year ? +d.year : null }), 'Авто добавлено'); };
};

// ------------------------------------------------------------ цены
async function prices(_, q) {
  const cats = [...new Set(S.ref.price_services.map((s) => s.category))];
  const res = (q.s || q.b) ? await api.searchPrices({ service: q.s, brand: q.b }) : null;
  const local = res && res.filter((p) => !p.provider || p.provider.city === S.city);
  return `<h1>💰 Узнать цены</h1><form class="card" id="pf"><label>Категория</label><select id="pcat"><option value="">Все</option>${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
    <label>Услуга</label><input name="s" list="svcl" value="${esc(q.s || '')}" placeholder="Например: колодки, масло, амортизатор"><datalist id="svcl">${S.ref.price_services.map((s) => `<option data-c="${esc(s.category)}">${esc(s.name)}</option>`).join('')}</datalist>
    <label>Марка</label><select name="b"><option value="">Любая</option>${S.ref.brands.map((b) => `<option ${q.b === b.name ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
    <button class="p" style="margin-top:12px">Показать цены</button></form>
    ${local ? (local.length ? `<div class="card"><table><tr><th>Услуга</th><th>Где</th><th>Цена</th><th></th></tr>${local.map((x) => `<tr><td>${esc(x.service)}<div class="small muted">${esc([x.brand, x.model].filter(Boolean).join(' ') || 'все марки')}</div></td>
      <td>${x.provider ? `<a href="#/provider/${x.provider.id}">${esc(x.provider.name)}</a>` : '<span class="muted small">Справочная цена АвтоМастер24</span>'}</td><td><b>${money(x.price)}</b></td>
      <td>${x.provider ? `<a class="btn p" href="#/new/sto?to=${x.provider.id}&sub=${encodeURIComponent(x.service)}">Записаться</a>` : `<a class="btn" href="#/new/sto?sub=${encodeURIComponent(x.service)}">Заявка</a>`}</td></tr>`).join('')}</table></div>`
      : '<div class="empty">Ничего не нашли. Попробуйте короче, например «колодки».</div>') : '<p class="muted small">Цены задают сами СТО в своём кабинете. Справочные цены — ориентир из базы бота.</p>'}`;
}
prices.after = (v) => {
  const f = $('#pf', v), pc = $('#pcat', v);
  pc.onchange = () => { $('#svcl', v).innerHTML = S.ref.price_services.filter((s) => !pc.value || s.category === pc.value).map((s) => `<option>${esc(s.name)}</option>`).join(''); };
  f.onsubmit = (e) => { e.preventDefault(); const d = formData(f); location.hash = `#/prices?s=${encodeURIComponent(d.s || '')}&b=${encodeURIComponent(d.b || '')}`; };
};

// ------------------------------------------------------------ вход и профиль
const siteBadge = () => `<span class="site-badge" title="Этот сайт: ${esc(CONFIG.SITE_LABEL)}">${esc(CONFIG.SITE_LABEL)}</span>`;
async function login() {
  if (S.me) { location.hash = '#/profile'; return ''; }
  if (IS_DEMO) return `<h1>Вход</h1><div class="card"><p>Сайт в демо-режиме — выберите, за кого войти:</p><div class="row"><button class="p" data-demo2="client">👤 Клиент</button><button data-demo2="master">🛠 Исполнитель (СТО, мойка, эвакуатор…)</button><button data-demo2="admin">🛡 Администратор</button></div></div>`;
  return `<h1>Вход ${siteBadge()}</h1><div class="card"><p>Вы входите на сайт <b>${esc(CONFIG.SITE_LABEL)}</b> (гибрид АвтоМастер24 и ВЕЗУ, адрес …/avtomaster-vezu/). Это отдельный аккаунт: вход и права здесь не связаны со старым сайтом АвтоМастер24 (…/avtomaster24-web/), там вы остаётесь в своей учётной записи.</p>
    <p>Войдите через Telegram. Мы получаем только имя и username, а телефон вы укажете сами в профиле.</p><div id="tgw"></div>
    ${hint(`В окне Telegram будет имя бота входа @${esc(CONFIG.TELEGRAM_LOGIN_BOT)}: он только подтверждает, что это вы. Сообщения он не присылает.`)}
    <p class="small muted">Если кнопка не появилась, отключите блокировщик рекламы или откройте сайт в обычном браузере.</p></div>`;
}
login.after = (v) => {
  $$('[data-demo2]', v).forEach((b) => b.onclick = async () => { await api.loginDemo(b.dataset.demo2); await refreshMe(); location.hash = b.dataset.demo2 === 'master' ? '#/cabinet' : b.dataset.demo2 === 'admin' ? '#/admin' : '#/profile'; });
  const box = $('#tgw', v); if (!box) return;
  window.onTelegramAuth = async (u) => { try { await api.loginTelegram(u); await refreshMe(); toast(`Добро пожаловать на ${CONFIG.SITE_LABEL}!`); location.hash = S.me?.phone ? '#/' : '#/profile'; } catch (e) { toast(e.message, true); } };
  const s = document.createElement('script'); s.async = true; s.src = 'https://telegram.org/js/telegram-widget.js?22';
  s.dataset.telegramLogin = CONFIG.TELEGRAM_LOGIN_BOT; s.dataset.size = 'large'; s.dataset.radius = '12'; s.dataset.onauth = 'onTelegramAuth(user)'; s.dataset.requestAccess = 'write';
  box.appendChild(s);
};
async function profile() {
  if (!S.me) return login();
  const regs = await api.myRegistrations();
  return `<h1>Профиль</h1><form class="card" id="prf"><label>Имя</label><input name="full_name" value="${esc(S.me.full_name || '')}" required>
    <label>Телефон (Казахстан)</label><input name="phone" type="tel" value="${esc(S.me.phone || '')}" placeholder="+7 7XX XXX XX XX">
    <label>Город</label><select name="city">${S.ref.cities.filter((c) => c.active).map((c) => `<option ${c.name === (S.me.city || S.city) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <label class="check"><input type="checkbox" name="consent" ${S.me.consent ? 'checked' : ''}> <span>Согласен(на) на обработку персональных данных (имя и телефон) для передачи исполнителю, который примет мою заявку. Закон РК «О персональных данных и их защите».</span></label>
    <button class="p" style="margin-top:12px">Сохранить</button></form>
    ${regs.length ? `<div class="card"><h3>Мои заявки на подключение бизнеса</h3>${regs.map((g) => `<div class="row between small"><span>${KINDS[g.kind].icon} ${esc(g.name)}</span>${badge(g.status)}</div>${g.reason ? `<div class="small muted">${esc(g.reason)}</div>` : ''}`).join('')}</div>` : ''}
    <div class="card row">${S.myProv.length ? '<a class="btn" href="#/cabinet">🛠 Кабинет исполнителя</a>' : '<a class="btn" href="#/business">💼 Подключить бизнес</a>'}${isAdmin() ? '<a class="btn" href="#/admin">🛡 Админ</a>' : ''}<a class="btn" href="#/garage">🚗 Гараж</a>
    ${IS_DEMO ? '' : '<a class="btn" href="?demo=1#/">🧪 Посмотреть демо</a>'}<button class="btn" data-install hidden>📲 Установить приложение</button><button class="danger" id="delData">Удалить мои данные</button><button class="ghost" id="logout">Выйти</button></div>`;
}
profile.after = (v) => {
  const f = $('#prf', v); if (!f) return login.after(v);
  f.onsubmit = (e) => { e.preventDefault(); const d = formData(f); act($('button', f), async () => { S.me = await api.updateProfile({ ...d, consent: !!d.consent }); S.city = d.city; localStorage.setItem('am24v-city', S.city); }, 'Профиль сохранён'); };
  installBtns(v);
  $('#logout', v).onclick = async () => { await api.logout(); await refreshMe(); location.hash = '#/'; };
  $('#delData', v).onclick = () => { if (confirm('Удалить телефон и согласие? Заявки и отзывы сохранятся.')) act(null, async () => { await api.deleteMyData(); await refreshMe(); }, 'Данные удалены'); };
};

// ------------------------------------------------------------ подключение бизнеса
async function business(_, q = {}) {
  const v4 = S.caps.v4;
  const intro = v4 ? `<h1>🪪 Визитка для бизнеса</h1><div class="card"><p>СТО, эвакуатор, мойка, магазин запчастей, выездной мастер или <b>грузоперевозчик</b> — создайте бесплатную визитку за минуту:</p>
    <ul class="small"><li>своя страница и <b>QR-код</b> для визиток, наклеек и машины;</li><li>кнопки «Позвонить» и <b>${PRIMARY.label}</b>, услуги и цены, адрес на карте, фото;</li><li>все заявки и заказы приходят вам в ${PRIMARY.label} и видны в <b>кабинете</b> со статусами;</li><li>магазину — <b>витрина с товарами</b> и заказом в ${PRIMARY.label} (или ссылка на ваш сайт «Учёт + Магазин»);</li><li>вы в каталоге города и получаете заявки «всем в городе».</li></ul>
    <p class="small muted">Визитка привязана к вашему входу через Telegram — менять её можете только вы. Отметку «✔ Проверен» ставит администратор. <a href="#/tariffs">Тарифы</a></p></div>`
    : `<h1>💼 Для бизнеса</h1><div class="card"><p>Подключите СТО, мойку, эвакуатор, магазин запчастей или выездного мастера. После проверки администратором у вас появится <b>Кабинет исполнителя</b>: входящие заявки города, принятие, прайс, рейтинг.</p></div>`;
  if (!S.me) return intro + needLogin(v4 ? 'создания визитки' : 'подключения бизнеса');
  const kinds = Object.entries(KINDS).filter(([k]) => v4 || k !== 'cargo');
  return `${intro}${hint('Заполните главное — название, телефон и город. Остальное (услуги, цены, фото, часы) можно добавить потом в кабинете. Визитку видно сразу после создания.')}<form class="card" id="bf"><label>Кто вы</label>${opts('kind', kinds.map(([k, x]) => [k, x.icon + ' ' + x.short]), KINDS[q.kind] && (q.kind !== 'cargo' || v4) ? q.kind : 'sto')}
    <label>Название ${tip('Как вас знают клиенты: «СТО Мотор», «Газель Ерлан», «Эвакуатор 24»')}</label><input name="name" required maxlength="120"><div class="row"><div class="grow"><label>Телефон для клиентов</label><input name="phone" type="tel" required value="${esc(S.me.phone || '')}" placeholder="${esc(REGION.phone.placeholder)}"></div>
    ${v4 ? `<div class="grow"><label>${PRIMARY.label} для заявок ${tip('Сюда приходят заявки и заказы. Если пусто — используется телефон')}</label><input name="whatsapp" type="tel" placeholder="${esc(REGION.phone.placeholder)}"></div>` : ''}</div>
    <label>Город</label><select name="city">${S.ref.cities.filter((c) => c.active).map((c) => `<option ${c.name === S.city ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <label>Адрес</label><input name="address"><label>Часы работы</label><input name="working_hours" placeholder="09:00-19:00">
    <div data-k="sto"><label>Направления СТО</label>${opts('specs', S.ref.categories.map((c) => [String(c.id), c.name]), [], 'checkbox')}</div>
    <div data-k="parts" hidden><label>Тип</label>${opts('supplier_type', Object.entries(SUPPLIER), 'shop')}<label class="check"><input type="checkbox" name="delivery"> <span>Есть доставка</span></label></div>
    <div data-k="urgent" hidden><label>Специализация</label>${opts('service_type', Object.entries(URGENT), 'locksmith')}</div>
    <div data-k="wash" hidden><div class="row"><div class="grow"><label>Боксов</label><input name="boxes" type="number" min="1" value="1"></div><div class="grow"><label>Минут на машину</label><input name="slot_minutes" type="number" min="15" step="15" value="60"></div></div></div>
    <div data-k="cargo" hidden><label>Машина</label>${opts('cargo_vehicle', CARGO_VEHICLES.map((x) => [x.id, `${x.name} · ${x.cap}`]), 'gazel')}<label>Есть</label>${opts('extras', pairs(CARGO_EXTRAS), [], 'checkbox')}
      <div class="row"><div class="grow"><label>Цена от, ${REGION.symbol}</label><input name="cargo_price" type="number" min="0" step="500"></div><div class="grow"><label>За</label><select name="cargo_unit"><option>час</option><option>рейс</option></select></div></div><label>Районы</label><input name="zones" placeholder="Весь город и пригороды"></div>
    ${v4 ? `<label>О вас (необязательно)</label><textarea name="about" rows="2" maxlength="2000" placeholder="Коротко: что делаете лучше всего, гарантия, опыт"></textarea>` : ''}
    <button class="p" style="margin-top:14px">${v4 ? '🪪 Создать визитку' : 'Отправить на проверку'}</button></form>`;
}
business.after = (v) => {
  const f = $('#bf', v); if (!f) return;
  const sync = () => { const k = f.querySelector('[name=kind]:checked').value; $$('[data-k]', f).forEach((d) => { d.hidden = d.dataset.k !== k; }); };
  $$('[name=kind]', f).forEach((r) => r.onchange = sync); sync();
  f.onsubmit = (e) => { e.preventDefault(); const d = formData(f);
    const details = { working_hours: d.working_hours || '' };
    if (d.kind === 'sto') details.specs = [].concat(d.specs || []).map(Number);
    if (d.kind === 'parts') { details.supplier_type = d.supplier_type; details.delivery = !!d.delivery; }
    if (d.kind === 'urgent') details.service_type = d.service_type;
    if (d.kind === 'wash') { details.boxes = +d.boxes || 1; details.slot_minutes = +d.slot_minutes || 60; }
    if (!validPhone(d.phone) || (d.whatsapp && !validPhone(d.whatsapp))) return toast(`Телефон в формате ${REGION.phone.placeholder}`, true);
    if (S.caps.v4) {
      const card = d.kind === 'cargo' ? { cargo: { vehicle: d.cargo_vehicle, extras: [].concat(d.extras || []), price: d.cargo_price ? +d.cargo_price : null, unit: d.cargo_unit || 'час' }, zones: d.zones || '' } : {};
      return act($('button.p', f), async () => { const id = await api.createCard({ kind: d.kind, name: d.name, phone: d.phone, whatsapp: d.whatsapp || d.phone, city: d.city, address: d.address, about: d.about || '', ...details, card });
        await refreshMe(); location.hash = `#/cabinet?p=${id}&t=card`; }, 'Визитка создана! Отправьте ссылку или QR клиентам.');
    }
    act($('button.p', f), async () => { await api.registerBusiness({ kind: d.kind, name: d.name, phone: d.phone, city: d.city, address: d.address, details }); location.hash = '#/profile'; }, 'Заявка отправлена. Администратор проверит её.'); };
};

// ------------------------------------------------------------ WhatsApp-заявки (визитка, магазин, сайт)
const leadBadge = (st) => { const [t, c] = LEAD_STATUS[st] || [st, 'grey']; return `<span class="badge ${c}">${esc(t)}</span>`; };
const unread = (x) => x.last_from === 'client' && x.last_msg_at && (!x.owner_seen_at || x.last_msg_at > x.owner_seen_at) && !x.closed_at;
const leadCard = (x) => { const v5 = S.caps.v5, chat = ownerOrderUrl(x.id), svc = x.payload?.service;
  const next = v5 ? { new: [['in_work', '🔧 В работу', 'ok']], clarify: [['in_work', '🔧 В работу', 'ok']], agreed: [['in_work', '🔧 В работу', 'ok']], in_work: [['done', '🏁 Выполнено', 'ok']], done: [['paid', '💰 Оплата получена', 'ok']] }[x.status] || []
    : ({ new: [['in_work', '✅ Взять в работу', 'ok']], in_work: [['done', '🏁 Выполнено', 'ok']] }[x.status] || []);
  if (!['paid', 'closed', 'cancelled'].includes(x.status) && !(x.status === 'done' && !v5)) next.push(['cancelled', 'Отменить', 'ghost']);
  return `<div class="card lead ${unread(x) ? 'unread' : ''}"><div class="row between"><b>${x.kind === 'order' ? '🛍 Заказ' : `${KINDS[svc || x.kind]?.icon || '📝'} Заявка`} №${x.id}${unread(x) ? ' <span class="badge red">новое сообщение</span>' : ''}</b>${leadBadge(x.status)}</div>
  <div class="small muted">${dt(x.created_at)} · ${{ card: 'с визитки', shop: 'из магазина', app: 'с сайта', site: 'с сайта' }[x.source] || esc(x.source)}${x.total ? ' · <b>' + money(x.total) + '</b>' : ''}${x.agreed_price ? ' · согласовано <b>' + money(x.agreed_price) + '</b>' : ''}${x.rating ? ' · ' + '★'.repeat(x.rating) : ''}</div>
  <pre class="msgtext">${esc(x.message)}</pre>
  ${x.customer_name || x.customer_phone ? `<div class="row small"><b>👤 ${esc(x.customer_name || 'Клиент')}</b>${x.customer_phone ? `${tel(fmtPhone(x.customer_phone))}${wa(x.customer_phone, v5 ? `Здравствуйте${x.customer_name ? ', ' + x.customer_name : ''}! Ответил(а) вам в чате по заявке №${x.id}:\n${orderUrl(x.id)}&c=1` : `Здравствуйте${x.customer_name ? ', ' + x.customer_name : ''}! По вашей заявке №${x.id}:`)}` : '<span class="muted">телефон — в переписке ' + PRIMARY.label + '</span>'}</div>` : ''}
  <div class="row" style="margin-top:8px">${v5 && !x.chat_purged_at ? `<a class="btn sm p" href="${esc(chat)}">💬 Чат${x.closed_at ? ' (архив)' : ''}</a>` : ''}${next.map(([s2, t, c]) => `<button class="sm ${c}" data-lead="${x.id}:${s2}">${t}</button>`).join('')}${!v5 && x.status !== 'new' && x.status !== 'in_work' ? `<button class="sm ghost" data-lead="${x.id}:in_work">↩️ Вернуть в работу</button>` : ''}</div></div>`; };
// уведомление в браузере о новых сообщениях клиентов (кабинет обновляется сам)
function notifyLeads(L) {
  const seen = S.leadSeen || (S.leadSeen = new Map()); const first = !S.leadSeenInit; S.leadSeenInit = true;
  for (const x of L.filter(unread)) {
    if (!first && seen.get(x.id) !== x.last_msg_at && 'Notification' in window && Notification.permission === 'granted') {
      try { const n = new Notification(`Новое сообщение · заявка №${x.id}`, { body: `${x.customer_name || 'Клиент'} написал(а) в чате`, icon: 'assets/icon-192.png', tag: 'am24v-order-' + x.id }); n.onclick = () => { location.href = ownerOrderUrl(x.id); }; } catch { /* ignore */ }
    }
    seen.set(x.id, x.last_msg_at);
  }
}

// ------------------------------------------------------------ кабинет исполнителя
async function cabinet(_, q) {
  if (!S.me) return `<h1>Кабинет исполнителя</h1>${needLogin('кабинета')}`;
  S.myProv = await api.myProviders();
  if (!S.myProv.length) return `<h1>Кабинет исполнителя</h1><div class="card"><p>У вас пока нет подключённой организации.</p><a class="btn p" href="#/business">Подключить бизнес</a></div>`;
  const p = S.myProv.find((x) => x.id === +q.p) || S.myProv[0];
  const tab = q.t || 'feed';
  const head = `<h1>🛠 Кабинет ${siteBadge()}</h1><div class="tabs">${S.myProv.map((x) => `<a href="#/cabinet?p=${x.id}&t=${tab}" class="${x.id === p.id ? 'on' : ''}">${KINDS[x.kind].icon} ${esc(x.name)}</a>`).join('')}</div>
    ${p.is_active ? '' : '<div class="notice warn">Организация отключена администратором — новые заявки не приходят.</div>'}
    <div class="tabs">${[['feed', '📥 Заявки'], ...(S.caps.v4 ? [['leads', S.caps.v5 ? '💬 Заявки и чаты' : `📲 ${PRIMARY.label}`], ['card', '🪪 Визитка']] : []), ...(S.caps.v4 && p.kind === 'parts' ? [['shop', '🛍 Магазин']] : []), ...(p.kind === 'sto' ? [['prices', '💰 Прайс']] : []), ['reviews', '⭐ Отзывы'], ['org', '🏢 Профиль'], ...(S.caps.v4 ? [] : [['link', '🔗 Ссылка']])].map(([t, n]) => `<a href="#/cabinet?p=${p.id}&t=${t}" class="${t === tab ? 'on' : ''}">${n}</a>`).join('')}</div>`;
  if (tab === 'prices') {
    const pr = await api.providerPrices(p.id);
    return `${head}<div class="card"><h3>Мой прайс</h3>${pr.length ? `<table><tr><th>Услуга</th><th>Авто</th><th>Цена</th><th></th></tr>${pr.map((x) => `<tr><td>${esc(x.service)}</td><td>${esc([x.brand, x.model].filter(Boolean).join(' ') || 'Все')}${x.year_from ? ` ${x.year_from}–${x.year_to || ''}` : ''}</td><td>${money(x.price)}</td><td><button class="danger" data-dp="${x.id}">✕</button></td></tr>`).join('')}</table>` : '<p class="muted">Прайс пуст. Клиенты находят вас в «Узнать цены» по этим строкам.</p>'}</div>
      <form class="card" id="prForm"><h3>Добавить цену</h3><label>Услуга</label><input name="service" list="svc2" required><datalist id="svc2">${S.ref.price_services.map((s) => `<option>${esc(s.name)}</option>`).join('')}</datalist>
      <div class="row"><div class="grow"><label>Марка («все» — пусто)</label><input name="brand" list="br2"><datalist id="br2">${S.ref.brands.map((b) => `<option>${esc(b.name)}</option>`).join('')}</datalist></div><div class="grow"><label>Модель</label><input name="model"></div></div>
      <div class="row"><div class="grow"><label>Год от</label><input name="year_from" type="number"></div><div class="grow"><label>Год до</label><input name="year_to" type="number"></div><div class="grow"><label>Цена, ₸</label><input name="price" type="number" min="1" required></div></div>
      <button class="p" style="margin-top:12px">Добавить</button></form>`;
  }
  if (tab === 'reviews') {
    const revs = await api.providerReviews(p.id);
    return `${head}<div class="card"><h3>Отзывы о вас</h3><p class="small muted">Отвечайте на отзывы — клиенты видят ответы на вашей странице. Это повышает доверие.</p>
      ${revs.map((r) => `<div class="rev"><div>${stars(r.rating)} <span class="small muted">${dt(r.created_at)}${r.is_published ? '' : ' · на модерации'}</span></div>${r.comment ? `<p>${esc(r.comment)}</p>` : ''}
      ${S.caps.v3 ? `<form class="row" data-reply="${r.id}"><input name="t" class="grow" placeholder="Ваш ответ" value="${esc(r.reply || '')}"><button class="sm">${r.reply ? 'Изменить' : 'Ответить'}</button></form>` : ''}</div>`).join('') || '<p class="muted">Отзывов пока нет.</p>'}</div>`;
  }
  if (tab === 'org') {
    const v3 = S.caps.v3;
    return `${head}<form class="card" id="orgForm"><label>Название</label><input name="name" value="${esc(p.name)}" required><label>Телефон</label><input name="phone" value="${esc(p.phone)}">
      <label>Адрес ${tip('Улица и дом — клиенты откроют вас в 2ГИС')}</label><input name="address" value="${esc(p.address)}"><label>Часы работы ${tip('Формат 09:00-19:00 или «Круглосуточно» — по ним работает фильтр «Открыто сейчас» и запись по времени')}</label><input name="working_hours" value="${esc(p.working_hours)}" placeholder="09:00-19:00">
      ${v3 ? `<label>WhatsApp для клиентов</label><input name="whatsapp" type="tel" value="${esc(p.whatsapp || '')}" placeholder="+7 7XX XXX XX XX">
      <label>О вас ${tip('2–3 предложения: что делаете лучше всего, оборудование, гарантия, удобства')}</label><textarea name="about" rows="3" maxlength="2000" placeholder="Например: ремонт ходовой и двигателя, гарантия 6 месяцев, зона ожидания с Wi‑Fi">${esc(p.about || '')}</textarea>` : ''}
      ${p.kind === 'sto' ? `<label>Направления (пусто — получать все заявки СТО)</label>${opts('specs', S.ref.categories.map((c) => [String(c.id), c.name]), p.specs.map(String), 'checkbox')}` : ''}
      ${p.kind === 'wash' ? `<div class="row"><div class="grow"><label>Боксов</label><input name="boxes" type="number" min="1" value="${p.boxes}"></div><div class="grow"><label>Минут на машину</label><input name="slot_minutes" type="number" min="15" step="15" value="${p.slot_minutes}"></div></div>` : ''}
      ${p.kind === 'parts' ? `<label class="check"><input type="checkbox" name="delivery" ${p.delivery ? 'checked' : ''}> <span>Есть доставка</span></label>` : ''}
      <p class="small muted">Рейтинг: ${stars(p.rating)} ${Number(p.rating).toFixed(1)} (${p.reviews_count} отз.) · город ${esc(p.city)} ${p.verified ? '· ✔ Проверен' : ''}</p><button class="p">Сохранить</button></form>
      ${v3 ? `<div class="card"><h3>Фото организации (${(p.photos || []).length}/12)</h3><p class="small muted">Фасад, цех, оборудование, результат работы. Карточки с фото выбирают чаще.</p>
        <div class="photos">${(p.photos || []).map((u, i) => `<span class="ph"><img src="${esc(u)}" alt="Фото ${i + 1}"><button type="button" class="rm" data-delph="${i}" aria-label="Удалить фото">✕</button></span>`).join('')}</div>
        <label class="drop"><input type="file" id="orgPh" accept="image/*" multiple hidden><span>📷 Добавить фото</span></label></div>` : ''}`;
  }
  if (tab === 'leads' && S.caps.v4) {
    const L = await api.myLeads(p.id); autoRefresh(); if (S.caps.v5) notifyLeads(L);
    const f = q.f || 'open', OPEN = ['new', 'clarify', 'agreed', 'in_work', 'done', 'paid'];
    const flt = (k) => L.filter((x) => k === 'all' || (k === 'open' ? OPEN.includes(x.status) : k === 'unread' ? unread(x) : k === 'closed' ? ['closed', 'cancelled'].includes(x.status) : x.status === k));
    const chips = S.caps.v5 ? [['open', 'Открытые'], ['unread', '🔴 Непрочитанные'], ['new', 'Новые'], ['in_work', 'В работе'], ['done', 'Ждут оплаты'], ['closed', 'Закрытые'], ['all', 'Все']]
      : [['open', 'Открытые'], ['new', 'Новые'], ['in_work', 'В работе'], ['done', 'Выполнены'], ['cancelled', 'Отменены'], ['all', 'Все']];
    return `${head}<p class="small muted">${S.caps.v5 ? `Заявки и заказы с визитки, магазина и сайта. По каждой есть <b>чат на сайте</b>: уточняйте детали, предлагайте цену, меняйте статус. ${PRIMARY.label} приходит как уведомление со ссылкой на чат. Переписка удаляется через 3 дня после закрытия (оплата + оценка), итог и отзыв остаются.` : `Здесь заявки и заказы, которые клиенты отправили вам в ${PRIMARY.label} с визитки, магазина и сайта. Отмечайте статус — так ничего не потеряется.`} Заявки «всем в городе» — во вкладке «Заявки».</p>
      ${S.caps.v5 && 'Notification' in window && Notification.permission !== 'granted' ? '<button class="sm" id="notifOn">🔔 Уведомлять о новых сообщениях</button>' : ''}
      <div class="fchips">${chips.map(([k, t]) => `<a class="fchip ${f === k ? 'on' : ''}" href="#/cabinet?p=${p.id}&t=leads&f=${k}">${t} (${flt(k).length})</a>`).join('')}</div>
      ${flt(f).map((x) => leadCard(x)).join('') || empty('📲', 'Пока пусто. Поделитесь визиткой — заявки появятся здесь.', `<a class="btn p" href="#/cabinet?p=${p.id}&t=card">🪪 Моя визитка и QR</a>`)}`;
  }
  if (tab === 'card' && S.caps.v4) {
    const url = cardUrl(p.id), c = p.card || {}, cg = c.cargo || {};
    const qr = await qrSvg(url, { size: 180, label: 'QR-код визитки' }).catch(() => '');
    return `${head}<div class="card cardtab"><div class="qrbox">${qr}</div><div class="grow"><h3>🪪 Ваша визитка</h3><p class="small">Отправляйте ссылку клиентам, печатайте QR на визитках и наклейке на машину. По ссылке видно контакты, услуги и цены, а заявка уходит вам в ${PRIMARY.label} в одно касание.</p>
      <input readonly value="${esc(url)}" id="myLink" aria-label="Ссылка на визитку"><div class="row" style="margin-top:8px"><a class="btn p" href="card.html?id=${p.id}" target="_blank" rel="noopener">Открыть визитку</a><button id="copyLink">Скопировать</button><button id="qrDl">⬇️ QR для печати</button>
      <a class="btn wa" href="https://wa.me/?text=${encodeURIComponent(`${p.name} — моя визитка: ${url}`)}" target="_blank" rel="noopener">💬 Отправить</a><a class="btn" href="https://t.me/share/url?url=${encodeURIComponent(url)}" target="_blank" rel="noopener">✈️ Telegram</a></div></div></div>
      <form class="card" id="cardForm"><h3>Что показать на визитке</h3>
      <label>Слоган</label><input name="slogan" maxlength="80" value="${esc(c.slogan || '')}" placeholder="Например: Честный ремонт с гарантией">
      <label>Услуги и цены ${tip('Каждая строка — «Услуга — цена». Цена может быть числом или текстом: «от 5000», «договорная»')}</label><textarea name="services" rows="5" placeholder="Замена масла — 4000&#10;Диагностика — 5000">${esc((c.services || []).map((x) => `${x.name}${x.price != null && x.price !== '' ? ' — ' + x.price : ''}`).join('\n'))}</textarea>
      ${p.kind === 'cargo' ? `<label>Машина</label>${opts('cargo_vehicle', CARGO_VEHICLES.map((x) => [x.id, `${x.name} · ${x.cap}`]), cg.vehicle || 'gazel')}<label>Есть</label>${opts('extras', pairs(CARGO_EXTRAS), cg.extras || [], 'checkbox')}
        <div class="row"><div class="grow"><label>Цена от, ${REGION.symbol}</label><input name="cargo_price" type="number" min="0" step="500" value="${esc(cg.price || '')}"></div><div class="grow"><label>За</label><select name="cargo_unit">${['час', 'рейс'].map((u) => `<option ${cg.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
        <label>Районы</label><input name="zones" value="${esc(c.zones || '')}" placeholder="Весь город и пригороды">` : ''}
      <label>Оплата</label>${opts('payments', REGION.payments, c.payments || [], 'checkbox')}
      <div class="row"><div class="grow"><label>Telegram (username)</label><input name="tg" value="${esc(c.tg || '')}" placeholder="username"></div><div class="grow"><label>Instagram</label><input name="ig" value="${esc(c.ig || '')}" placeholder="username"></div></div>
      <p class="small muted">Название, телефон, ${PRIMARY.label}, адрес, часы работы, фото и «О нас» — во вкладке <a href="#/cabinet?p=${p.id}&t=org">«Профиль»</a>.</p><button class="p">Сохранить визитку</button></form>`;
  }
  if (tab === 'shop' && S.caps.v4) {
    const items = await api.myProducts(p.id), c = p.card || {};
    const ed = q.e ? items.find((x) => x.id === +q.e) : null;
    const cats = [...new Set(items.map((x) => x.category).filter(Boolean))];
    return `${head}<form class="card" id="shopSet"><h3>🛍 Интернет-магазин</h3><p class="small">На визитке появится кнопка <b>«Магазин»</b>: покупатель смотрит товары, кладёт в корзину и отправляет заказ вам в ${PRIMARY.label}. Заказ сохраняется во вкладке «${PRIMARY.label}». Витрина привязана к этой организации — товары меняете только вы.</p>
      <label class="check"><input type="checkbox" name="shop_enabled" ${p.shop_enabled ? 'checked' : ''}> <span>Показывать витрину с товарами</span></label>
      <div class="row"><div class="grow"><label>Название витрины</label><input name="shop_title" value="${esc(c.shop_title || p.name)}"></div><div style="width:120px"><label>Цвет</label><input name="shop_accent" type="color" value="${esc(c.shop_accent || '#E8B84B')}"></div></div>
      <label>Или ссылка на ваш сайт «Учёт + Магазин» ${tip('Если у вас уже есть сайт на платформе «Учёт + Магазин» (как biznes-shablon.vercel.app) — вставьте адрес, и кнопка «Магазин» поведёт туда. Пусто — витрина здесь.')}</label><input name="store_url" type="url" placeholder="https://ваш-магазин.example.kz" value="${esc(p.store_url || '')}">
      <div class="row" style="margin-top:10px"><button class="p">Сохранить</button><a class="btn" href="${esc(shopUrl(p))}" target="_blank" rel="noopener">Открыть магазин</a></div></form>
      <div class="card"><h3>Товары (${items.length})</h3>${items.length ? `<table><tr><th>Товар</th><th>Раздел</th><th>Цена</th><th>Остаток</th><th></th></tr>${items.map((x) => `<tr><td>${x.photo ? `<img class="tthumb" src="${esc(x.photo)}" alt="">` : ''}<b>${esc(x.name)}</b><div class="small muted mono">${esc(x.sku || '')}${x.is_published ? '' : ' · скрыт'}</div></td><td>${esc(x.category || '—')}</td><td>${money(x.price)}</td><td>${x.stock ?? '∞'}</td>
        <td class="row"><a class="btn sm" href="#/cabinet?p=${p.id}&t=shop&e=${x.id}">✏️</a><button class="sm danger" data-dprod="${x.id}" aria-label="Удалить">✕</button></td></tr>`).join('')}</table>` : '<p class="muted">Товаров пока нет — добавьте первый ниже.</p>'}</div>
      <form class="card" id="prodForm"><h3>${ed ? 'Изменить товар' : 'Добавить товар'}</h3><input type="hidden" name="id" value="${ed?.id || ''}"><input type="hidden" name="photo" value="${esc(ed?.photo || '')}">
      <label>Название</label><input name="name" required maxlength="160" value="${esc(ed?.name || '')}">
      <div class="row"><div class="grow"><label>Раздел</label><input name="category" list="pcats" value="${esc(ed?.category || '')}" placeholder="Масла, Фильтры…"><datalist id="pcats">${cats.map((x) => `<option>${esc(x)}</option>`).join('')}</datalist></div>
      <div class="grow"><label>Цена, ${REGION.symbol}</label><input name="price" type="number" min="0" required value="${ed?.price ?? ''}"></div><div class="grow"><label>Остаток ${tip('Пусто — не показывать остаток')}</label><input name="stock" type="number" min="0" value="${ed?.stock ?? ''}"></div></div>
      <label>Описание</label><textarea name="description" rows="2" maxlength="2000">${esc(ed?.description || '')}</textarea>
      <label>Фото</label><div class="row"><span id="prodPrev">${ed?.photo ? `<img class="tthumb big" src="${esc(ed.photo)}" alt="">` : ''}</span><label class="drop grow"><input type="file" id="prodPh" accept="image/*" hidden><span>📷 Выбрать фото</span></label></div>
      <label class="check"><input type="checkbox" name="is_published" ${!ed || ed.is_published ? 'checked' : ''}> <span>Показывать на витрине</span></label>
      <div class="row" style="margin-top:10px"><button class="p">${ed ? 'Сохранить' : 'Добавить товар'}</button>${ed ? `<a class="btn" href="#/cabinet?p=${p.id}&t=shop">Отмена</a>` : ''}</div></form>`;
  }
  if (tab === 'link') {
    const url = `${siteUrl()}#/provider/${p.id}`;
    return `${head}<div class="card"><h3>Ваша визитка</h3><p>Отправляйте клиентам — по ссылке они видят ваши контакты, рейтинг и сразу оставляют заявку именно вам.</p><input readonly value="${esc(url)}" id="myLink"><div class="row" style="margin-top:10px"><button class="p" id="copyLink">Скопировать</button><a class="btn" href="https://t.me/share/url?url=${encodeURIComponent(url)}" target="_blank" rel="noopener">Поделиться в Telegram</a><a class="btn" href="https://wa.me/?text=${encodeURIComponent(url)}" target="_blank" rel="noopener">WhatsApp</a></div></div>`;
  }
  const [feed, myOffers] = await Promise.all([api.providerFeed(p.id), p.kind === 'parts' ? api.myOffers(p.id) : []]);
  autoRefresh();
  const groups = { 'Новые': feed.filter((r) => ['new', 'offers'].includes(effStatus(r)) && r.accepted_by !== p.id),
    'В работе': feed.filter((r) => r.accepted_by === p.id && !['completed', 'cancelled'].includes(r.status)),
    'Завершённые': feed.filter((r) => r.accepted_by === p.id && ['completed', 'cancelled'].includes(r.status)).slice(0, 20) };
  const card = (r) => {
    const st = effStatus(r), mine = r.accepted_by === p.id, off = myOffers.find((o) => o.request_id === r.id);
    let a = '';
    if (!mine && ['tow', 'sto', 'urgent', 'cargo'].includes(r.type) && st === 'new') a = `<button class="ok" data-acc="${r.id}">✅ Принять</button><button class="ghost" data-dec="${r.id}">Отклонить</button>`;
    if (r.type === 'parts' && ['new', 'offers'].includes(st) && !mine) a = `<form class="row grow" data-offer-form="${r.id}"><input name="price" type="number" min="1" placeholder="Цена, ₸" required value="${off ? off.price : ''}" style="max-width:130px"><input name="comment" class="grow" placeholder="Оригинал/аналог, наличие" value="${esc(off?.comment || '')}"><button class="p">${off ? 'Изменить' : 'Предложить'}</button></form>${off ? '<span class="small muted">Ваше предложение отправлено, клиент выбирает</span>' : ''}<button class="ghost" data-dec="${r.id}">Скрыть</button>`;
    if (r.type === 'wash' && ['new', 'price_offered'].includes(r.status)) {
      const t = (r.assigned_time || r.desired_time || new Date().toISOString());
      const local = new Date(new Date(t).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      a = `<form class="row grow" data-wash-form="${r.id}"><input name="price" type="number" min="1" placeholder="Цена, ₸" required value="${r.price || ''}" style="max-width:120px"><input name="time" type="datetime-local" required value="${local}" style="max-width:220px"><button class="p">${r.status === 'price_offered' ? 'Изменить' : 'Предложить цену и время'}</button></form>${r.status === 'price_offered' ? '<span class="small muted">Ждём подтверждения клиента</span>' : ''}`;
    }
    if (mine && r.type === 'wash') a += { client_approved: `<button class="p" data-ws="in_progress:${r.id}">🧽 Начать мойку</button>`, in_progress: `<button class="p" data-ws="waiting_client:${r.id}">🚗 Готово, ждём клиента</button><button class="ok" data-ws="completed:${r.id}">Завершить</button>`, waiting_client: `<button class="ok" data-ws="completed:${r.id}">✅ Клиент забрал</button>` }[r.status] || '';
    if (mine && r.type !== 'wash' && r.status === 'active') a += `<form class="row" data-done="${r.id}">${r.type !== 'parts' ? `<input name="amount" type="number" min="0" placeholder="Сумма, ₸" style="max-width:130px" value="${r.final_amount || ''}">` : ''}<button class="ok">${r.type === 'parts' ? '📦 Передал клиенту' : '✅ Завершить'}</button></form>`;
    if (mine && !['completed', 'cancelled', 'new', 'price_offered'].includes(r.status)) a += `<button data-contact="${r.id}">👤 Контакт клиента</button><span data-c="${r.id}"></span>`;
    if (mine && S.caps.v3 && r.status !== 'cancelled') a += `<a class="btn sm" href="#/chat/${r.id}">💬 Чат с клиентом</a>`;
    return `<div class="card"><div class="row between"><b>${reqTitle(r)}</b>${badge(st)}</div>${reqInfo(r)}<div class="row" style="margin-top:10px">${a}</div></div>`;
  };
  const done = feed.filter((r) => r.accepted_by === p.id && r.status === 'completed');
  const tips = [!p.photos?.length && S.caps.v3 && 'добавьте фото', !p.about && S.caps.v3 && 'напишите пару слов о себе', !p.working_hours && 'укажите часы работы'].filter(Boolean);
  return `${head}<div class="stats"><div><b>${groups['Новые'].length}</b><small>новых</small></div><div><b>${groups['В работе'].length}</b><small>в работе</small></div><div><b>${done.length}</b><small>выполнено</small></div><div><b>${money(done.reduce((s, r) => s + (r.final_amount || 0), 0))}</b><small>оборот</small></div></div>
    ${tips.length ? `<div class="notice">💡 Чтобы получать больше заказов: <a href="#/cabinet?p=${p.id}&t=org">${tips.join(', ')}</a>.</div>` : ''}
    <p class="small muted">Лента обновляется каждые ${CONFIG.REFRESH_SECONDS} сек. Новые заявки города ${esc(p.city)} по вашему профилю появляются здесь.</p>
    ${Object.entries(groups).map(([g, list]) => `<h3>${g} (${list.length})</h3>${list.map(card).join('') || '<p class="muted small">Пусто</p>'}`).join('')}`;
}
cabinet.after = (v, _, q) => {
  const pid = +(q.p || S.myProv[0]?.id);
  $$('[data-acc]', v).forEach((b) => b.onclick = () => act(b, () => api.accept(+b.dataset.acc, pid), 'Заявка ваша! Контакт клиента открыт.'));
  $$('[data-dec]', v).forEach((b) => b.onclick = () => act(b, () => api.decline(+b.dataset.dec, pid), 'Скрыто'));
  $$('[data-offer-form]', v).forEach((f) => f.onsubmit = (e) => { e.preventDefault(); const d = formData(f); act($('button', f), () => api.makeOffer(+f.dataset.offerForm, pid, d.price, d.comment), 'Предложение отправлено клиенту'); });
  $$('[data-wash-form]', v).forEach((f) => f.onsubmit = (e) => { e.preventDefault(); const d = formData(f); act($('button', f), () => api.washQuote(+f.dataset.washForm, pid, d.price, new Date(d.time).toISOString()), 'Отправлено клиенту на подтверждение'); });
  $$('[data-ws]', v).forEach((b) => b.onclick = () => { const [st, id] = b.dataset.ws.split(':'); act(b, () => api.washStatus(+id, pid, st), 'Статус обновлён'); });
  $$('[data-done]', v).forEach((f) => f.onsubmit = (e) => { e.preventDefault(); const d = formData(f); act($('button', f), () => api.complete(+f.dataset.done, pid, d.amount), 'Готово'); });
  $$('[data-contact]', v).forEach((b) => b.onclick = async () => { try { const c = await api.clientContact(+b.dataset.contact); $(`[data-c="${b.dataset.contact}"]`, v).innerHTML = `<b>${esc(c.full_name)}</b> ${tel(c.phone)} ${c.username ? `<a href="https://t.me/${esc(c.username)}" target="_blank" rel="noopener">✈️ @${esc(c.username)}</a>` : ''}`; } catch (e) { toast(e.message, true); } });
  $$('[data-dp]', v).forEach((b) => b.onclick = () => act(b, () => api.deletePrice(+b.dataset.dp), 'Удалено'));
  const pf = $('#prForm', v); if (pf) pf.onsubmit = (e) => { e.preventDefault(); const d = formData(pf); act($('button', pf), () => api.addPrice({ provider_id: pid, service: d.service, brand: d.brand || '', model: d.model || '', year_from: d.year_from ? +d.year_from : null, year_to: d.year_to ? +d.year_to : null, price: +d.price }), 'Цена добавлена'); };
  $$('[data-reply]', v).forEach((f) => f.onsubmit = (e) => { e.preventDefault(); act($('button', f), () => api.replyReview(+f.dataset.reply, f.t.value), 'Ответ сохранён'); });
  const cur = S.myProv.find((x) => x.id === pid);
  const op = $('#orgPh', v); if (op) op.onchange = () => act(null, async () => {
    const list = [...(cur.photos || [])];
    for (const file of [...op.files].slice(0, 12 - list.length)) list.push(await api.uploadProviderPhoto(pid, await compress(file)));
    await api.updateProvider(pid, { photos: list }); S.myProv = await api.myProviders();
  }, 'Фото добавлены');
  $$('[data-delph]', v).forEach((b) => b.onclick = () => { if (confirm('Удалить фото?')) act(b, async () => { const list = [...(cur.photos || [])]; list.splice(+b.dataset.delph, 1); await api.updateProvider(pid, { photos: list }); }, 'Удалено'); });
  const of = $('#orgForm', v); if (of) of.onsubmit = (e) => { e.preventDefault(); const d = formData(of); const patch = { name: d.name, phone: d.phone, address: d.address, working_hours: d.working_hours };
    if ('about' in d) { patch.about = d.about; patch.whatsapp = d.whatsapp; }
    if ($('[name=specs]', of)) patch.specs = [].concat(d.specs || []).map(Number); if (d.boxes) { patch.boxes = +d.boxes; patch.slot_minutes = +d.slot_minutes; } if ($('[name=delivery]', of)) patch.delivery = !!d.delivery;
    act($('button', of), () => api.updateProvider(pid, patch), 'Сохранено'); };
  const cl = $('#copyLink', v); if (cl) cl.onclick = () => { navigator.clipboard?.writeText($('#myLink', v).value); toast('Ссылка скопирована'); };
  $$('[data-lead]', v).forEach((b) => b.onclick = () => { const [id, st] = b.dataset.lead.split(':'); act(b, () => api.setLeadStatus(+id, st), 'Статус обновлён'); });
  const nOn = $('#notifOn', v); if (nOn) nOn.onclick = async () => { const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Уведомления включены — пока открыт кабинет, браузер сообщит о новых сообщениях' : 'Уведомления не разрешены', r !== 'granted'); nOn.hidden = r === 'granted'; };
  const qd = $('#qrDl', v); if (qd) qd.onclick = async () => { try { download(`vizitka-${pid}.png`, await qrPng(cardUrl(pid), { title: cur.name, sub: CARD_ROLE[cur.kind] + ' · ' + cardUrl(pid).replace(/^https?:\/\//, '') })); } catch (e) { toast(e.message, true); } };
  const cf = $('#cardForm', v); if (cf) cf.onsubmit = (e) => { e.preventDefault(); const d = formData(cf);
    const services = String(d.services || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 40).map((l) => { const m = /^(.*?)\s*[—–-]\s*([^—–-]+)$/.exec(l); return m ? { name: m[1].trim(), price: /^\d+$/.test(m[2].trim()) ? +m[2].trim() : m[2].trim() } : { name: l, price: '' }; });
    const card = { ...(cur.card || {}), slogan: d.slogan || '', services, payments: [].concat(d.payments || []), tg: (d.tg || '').replace(/^@/, ''), ig: (d.ig || '').replace(/^@/, '') };
    if (cur.kind === 'cargo') Object.assign(card, { cargo: { vehicle: d.cargo_vehicle, extras: [].concat(d.extras || []), price: d.cargo_price ? +d.cargo_price : null, unit: d.cargo_unit || 'час' }, zones: d.zones || '' });
    act($('button.p', cf), () => api.updateProvider(pid, { card }), 'Визитка сохранена'); };
  const ss = $('#shopSet', v); if (ss) ss.onsubmit = (e) => { e.preventDefault(); const d = formData(ss);
    if (d.store_url && !/^https:\/\//.test(d.store_url)) return toast('Ссылка на магазин должна начинаться с https://', true);
    act($('button.p', ss), () => api.updateProvider(pid, { shop_enabled: !!d.shop_enabled, store_url: d.store_url || '', card: { ...(cur.card || {}), shop_title: d.shop_title || '', shop_accent: d.shop_accent || '' } }), 'Магазин сохранён'); };
  const pf2 = $('#prodForm', v); if (pf2) {
    const ph = $('#prodPh', v); if (ph) ph.onchange = async () => { const file = ph.files[0]; if (!file) return; try { toast('Загружаем фото…'); const u = await api.uploadProductPhoto(pid, await compress(file, 900, 0.8)); pf2.photo.value = u; $('#prodPrev', v).innerHTML = `<img class="tthumb big" src="${esc(u)}" alt="">`; toast('Фото загружено'); } catch (er) { toast(er.message, true); } };
    pf2.onsubmit = (e) => { e.preventDefault(); const d = formData(pf2);
      act($('button.p', pf2), async () => { await api.saveProduct(pid, { id: d.id ? +d.id : null, name: d.name, category: d.category, price: +d.price, stock: d.stock, description: d.description, photo: d.photo, is_published: !!d.is_published }); location.hash = `#/cabinet?p=${pid}&t=shop`; }, d.id ? 'Товар сохранён' : 'Товар добавлен'); };
  }
  $$('[data-dprod]', v).forEach((b) => b.onclick = () => { if (confirm('Удалить товар?')) act(b, () => api.deleteProduct(+b.dataset.dprod), 'Удалено'); });
};

// ------------------------------------------------------------ тарифы (перенесено из ВЕЗУ tarify.html)
async function tariffs() {
  const plan = (t, price, items, cta, hot = '') => `<div class="card plan ${hot ? 'hot' : ''}">${hot ? `<span class="eyebrow">${hot}</span>` : ''}<h3>${t}</h3><div class="price">${price}</div><ul class="small">${items.map((x) => `<li>${x}</li>`).join('')}</ul>${cta}</div>`;
  const ask = (text) => dispatcherPhone() ? wa(dispatcherPhone(), text, `${PRIMARY.icon} Написать`, 'btn block') : '';
  return `<h1>💳 Тарифы</h1><p class="muted">Для автовладельцев и клиентов — всё бесплатно. Для бизнеса — бесплатная визитка навсегда, платно то, что экономит время.</p>
  <div class="plans">${plan('Визитка', '0 ' + REGION.symbol + ' навсегда', ['Своя страница и QR-код', `Кнопки «Позвонить» и ${PRIMARY.label}`, `Заявки в ${PRIMARY.label} + кабинет со статусами`, 'Место в каталоге города', 'Заявки «всем в городе»'], '<a class="btn p block" href="#/business">Создать визитку</a>')}
    ${plan('Про', money(1500) + ' в месяц', ['Первые 7 дней бесплатно', 'Короткий адрес визитки', 'Выше в каталоге', 'Статистика: просмотры, звонки, WhatsApp', `Без надписи «Сделано на ${esc(CONFIG.SITE_NAME)}»`], ask('Здравствуйте! Хочу подключить «Про» для визитки.'), '7 дней бесплатно')}
    ${plan('Магазин', 'витрина — 0 ' + REGION.symbol, ['Витрина товаров прямо в визитке', `Корзина и заказ в ${PRIMARY.label}`, 'Полный магазин «Учёт + Магазин»: склад, налоги 910, Kaspi — по <a href="https://biznes-shablon.vercel.app/prezentaciya#3" target="_blank" rel="noopener">презентации</a>'], `<a class="btn block" href="shop.html?id=8${IS_DEMO ? '' : '&demo=1'}">Пример магазина${IS_DEMO ? '' : ' (демо)'}</a>`)}
    ${plan('Печать', 'по запросу', ['Пачка визиток с QR', 'Наклейка с QR на машину', 'Под цвет вашей визитки'], ask('Здравствуйте! Хочу заказать печать визиток и наклейку с QR.'))}</div>
  <h2>🚚 Ориентир цен на грузоперевозки</h2><div class="card"><table><tr><th>Машина</th><th>Груз</th><th>Час, от</th></tr>${CARGO_VEHICLES.map((x) => `<tr><td><img class="tthumb" src="${x.img}" alt=""> ${esc(x.name)}</td><td>${esc(x.cap)}</td><td><b>${money(x.hour)}</b></td></tr>`).join('')}</table>
  <p class="small muted">Ориентировочно, по городу. Точную цену называет перевозчик. <a href="#/new/cargo">Заказать перевозку →</a></p></div>`;
}

// ------------------------------------------------------------ админ
const adminTabs = (tab) => `<div class="tabs">${[['stats', '📊 Статистика'], ['regs', '🗂 Регистрации'], ['reqs', '📋 Заявки'], ...(S.caps.v4 ? [['disp', '📢 Диспетчер']] : []), ['reviews', '⭐ Отзывы'], ['provs', '🏢 Исполнители'], ['cities', '🏙 Города']].map(([t, n]) => `<a href="#/admin?t=${t}" class="${t === tab ? 'on' : ''}">${n}</a>`).join('')}</div>`;
async function admin(_, q) {
  if (!isAdmin()) return `<h1>Админ-панель</h1>${S.me ? '<div class="card">Нет доступа. Админа назначают в базе (см. README).</div>' : needLogin('админ-панели')}`;
  const tab = q.t || 'stats';
  if (tab === 'disp' && S.caps.v4) { const L = await api.dispatchLeads(); autoRefresh(); return `<h1>🛡 Админ-панель ${siteBadge()}</h1>${adminTabs(tab)}<p class="small muted">Заявки без выбранного исполнителя — их прислали диспетчеру в ${PRIMARY.label}.</p>${L.map(leadCard).join('') || empty('📢', 'Пока пусто')}`; }
  const head = `<h1>🛡 Админ-панель ${siteBadge()}</h1>${adminTabs(tab)}<p class="small muted">Права администратора действуют только на этом сайте (база VEZU). На старом сайте АвтоМастер24 они назначаются отдельно.</p>`;
  if (tab === 'stats') { const s = await api.adminStats();
    const L = { users: 'Пользователей', providers: 'Исполнителей', requests: 'Заявок всего', active: 'Активных заявок', completed: 'Выполнено', turnover: 'Оборот по выполненным', pending_regs: 'Ждут одобрения', pending_reviews: 'Отзывы на модерации' };
    return head + `<div class="grid">${Object.entries(L).map(([k, n]) => `<div class="tile"><small>${n}</small><b class="price">${k === 'turnover' ? money(s[k]) : s[k]}</b></div>`).join('')}</div>`; }
  if (tab === 'regs') { const g = await api.adminRegistrations();
    return head + (g.map((x) => `<div class="card"><div class="row between"><b>${KINDS[x.kind].icon} ${esc(x.name)}</b>${badge(x.status)}</div><div class="small">${esc(x.city)} · ${esc(x.address)} · ${tel(x.phone)} · ${dt(x.created_at)}</div>
      ${x.details?.specs?.length ? `<div class="small muted">${x.details.specs.map(catName).join(', ')}</div>` : ''}${x.details?.service_type ? `<div class="small muted">${URGENT[x.details.service_type]}</div>` : ''}
      ${x.status === 'pending' ? `<div class="row" style="margin-top:8px"><button class="ok" data-ok="${x.id}">Одобрить</button><button class="danger" data-no="${x.id}">Отклонить</button></div>` : ''}</div>`).join('') || '<div class="empty">Нет заявок</div>'); }
  if (tab === 'reqs') { const r = await api.adminRequests();
    return head + `<div class="card"><table><tr><th>#</th><th>Тип</th><th>Город</th><th>Статус</th><th>Создана</th><th>Сумма</th></tr>${r.map((x) => `<tr><td class="mono">${x.id}</td><td>${reqTitle(x)}</td><td>${esc(x.city)}</td><td>${badge(effStatus(x))}</td><td>${dt(x.created_at)}</td><td>${money(x.final_amount)}</td></tr>`).join('')}</table></div>`; }
  if (tab === 'reviews') { const r = await api.pendingReviews();
    return head + (r.map((x) => `<div class="card">${stars(x.rating)} <b>${esc(x.provider_name || '')}</b><p>${esc(x.comment)}</p><div class="row"><button class="ok" data-pub="${x.id}">Опубликовать</button><button class="danger" data-rej="${x.id}">Удалить</button></div></div>`).join('') || '<div class="empty">Нет отзывов на модерации</div>'); }
  if (tab === 'provs') { const p = await api.adminProviders();
    return head + `<div class="card"><table><tr><th>Название</th><th>Тип</th><th>Город</th><th>Рейтинг</th><th></th></tr>${p.map((x) => `<tr><td><a href="#/provider/${x.id}">${esc(x.name)}</a></td><td>${KINDS[x.kind].short}</td><td>${esc(x.city)}</td><td>${Number(x.rating).toFixed(1)}</td><td class="row"><button class="sm ${x.is_active ? 'danger' : 'ok'}" data-pa="${x.id}:${x.is_active ? 0 : 1}">${x.is_active ? 'Отключить' : 'Включить'}</button>${S.caps.v3 ? `<button class="sm ${x.verified ? '' : 'ok'}" data-pv="${x.id}:${x.verified ? 0 : 1}" title="Отметка «Проверен» — после проверки документов/адреса">${x.verified ? 'Снять ✔' : '✔ Проверен'}</button>` : ''}</td></tr>`).join('')}</table></div>`; }
  S.ref = await api.ref();
  return head + `<div class="card"><table>${S.ref.cities.map((c) => `<tr><td>${esc(c.name)}</td><td class="small muted">${esc(c.region || '')}</td><td><button class="${c.active ? 'danger' : 'ok'}" data-ca="${c.id}:${c.active ? 0 : 1}">${c.active ? 'Скрыть' : 'Показать'}</button></td></tr>`).join('')}</table>
    <form class="row" id="cityForm" style="margin-top:10px"><input name="name" class="grow" placeholder="Новый город" required><button class="p">Добавить</button></form></div>`;
}
admin.after = (v) => {
  $$('[data-ok]', v).forEach((b) => b.onclick = () => act(b, () => api.reviewRegistration(+b.dataset.ok, true), 'Одобрено — организация создана'));
  $$('[data-no]', v).forEach((b) => b.onclick = () => { const r = prompt('Причина отказа'); if (r !== null) act(b, () => api.reviewRegistration(+b.dataset.no, false, r), 'Отклонено'); });
  $$('[data-pub]', v).forEach((b) => b.onclick = () => act(b, () => api.moderateReview(+b.dataset.pub, true), 'Опубликовано'));
  $$('[data-rej]', v).forEach((b) => b.onclick = () => act(b, () => api.moderateReview(+b.dataset.rej, false), 'Удалено'));
  $$('[data-lead]', v).forEach((b) => b.onclick = () => { const [id, st] = b.dataset.lead.split(':'); act(b, () => api.setLeadStatus(+id, st), 'Статус обновлён'); });
  $$('[data-pa]', v).forEach((b) => b.onclick = () => { const [id, on] = b.dataset.pa.split(':'); act(b, () => api.setProviderActive(+id, on === '1'), 'Готово'); });
  $$('[data-pv]', v).forEach((b) => b.onclick = () => { const [id, on] = b.dataset.pv.split(':'); act(b, () => api.setProviderVerified(+id, on === '1'), on === '1' ? 'Отмечен как проверенный' : 'Отметка снята'); });
  $$('[data-ca]', v).forEach((b) => b.onclick = () => { const [id, on] = b.dataset.ca.split(':'); act(b, async () => { await api.setCityActive(+id, on === '1'); S.ref = await api.ref(); }, 'Готово'); });
  const cf = $('#cityForm', v); if (cf) cf.onsubmit = (e) => { e.preventDefault(); act($('button', cf), async () => { await api.addCity(cf.querySelector('[name=name]').value.trim()); S.ref = await api.ref(); }, 'Город добавлен'); };
};

boot().catch((e) => { const v = document.getElementById('view'); if (v) v.innerHTML = `<div class="card center"><h2>Ошибка запуска</h2><p class="muted">${String(e?.message || e).replace(/[<>&]/g, '')}</p><button class="p" onclick="window.am24Reset&&am24Reset()">Сбросить и открыть заново</button></div>`; });
