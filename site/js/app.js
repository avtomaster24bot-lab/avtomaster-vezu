import { CONFIG } from './config.js';
import { api, IS_DEMO } from './api.js';
import { KINDS, URGENT, SUPPLIER, TOW_VEHICLES, WHEELS, WASH_SERVICES, CAR_TYPES, PARTS_URGENCY, PARTS_ORIG, PARTS_DELIVERY, STATUS, effStatus } from './consts.js';

// ------------------------------------------------------------ утилиты
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => n == null ? '—' : Number(n).toLocaleString('ru-RU') + ' ₸';
const dt = (s) => s ? new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const hm = (s) => new Date(s).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const stars = (r) => `<span class="stars" aria-label="Рейтинг ${Number(r || 0).toFixed(1)} из 5">${'★'.repeat(Math.round(r || 0))}${'☆'.repeat(5 - Math.round(r || 0))}</span>`;
const badge = (st) => { const [t, c] = STATUS[st] || [st, 'grey']; return `<span class="badge ${c}">${esc(t)}</span>`; };
const digits = (p) => String(p || '').replace(/[^\d+]/g, '');
const tel = (p) => p ? `<a class="btn sm" href="tel:${esc(digits(p))}">📞 ${esc(p)}</a>` : '';
const wa = (p, text = '') => p ? `<a class="btn sm wa" target="_blank" rel="noopener" href="https://wa.me/${esc(digits(p).replace(/^\+/, '').replace(/^8/, '7'))}${text ? '?text=' + encodeURIComponent(text) : ''}">💬 WhatsApp</a>` : '';
const tip = (t) => `<button type="button" class="tip" aria-label="Подсказка: ${esc(t)}" data-tip="${esc(t)}">?</button>`;
const opts = (name, list, sel, type = 'radio') => `<div class="opts">${list.map(([v, t]) => `<label class="opt"><input type="${type}" name="${name}" value="${esc(v)}" ${(Array.isArray(sel) ? sel.includes(v) : sel === v) ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>`;
const pairs = (arr) => arr.map((x) => [x, x]);
const mapUrl = (city, address) => `https://2gis.kz/search/${encodeURIComponent([city, address].filter(Boolean).join(', '))}`;
function toast(msg, err = false) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 3500); }
const formData = (f) => { const o = {}; for (const [k, v] of new FormData(f)) { if (v instanceof File) continue; o[k] = o[k] !== undefined ? [].concat(o[k], v) : v; } return o; };
async function act(btn, fn, okMsg) {
  if (btn) btn.disabled = true;
  try { await fn(); if (okMsg) toast(okMsg); await render(); } catch (e) { toast(e.message || String(e), true); } finally { if (btn) btn.disabled = false; }
}
const IMG = { sto: 'assets/img/sto.webp', tow: 'assets/img/tow.webp', wash: 'assets/img/wash.webp', parts: 'assets/img/parts.webp', urgent: 'assets/img/help.webp' };

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
const favs = () => { try { return JSON.parse(localStorage.getItem('am24-fav')) || []; } catch { return []; } };
const isFav = (id) => favs().includes(+id);
const toggleFav = (id) => { const f = favs(); const i = f.indexOf(+id); if (i >= 0) f.splice(i, 1); else f.push(+id); localStorage.setItem('am24-fav', JSON.stringify(f)); return i < 0; };

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
const S = { ref: null, me: null, city: localStorage.getItem('am24-city') || CONFIG.DEFAULT_CITY, myProv: [], timer: null, caps: { v3: false }, cleanups: [], installEvt: null };
const isAdmin = () => ['global_admin', 'regional_admin'].includes(S.me?.role);
const catName = (id) => S.ref.categories.find((c) => c.id === +id)?.name || '';
const siteUrl = () => location.origin + location.pathname;

async function boot() {
  try { window.Telegram?.WebApp?.ready(); window.Telegram?.WebApp?.expand(); } catch { /* ignore */ }
  applyTheme(localStorage.getItem('am24-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  S.ref = await api.ref();
  try { S.caps = await api.caps(); } catch { S.caps = { v3: false }; }
  await refreshMe();
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  $('#citySel').addEventListener('change', (e) => { S.city = e.target.value; localStorage.setItem('am24-city', S.city); render(); });
  $('#themeBtn').onclick = () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true);
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.tip'); $$('.tip.open').forEach((x) => x !== t && x.classList.remove('open')); if (t) { e.preventDefault(); t.classList.toggle('open'); }
    const ph = e.target.closest('[data-full]'); if (ph) lightbox(ph.dataset.full);
    const fv = e.target.closest('[data-fav]'); if (fv) { e.preventDefault(); const on = toggleFav(fv.dataset.fav); fv.classList.toggle('on', on); fv.setAttribute('aria-pressed', on); fv.textContent = on ? '♥' : '♡'; toast(on ? 'Добавлено в избранное' : 'Убрано из избранного'); }
  });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEvt = e; $$('[data-install]').forEach((b) => { b.hidden = false; }); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  render();
}
function applyTheme(t, save) { document.documentElement.dataset.theme = t; $('meta[name=theme-color]')?.setAttribute('content', t === 'light' ? '#F6F4EF' : '#0F0F0F'); $('#themeBtn').textContent = t === 'light' ? '🌙' : '☀️'; $('#themeBtn').setAttribute('aria-label', t === 'light' ? 'Тёмная тема' : 'Светлая тема'); if (save) localStorage.setItem('am24-theme', t); }
async function refreshMe() {
  try { S.me = await api.session(); } catch (e) { S.me = null; toast(e.message, true); }
  if (S.me?.city && !localStorage.getItem('am24-city')) S.city = S.me.city;
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
      <button data-demo="client">Клиент</button><button data-demo="master">Исполнитель</button><button data-demo="admin">Админ</button><button data-reset>Сбросить</button>`;
    $$('[data-demo]', bar).forEach((b) => b.onclick = async () => { await api.loginDemo(b.dataset.demo); await refreshMe(); toast('Вы вошли: ' + S.me.full_name);
      location.hash = b.dataset.demo === 'master' ? '#/cabinet' : b.dataset.demo === 'admin' ? '#/admin' : '#/'; render(); });
    $('[data-reset]', bar).onclick = async () => { await api.resetDemo(); await refreshMe(); toast('Демо-данные сброшены'); render(); };
  } else bar.hidden = true;
  const items = [['', '🏠', 'Главная'], ['requests', '📋', 'Заявки'], ['catalog', '🔎', 'Мастера'],
    S.myProv.length ? ['cabinet', '🛠', 'Кабинет'] : ['garage', '🚗', 'Гараж'], isAdmin() ? ['admin', '🛡', 'Админ'] : ['profile', '👤', 'Профиль']];
  $('#nav').innerHTML = items.map(([h, i, t]) => `<a href="#/${h}" class="${route === h ? 'on' : ''}" ${route === h ? 'aria-current="page"' : ''}><span aria-hidden="true">${i}</span>${t}</a>`).join('');
}

// ------------------------------------------------------------ роутер
const routes = { '': home, catalog, provider, new: newRequest, requests, request, chat, garage, prices, profile, login, business, cabinet, admin };
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
const empty = (icon, text, cta = '') => `<div class="empty"><div class="big-i">${icon}</div><p>${text}</p>${cta}</div>`;

// ------------------------------------------------------------ умный поиск «что случилось?»
const KW = [
  ['tow', null, 'эваку дтп авари увез буксир не едет сломал заглох'],
  ['wash', null, 'мойк помыть мыть химчист полиров детейл грязн'],
  ['parts', null, 'запчаст купить фара бампер деталь разбор зеркал стекло фильтр'],
  ['urgent', 'locksmith', 'ключ замок закрыл захлоп вскры'],
  ['urgent', 'tire', 'колес прокол шина спустил балон шиномонтаж'],
  ['urgent', 'electrician', 'аккумулятор акб прикурить сел разряд'],
  ['urgent', 'delivery', 'перегон перегнать доставить машину'],
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
async function home() {
  const fv = favs();
  const favList = fv.length ? (await Promise.all(fv.slice(0, 6).map((id) => api.getProvider(id).catch(() => null)))).filter(Boolean) : [];
  const onboard = localStorage.getItem('am24-onboarded') ? '' : `<div class="card onboard" id="onb"><button class="x" id="onbX" aria-label="Скрыть">✕</button><h3>Как пользоваться — 3 шага</h3>
    <div class="steps3"><div><b>1</b>Выберите услугу или опишите проблему в поиске</div><div><b>2</b>Мастера города увидят заявку и откликнутся</div><div><b>3</b>Общайтесь в чате, после работы поставьте оценку</div></div></div>`;
  return `<section class="hero" style="background-image:url('assets/img/hero.webp')"><div class="hero-in"><span class="eyebrow">📍 ${esc(S.city)} · бесплатно для автовладельцев</span>
    <h1>Помощь с машиной —<br>за пару минут</h1><p>${esc(CONFIG.SITE_TAGLINE)}. Опишите, что случилось, — мастера откликнутся сами.</p>
    <div class="search" role="search"><input id="q" type="search" placeholder="Например: стучит подвеска, сел аккумулятор, нужна мойка" aria-label="Что случилось с машиной?" autocomplete="off"><div id="sugg" class="sugg" role="listbox"></div></div>
    <div class="row"><a class="btn p" href="#/new/sto">🆕 Новая заявка</a><a class="btn" href="#/catalog/sto">🔎 Выбрать мастера</a><a class="btn" href="#/prices">💰 Цены</a></div></div></section>
  ${onboard}
  <h2>Что случилось?</h2>
  <div class="grid photo-grid">${Object.entries(KINDS).map(([k, x]) => `<a class="tile ph-tile" href="#/new/${k}"><img src="${IMG[k]}" alt="" loading="lazy"><span><b>${x.icon} ${x.title}</b><small>${x.desc}</small></span></a>`).join('')}
    <a class="tile ph-tile alt" href="#/catalog/sto"><span><b>📒 Все мастера</b><small>Рейтинги, отзывы, фото, часы работы</small></span></a></div>
  ${favList.length ? `<h2>♥ Избранные</h2><div class="hscroll">${favList.map((p) => `<a class="mini" href="#/provider/${p.id}"><b>${KINDS[p.kind].icon} ${esc(p.name)}</b><small>★ ${Number(p.rating || 0).toFixed(1)} · ${esc(p.working_hours || '')}</small></a>`).join('')}</div>` : ''}
  <h2>Почему удобно</h2>
  <div class="grid feats">
    <div class="tile"><div class="i">⚡</div><b>Один запрос — много мастеров</b><small>Не обзваниваете всех: заявку видят все подходящие исполнители города.</small></div>
    <div class="tile"><div class="i">📷</div><b>Фото и чат</b><small>Приложите фото поломки, уточните детали в чате прямо по заявке.</small></div>
    <div class="tile"><div class="i">🔒</div><b>Телефон под защитой</b><small>Ваш номер видит только тот, кто взял заявку. Поставщики запчастей анонимны до выбора.</small></div>
    <div class="tile"><div class="i">⭐</div><b>Честный рейтинг</b><small>Оценить может только тот, чья заявка выполнена. Мастера отвечают на отзывы.</small></div>
  </div>
  <h2>Для своих</h2>
  <div class="grid">
    <a class="tile" href="#/business"><div class="i">💼</div><b>Для бизнеса</b><small>Подключить СТО, мойку, эвакуатор, магазин</small></a>
    <a class="tile" href="#/garage"><div class="i">🚗</div><b>Мой гараж</b><small>Авто и регламент ТО</small></a>
    ${S.myProv.length ? '<a class="tile" href="#/cabinet"><div class="i">🛠</div><b>Кабинет исполнителя</b><small>Входящие заявки</small></a>' : ''}
    ${isAdmin() ? '<a class="tile" href="#/admin"><div class="i">🛡</div><b>Админ-панель</b><small>Модерация и статистика</small></a>' : ''}
    <button class="tile" data-install hidden><div class="i">📲</div><b>Установить приложение</b><small>Иконка на экране телефона, работает как приложение</small></button></div>`;
}
home.after = (v) => {
  const q = $('#q', v), sg = $('#sugg', v);
  q.oninput = () => { const list = suggest(q.value); sg.innerHTML = list.map((x) => `<a href="${x.href}" role="option"><span>${x.icon}</span><b>${esc(x.title)}</b><small>${esc(x.hint)}</small></a>`).join(''); sg.classList.toggle('on', !!list.length); };
  q.onkeydown = (e) => { if (e.key === 'Enter') { const a = $('a', sg); if (a) location.hash = a.getAttribute('href'); } };
  const x = $('#onbX', v); if (x) x.onclick = () => { localStorage.setItem('am24-onboarded', '1'); $('#onb', v).remove(); };
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
  ${p.kind === 'parts' && p.supplier_type ? `<div class="small">${SUPPLIER[p.supplier_type]}${p.delivery ? ' · 🚚 доставка' : ''}</div>` : ''}`;
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
    <dl class="kv">${p.address ? `<dt>Адрес</dt><dd>${esc(p.address)} · <a href="${mapUrl(p.city, p.address)}" target="_blank" rel="noopener">на карте 2ГИС</a></dd>` : ''}<dt>Город</dt><dd>${esc(p.city)}</dd>${p.working_hours ? `<dt>Часы</dt><dd>${esc(p.working_hours)}</dd>` : ''}</dl>
    ${provSpec(p)}
    <div class="row" style="margin-top:12px"><a class="btn p" href="#/new/${p.kind}?to=${p.id}">📝 Оставить заявку</a>${tel(p.phone)}${wa(p.whatsapp, 'Здравствуйте! Нашёл вас на АвтоМастер24.')}
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
  if (!S.me) return `<h1>Новая заявка</h1>${tabs}${needLogin('создания заявки')}`;
  const warn = !S.me.phone || !S.me.consent ? `<div class="notice warn">Перед первой заявкой заполните <a href="#/profile">профиль</a>: телефон и согласие на обработку данных. Телефон увидит только тот, кто возьмёт заявку.</div>` : '';
  const [provs, cars, prev] = await Promise.all([api.listProviders({ kind, city: S.city }), api.vehicles(), q.repeat ? api.myRequests().then((l) => l.find((r) => r.id === +q.repeat)) : null]);
  const R = prev || {}; const D = R.details || {};
  const car = `<label>Автомобиль ${tip('Выберите машину из гаража или впишите марку и год — так мастер сразу поймёт, о чём речь')}</label>${cars.length ? `<select name="car"><option value="">— ввести вручную —</option>${cars.map((c) => `<option>${esc(`${c.brand} ${c.model} ${c.year || ''}`.trim())}</option>`).join('')}</select>` : ''}
    <input name="vehicle_info" value="${esc(R.vehicle_info || '')}" placeholder="Марка, модель, год (например Toyota Camry 2015)">`;
  const to = q.to || R.target_provider_id || '';
  const pick = (label, required) => `<label>${label} ${tip(required ? 'Выберите мойку — она предложит цену и точное время' : '«Всем в городе» — заявку увидят все подходящие мастера, первый откликнувшийся возьмёт её. Можно выбрать конкретного.')}</label><select name="target_provider_id" ${required ? 'required' : ''}>${required ? '' : '<option value="">📢 Отправить всем в городе</option>'}${provs.map((p) => `<option value="${p.id}" ${+to === p.id ? 'selected' : ''}>${esc(p.name)} · ★${Number(p.rating).toFixed(1)}${p.verified ? ' · ✔' : ''}</option>`).join('')}</select>`;
  const photo = S.caps.v3 ? `<label>Фото (до 5) ${tip('Фото поломки, вмятины, ошибки на приборной панели или нужной детали — мастер точнее оценит работу и цену')}</label>
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
  } else {
    body = `<label>Что нужно?</label>${opts('service_type', Object.entries(URGENT), q.type || R.service_type || 'locksmith')}
      <label>Где вы?</label><div class="row"><input name="location" class="grow" required placeholder="Адрес или ориентир" value="${esc(D.location || '')}"><button type="button" id="geo">📍 Моё место</button></div>
      <input type="hidden" name="lat"><input type="hidden" name="lon">${car}<label>Опишите ситуацию</label><textarea name="description" rows="2" placeholder="Например: ключи в закрытой машине">${esc(desc)}</textarea>${photo}`;
  }
  return `<h1>${KINDS[kind].icon} ${KINDS[kind].title}</h1>${tabs}${warn}${prev ? '<div class="notice">🔁 Заполнили по прошлой заявке — проверьте и отправьте.</div>' : ''}
    <form id="reqForm" class="card" data-kind="${kind}"><div class="small muted">Город: <b>${esc(S.city)}</b> (меняется вверху)</div>${body}
    <button class="p block" style="margin-top:16px">Отправить заявку</button><p class="small muted center" style="margin:8px 0 0">Бесплатно. Телефон увидит только тот, кто возьмёт заявку.</p></form>`;
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
    const details = {}; for (const k of ['vehicle', 'wheels', 'location', 'lat', 'lon', 'car_type', 'urgency', 'original', 'delivery', 'budget']) if (d[k]) details[k] = d[k];
    const p = { type: kind, city: S.city, category_id: d.category_id || null, subcategory: d.subcategory || null, service_type: d.service_type || null,
      supplier_type: d.supplier_type || null, target_provider_id: d.target_provider_id || null, description: d.description || '', vehicle_info: d.vehicle_info || '', details, desired_time: d.desired_time || null };
    if (kind === 'wash' && !p.desired_time) return toast('Выберите время', true);
    btn.disabled = true;
    try {
      if (files.length) { details.photos = []; for (const [i, b] of files.entries()) { btn.textContent = `Загружаем фото ${i + 1} из ${files.length}…`; details.photos.push(await api.uploadRequestPhoto(b)); } }
      btn.textContent = 'Отправляем…';
      const id = await api.createRequest(p); toast('Заявка отправлена! Исполнители уже видят её.'); location.hash = '#/request/' + id;
    } catch (er) { toast(er.message, true); btn.disabled = false; btn.textContent = 'Отправить заявку'; }
  };
};

// ------------------------------------------------------------ мои заявки
const reqTitle = (r) => `${KINDS[r.type].icon} ${r.type === 'sto' ? esc(catName(r.category_id) || 'СТО') : r.type === 'urgent' ? esc(URGENT[r.service_type] || 'Выездная помощь') : r.type === 'wash' ? esc(r.service_type || 'Мойка') : KINDS[r.type].title}`;
const reqInfo = (r) => {
  const d = r.details || {};
  const rows = [['Номер', `<span class="mono">#${r.id}</span>`], ['Создана', dt(r.created_at)], ['Город', esc(r.city)],
    r.subcategory && ['Уточнение', esc(r.subcategory)], r.vehicle_info && ['Авто', esc(r.vehicle_info)], r.description && ['Описание', esc(r.description)],
    d.vehicle && ['Транспорт', esc(d.vehicle)], d.wheels && ['Колёса', esc(d.wheels)],
    d.location && ['Место', esc(d.location) + (d.lat ? ` · <a target="_blank" rel="noopener" href="https://2gis.kz/geo/${esc(d.lon)},${esc(d.lat)}">📍 на карте</a>` : '')],
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
  parts: [['new', 'Заявка отправлена'], ['offers', 'Есть предложения'], ['active', 'Поставщик выбран'], ['delivered', 'Передано'], ['completed', 'Получено']],
  wash: [['new', 'Заявка отправлена'], ['price_offered', 'Цена и время'], ['client_approved', 'Запись подтверждена'], ['in_progress', 'Моют'], ['waiting_client', 'Готово'], ['completed', 'Забрали']],
};
function timeline(r) {
  const st = effStatus(r), flow = FLOW[r.type];
  if (['cancelled', 'expired'].includes(st)) return `<div class="tl"><div class="step done"><i></i><span>Заявка отправлена<small>${dt(r.created_at)}</small></span></div><div class="step bad"><i></i><span>${st === 'cancelled' ? 'Отменена' : 'Время вышло — никто не взял'}</span></div></div>`;
  const idx = Math.max(0, flow.findIndex(([s]) => s === st));
  return `<div class="tl" aria-label="Ход заявки">${flow.map(([, t], i) => `<div class="step ${i < idx || st === 'completed' ? 'done' : i === idx ? 'cur' : ''}"><i></i><span>${t}${i === 0 ? `<small>${dt(r.created_at)}</small>` : i === 1 && r.accepted_at ? `<small>${dt(r.accepted_at)}</small>` : ''}</span></div>`).join('')}</div>`;
}
async function requests(_, q) {
  if (!S.me) return `<h1>Мои заявки</h1>${needLogin('просмотра заявок')}`;
  const all = await api.myRequests(); autoRefresh();
  const act_ = all.filter((r) => !['completed', 'cancelled', 'expired'].includes(effStatus(r)));
  const tab = q.t || (act_.length ? 'a' : 'h');
  const list = tab === 'a' ? act_ : all.filter((r) => !act_.includes(r));
  return `<h1>Мои заявки</h1><div class="tabs"><a href="#/requests?t=a" class="${tab === 'a' ? 'on' : ''}">Активные (${act_.length})</a><a href="#/requests?t=h" class="${tab === 'h' ? 'on' : ''}">История (${all.length - act_.length})</a></div>
    ${list.length ? list.map((r) => `<a class="card req" href="#/request/${r.id}"><div class="row between"><b>${reqTitle(r)}</b>${badge(effStatus(r))}</div>
    <div class="small muted">#${r.id} · ${dt(r.created_at)}${r.vehicle_info ? ' · ' + esc(r.vehicle_info) : ''}${r.details?.photos?.length ? ' · 📷 ' + r.details.photos.length : ''}</div><div class="small">${esc((r.description || r.subcategory || '').slice(0, 120))}</div></a>`).join('')
    : empty('📋', tab === 'a' ? 'Активных заявок нет.' : 'История пуста.', '<a class="btn p" href="#/new/sto">Создать заявку</a>')}`;
}
async function request(id) {
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
    if (['tow', 'sto', 'urgent'].includes(r.type) && Date.now() - new Date(r.created_at) > 5 * 60000) {
      const all = await api.listProviders({ kind: r.type, city: r.city });
      block += `<div class="card"><h3>Пока никто не ответил — позвоните напрямую</h3>${all.map((p) => `<div class="row between small" style="padding:4px 0"><a href="#/provider/${p.id}">${esc(p.name)}</a>${tel(p.phone)}</div>`).join('') || '<p class="muted">Нет исполнителей в городе</p>'}</div>`;
    }
  }
  const chatOk = S.caps.v3 && r.accepted_by && !['cancelled'].includes(st) && !(r.type === 'parts' && ['new', 'offers'].includes(st));
  if (prov && !['new', 'offers'].includes(st)) block += `<h2>Исполнитель</h2>${provCard(prov, `${tel(prov.phone)}${wa(prov.whatsapp, `Здравствуйте! По заявке #${r.id} на АвтоМастер24.`)}${chatOk ? `<a class="btn p sm" href="#/chat/${r.id}">💬 Написать в чат</a>` : ''}`)}`;
  const btns = [];
  if (r.type === 'wash' && st === 'price_offered') btns.push(`<div class="notice">Мойка предлагает: <b>${money(r.price)}</b>, время <b>${dt(r.assigned_time)}</b></div><button class="ok" data-a="washApprove">✅ Подтвердить запись</button>`);
  if (r.type === 'wash' && st === 'waiting_client') btns.push('<div class="notice">🚗 Машина готова — можно забирать!</div><button class="ok" data-a="clientConfirm">Забрал машину</button>');
  if (r.type === 'parts' && st === 'delivered') btns.push('<button class="ok" data-a="clientConfirm">📦 Получил запчасть</button>');
  if (['tow', 'sto', 'urgent'].includes(r.type) && st === 'active') btns.push('<button class="ok" data-a="clientConfirm">✅ Работа выполнена</button>');
  if (!['completed', 'cancelled', 'expired'].includes(st)) btns.push('<button class="danger" data-a="cancelRequest">Отменить заявку</button>');
  else btns.push(`<a class="btn" href="#/new/${r.type}?repeat=${r.id}">🔁 Повторить заявку</a>`);
  let review = '';
  if (st === 'completed' && r.accepted_by) {
    const mine = await api.myReviewFor(r.id);
    review = mine ? `<div class="card"><h3>Ваша оценка</h3>${stars(mine.rating)} ${esc(mine.comment)} ${mine.is_published ? '' : '<span class="small muted">(отзыв на модерации)</span>'}${mine.reply ? `<div class="reply"><b>Ответ исполнителя:</b> ${esc(mine.reply)}</div>` : ''}</div>`
      : `<form class="card" id="revForm"><h3>Оцените исполнителя</h3><div class="rate" role="radiogroup" aria-label="Оценка">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" name="rating" id="rt${n}" value="${n}" ${n === 5 ? 'checked' : ''}><label for="rt${n}" title="${n}">★</label>`).join('')}</div>
        <label>Отзыв (необязательно) ${tip('Отзыв с текстом публикуется после проверки модератором. Оценка без текста — сразу.')}</label><textarea name="comment" rows="2" placeholder="Что понравилось, что нет"></textarea><button class="p" style="margin-top:10px">Отправить оценку</button></form>`;
  }
  return `<a href="#/requests" class="small">← Мои заявки</a><div class="card"><div class="row between"><h2>${reqTitle(r)}</h2>${badge(st)}</div>${timeline(r)}${reqInfo(r)}</div>${block}
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
async function login() {
  if (S.me) { location.hash = '#/profile'; return ''; }
  if (IS_DEMO) return `<h1>Вход</h1><div class="card"><p>Сайт в демо-режиме — выберите, за кого войти:</p><div class="row"><button class="p" data-demo2="client">👤 Клиент</button><button data-demo2="master">🛠 Исполнитель (СТО, мойка, эвакуатор…)</button><button data-demo2="admin">🛡 Администратор</button></div></div>`;
  return `<h1>Вход</h1><div class="card"><p>Войдите через Telegram. Мы получаем только имя и username — телефон вы укажете сами в профиле.</p><div id="tgw"></div>
    <p class="small muted">Если кнопка не появилась — отключите блокировщик рекламы или откройте сайт в обычном браузере.</p></div>`;
}
login.after = (v) => {
  $$('[data-demo2]', v).forEach((b) => b.onclick = async () => { await api.loginDemo(b.dataset.demo2); await refreshMe(); location.hash = b.dataset.demo2 === 'master' ? '#/cabinet' : b.dataset.demo2 === 'admin' ? '#/admin' : '#/profile'; });
  const box = $('#tgw', v); if (!box) return;
  window.onTelegramAuth = async (u) => { try { await api.loginTelegram(u); await refreshMe(); toast('Добро пожаловать!'); location.hash = S.me?.phone ? '#/' : '#/profile'; } catch (e) { toast(e.message, true); } };
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
    <button class="btn" data-install hidden>📲 Установить приложение</button><button class="danger" id="delData">Удалить мои данные</button><button class="ghost" id="logout">Выйти</button></div>`;
}
profile.after = (v) => {
  const f = $('#prf', v); if (!f) return login.after(v);
  f.onsubmit = (e) => { e.preventDefault(); const d = formData(f); act($('button', f), async () => { S.me = await api.updateProfile({ ...d, consent: !!d.consent }); S.city = d.city; localStorage.setItem('am24-city', S.city); }, 'Профиль сохранён'); };
  installBtns(v);
  $('#logout', v).onclick = async () => { await api.logout(); await refreshMe(); location.hash = '#/'; };
  $('#delData', v).onclick = () => { if (confirm('Удалить телефон и согласие? Заявки и отзывы сохранятся.')) act(null, async () => { await api.deleteMyData(); await refreshMe(); }, 'Данные удалены'); };
};

// ------------------------------------------------------------ подключение бизнеса
async function business() {
  const intro = `<h1>💼 Для бизнеса</h1><div class="card"><p>Подключите СТО, мойку, эвакуатор, магазин запчастей или выездного мастера. После проверки администратором у вас появится <b>Кабинет исполнителя</b>: входящие заявки города, принятие, прайс, рейтинг.</p></div>`;
  if (!S.me) return intro + needLogin('подключения бизнеса');
  return `${intro}<form class="card" id="bf"><label>Тип</label>${opts('kind', Object.entries(KINDS).map(([k, x]) => [k, x.icon + ' ' + x.short]), 'sto')}
    <label>Название</label><input name="name" required maxlength="120"><label>Телефон для клиентов</label><input name="phone" type="tel" required value="${esc(S.me.phone || '')}">
    <label>Город</label><select name="city">${S.ref.cities.filter((c) => c.active).map((c) => `<option ${c.name === S.city ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <label>Адрес</label><input name="address"><label>Часы работы</label><input name="working_hours" placeholder="09:00-19:00">
    <div data-k="sto"><label>Направления СТО</label>${opts('specs', S.ref.categories.map((c) => [String(c.id), c.name]), [], 'checkbox')}</div>
    <div data-k="parts" hidden><label>Тип</label>${opts('supplier_type', Object.entries(SUPPLIER), 'shop')}<label class="check"><input type="checkbox" name="delivery"> <span>Есть доставка</span></label></div>
    <div data-k="urgent" hidden><label>Специализация</label>${opts('service_type', Object.entries(URGENT), 'locksmith')}</div>
    <div data-k="wash" hidden><div class="row"><div class="grow"><label>Боксов</label><input name="boxes" type="number" min="1" value="1"></div><div class="grow"><label>Минут на машину</label><input name="slot_minutes" type="number" min="15" step="15" value="60"></div></div></div>
    <button class="p" style="margin-top:14px">Отправить на проверку</button></form>`;
}
business.after = (v) => {
  const f = $('#bf', v); if (!f) return;
  const sync = () => { const k = f.querySelector('[name=kind]:checked').value; $$('[data-k]', f).forEach((d) => { d.hidden = d.dataset.k !== k; }); };
  $$('[name=kind]', f).forEach((r) => r.onchange = sync);
  f.onsubmit = (e) => { e.preventDefault(); const d = formData(f);
    const details = { working_hours: d.working_hours || '' };
    if (d.kind === 'sto') details.specs = [].concat(d.specs || []).map(Number);
    if (d.kind === 'parts') { details.supplier_type = d.supplier_type; details.delivery = !!d.delivery; }
    if (d.kind === 'urgent') details.service_type = d.service_type;
    if (d.kind === 'wash') { details.boxes = +d.boxes || 1; details.slot_minutes = +d.slot_minutes || 60; }
    act($('button.p', f), async () => { await api.registerBusiness({ kind: d.kind, name: d.name, phone: d.phone, city: d.city, address: d.address, details }); location.hash = '#/profile'; }, 'Заявка отправлена. Администратор проверит её.'); };
};

// ------------------------------------------------------------ кабинет исполнителя
async function cabinet(_, q) {
  if (!S.me) return `<h1>Кабинет исполнителя</h1>${needLogin('кабинета')}`;
  S.myProv = await api.myProviders();
  if (!S.myProv.length) return `<h1>Кабинет исполнителя</h1><div class="card"><p>У вас пока нет подключённой организации.</p><a class="btn p" href="#/business">Подключить бизнес</a></div>`;
  const p = S.myProv.find((x) => x.id === +q.p) || S.myProv[0];
  const tab = q.t || 'feed';
  const head = `<h1>🛠 Кабинет</h1><div class="tabs">${S.myProv.map((x) => `<a href="#/cabinet?p=${x.id}&t=${tab}" class="${x.id === p.id ? 'on' : ''}">${KINDS[x.kind].icon} ${esc(x.name)}</a>`).join('')}</div>
    ${p.is_active ? '' : '<div class="notice warn">Организация отключена администратором — новые заявки не приходят.</div>'}
    <div class="tabs">${[['feed', '📥 Заявки'], ...(p.kind === 'sto' ? [['prices', '💰 Прайс']] : []), ['reviews', '⭐ Отзывы'], ['org', '🏢 Профиль'], ['link', '🔗 Ссылка']].map(([t, n]) => `<a href="#/cabinet?p=${p.id}&t=${t}" class="${t === tab ? 'on' : ''}">${n}</a>`).join('')}</div>`;
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
    if (!mine && ['tow', 'sto', 'urgent'].includes(r.type) && st === 'new') a = `<button class="ok" data-acc="${r.id}">✅ Принять</button><button class="ghost" data-dec="${r.id}">Отклонить</button>`;
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
};

// ------------------------------------------------------------ админ
async function admin(_, q) {
  if (!isAdmin()) return `<h1>Админ-панель</h1>${S.me ? '<div class="card">Нет доступа. Админа назначают в базе (см. README).</div>' : needLogin('админ-панели')}`;
  const tab = q.t || 'stats';
  const head = `<h1>🛡 Админ-панель</h1><div class="tabs">${[['stats', '📊 Статистика'], ['regs', '🗂 Регистрации'], ['reqs', '📋 Заявки'], ['reviews', '⭐ Отзывы'], ['provs', '🏢 Исполнители'], ['cities', '🏙 Города']].map(([t, n]) => `<a href="#/admin?t=${t}" class="${t === tab ? 'on' : ''}">${n}</a>`).join('')}</div>`;
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
  $$('[data-pa]', v).forEach((b) => b.onclick = () => { const [id, on] = b.dataset.pa.split(':'); act(b, () => api.setProviderActive(+id, on === '1'), 'Готово'); });
  $$('[data-pv]', v).forEach((b) => b.onclick = () => { const [id, on] = b.dataset.pv.split(':'); act(b, () => api.setProviderVerified(+id, on === '1'), on === '1' ? 'Отмечен как проверенный' : 'Отметка снята'); });
  $$('[data-ca]', v).forEach((b) => b.onclick = () => { const [id, on] = b.dataset.ca.split(':'); act(b, async () => { await api.setCityActive(+id, on === '1'); S.ref = await api.ref(); }, 'Готово'); });
  const cf = $('#cityForm', v); if (cf) cf.onsubmit = (e) => { e.preventDefault(); act($('button', cf), async () => { await api.addCity(cf.querySelector('[name=name]').value.trim()); S.ref = await api.ref(); }, 'Город добавлен'); };
};

boot();
