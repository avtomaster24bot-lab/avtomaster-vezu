import { CONFIG } from './config.js';
import { api, IS_DEMO } from './api.js';
import { KINDS, URGENT, SUPPLIER, TOW_VEHICLES, WHEELS, WASH_SERVICES, CAR_TYPES, PARTS_URGENCY, PARTS_ORIG, PARTS_DELIVERY, STATUS, effStatus } from './consts.js';

// ------------------------------------------------------------ утилиты
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => n == null ? '—' : Number(n).toLocaleString('ru-RU') + ' ₸';
const dt = (s) => s ? new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const stars = (r) => `<span class="stars">${'★'.repeat(Math.round(r || 0))}${'☆'.repeat(5 - Math.round(r || 0))}</span>`;
const badge = (st) => { const [t, c] = STATUS[st] || [st, 'grey']; return `<span class="badge ${c}">${esc(t)}</span>`; };
const tel = (p) => p ? `<a href="tel:${esc(String(p).replace(/[^\d+]/g, ''))}">📞 ${esc(p)}</a>` : '';
const opts = (name, list, sel, type = 'radio') => `<div class="opts">${list.map(([v, t]) => `<label class="opt"><input type="${type}" name="${name}" value="${esc(v)}" ${(Array.isArray(sel) ? sel.includes(v) : sel === v) ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>`;
const pairs = (arr) => arr.map((x) => [x, x]);
function toast(msg, err = false) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 3500); }
const formData = (f) => { const o = {}; for (const [k, v] of new FormData(f)) o[k] = o[k] !== undefined ? [].concat(o[k], v) : v; return o; };
async function act(btn, fn, okMsg) {
  if (btn) btn.disabled = true;
  try { await fn(); if (okMsg) toast(okMsg); await render(); } catch (e) { toast(e.message || String(e), true); } finally { if (btn) btn.disabled = false; }
}

// ------------------------------------------------------------ состояние
const S = { ref: null, me: null, city: localStorage.getItem('am24-city') || CONFIG.DEFAULT_CITY, myProv: [], timer: null };
const isAdmin = () => ['global_admin', 'regional_admin'].includes(S.me?.role);
const catName = (id) => S.ref.categories.find((c) => c.id === +id)?.name || '';
const siteUrl = () => location.origin + location.pathname;

async function boot() {
  try { window.Telegram?.WebApp?.ready(); window.Telegram?.WebApp?.expand(); } catch { /* ignore */ }
  S.ref = await api.ref();
  await refreshMe();
  window.addEventListener('hashchange', render);
  $('#citySel').addEventListener('change', (e) => { S.city = e.target.value; localStorage.setItem('am24-city', S.city); render(); });
  render();
}
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
    bar.innerHTML = `<b>ДЕМО-режим</b><span>данные только в этом браузере, люди и организации вымышленные. Войти как:</span>
      <button data-demo="client">Клиент</button><button data-demo="master">Исполнитель</button><button data-demo="admin">Админ</button><button data-reset>Сбросить демо</button>`;
    $$('[data-demo]', bar).forEach((b) => b.onclick = async () => { await api.loginDemo(b.dataset.demo); await refreshMe(); toast('Вы вошли: ' + S.me.full_name);
      location.hash = b.dataset.demo === 'master' ? '#/cabinet' : b.dataset.demo === 'admin' ? '#/admin' : '#/'; render(); });
    $('[data-reset]', bar).onclick = async () => { await api.resetDemo(); await refreshMe(); toast('Демо-данные сброшены'); render(); };
  } else bar.hidden = true;
  const items = [['', '🏠', 'Главная'], ['requests', '📋', 'Заявки'], ['prices', '💰', 'Цены'],
    S.myProv.length ? ['cabinet', '🛠', 'Кабинет'] : ['garage', '🚗', 'Гараж'], isAdmin() ? ['admin', '🛡', 'Админ'] : ['profile', '👤', 'Профиль']];
  $('#nav').innerHTML = items.map(([h, i, t]) => `<a href="#/${h}" class="${route === h ? 'on' : ''}"><span>${i}</span>${t}</a>`).join('');
}

// ------------------------------------------------------------ роутер
const routes = { '': home, catalog, provider, new: newRequest, requests, request, garage, prices, profile, login, business, cabinet, admin };
async function render() {
  clearInterval(S.timer); S.timer = null;
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const [name, arg] = path.split('/');
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  const fn = routes[name] || home;
  chrome(name in routes ? name : '');
  const v = $('#view');
  try { v.innerHTML = await fn(arg, q) || ''; fn.after?.(v, arg, q); } catch (e) { v.innerHTML = `<div class="card"><h3>Ошибка</h3><p>${esc(e.message)}</p></div>`; }
}
const needLogin = (what = 'этого действия') => `<div class="card"><h2>Нужно войти</h2><p class="muted">Для ${what} войдите через Telegram — это занимает 5 секунд.</p><a class="btn p" href="#/login">Войти</a></div>`;
const autoRefresh = () => { S.timer = setInterval(() => { if (!document.hidden && !document.activeElement?.closest('form')) render(); }, CONFIG.REFRESH_SECONDS * 1000); };

// ------------------------------------------------------------ главная
async function home() {
  return `<section class="hero"><h1>Помощь с машиной<br>в ${esc(S.city)}</h1><p>${esc(CONFIG.SITE_TAGLINE)}. Оставьте заявку — исполнители откликнутся сами.</p>
    <div class="row"><a class="btn p" href="#/new/sto">🆕 Новая заявка</a><a class="btn" href="#/prices">💰 Узнать цены</a></div></section>
  <h2>Что случилось?</h2>
  <div class="grid">${Object.entries(KINDS).map(([k, x]) => `<a class="tile" href="#/new/${k}"><div class="i">${x.icon}</div><b>${x.title}</b><small>${x.desc}</small></a>`).join('')}
    <a class="tile" href="#/catalog/sto"><div class="i">📒</div><b>Все автоуслуги</b><small>Каталог исполнителей и отзывы</small></a></div>
  <h2 style="margin-top:22px">Как это работает</h2>
  <div class="card"><ol style="margin:0;padding-left:20px"><li>Выбираете услугу и описываете проблему.</li><li>Заявку видят все подходящие исполнители вашего города (или только выбранный).</li>
    <li>Первый, кто принял, получает ваш телефон, а вы — его контакты. Для запчастей — сравниваете цены, для мойки — подтверждаете время.</li><li>После работы ставите оценку — рейтинг виден всем.</li></ol></div>
  <div class="grid" style="margin-top:12px">
    <a class="tile" href="#/business"><div class="i">💼</div><b>Для бизнеса</b><small>Подключить СТО, мойку, эвакуатор, магазин</small></a>
    <a class="tile" href="#/garage"><div class="i">🚗</div><b>Мой гараж</b><small>Авто и регламент ТО</small></a>
    ${S.myProv.length ? '<a class="tile" href="#/cabinet"><div class="i">🛠</div><b>Кабинет исполнителя</b><small>Входящие заявки</small></a>' : ''}
    ${isAdmin() ? '<a class="tile" href="#/admin"><div class="i">🛡</div><b>Админ-панель</b><small>Модерация и статистика</small></a>' : ''}
    <a class="tile" href="https://t.me/${esc(CONFIG.TELEGRAM_BOT)}" target="_blank" rel="noopener"><div class="i">✈️</div><b>Бот в Telegram</b><small>@${esc(CONFIG.TELEGRAM_BOT)}</small></a></div>`;
}

// ------------------------------------------------------------ каталог и карточка исполнителя
const provCard = (p, extra = '') => `<div class="card"><div class="row between"><b><a href="#/provider/${p.id}">${KINDS[p.kind].icon} ${esc(p.name)}</a></b>
  <span>${stars(p.rating)} <span class="small muted">${Number(p.rating || 0).toFixed(1)} · ${p.reviews_count || 0} отз.</span></span></div>
  <div class="small muted">${esc(p.city)}${p.address ? ' · ' + esc(p.address) : ''}${p.working_hours ? ' · 🕘 ' + esc(p.working_hours) : ''}</div>
  ${p.kind === 'sto' && p.specs?.length ? `<div class="small">${p.specs.map((c) => esc(catName(c))).filter(Boolean).join(' · ')}</div>` : ''}
  ${p.kind === 'urgent' && p.service_type ? `<div class="small">${URGENT[p.service_type]}</div>` : ''}
  ${p.kind === 'parts' && p.supplier_type ? `<div class="small">${SUPPLIER[p.supplier_type]}${p.delivery ? ' · 🚚 доставка' : ''}</div>` : ''}
  <div class="row" style="margin-top:8px">${tel(p.phone)}${extra}</div></div>`;
async function catalog(kind = 'sto', q) {
  if (!KINDS[kind]) kind = 'sto';
  let list = await api.listProviders({ kind, city: S.city });
  if (q.cat) list = list.filter((p) => !p.specs?.length || p.specs.includes(+q.cat));
  return `<h1>Все автоуслуги</h1><div class="tabs">${Object.entries(KINDS).map(([k, x]) => `<a href="#/catalog/${k}" class="${k === kind ? 'on' : ''}">${x.icon} ${x.short}</a>`).join('')}</div>
   ${kind === 'sto' ? `<select id="catF"><option value="">Все направления</option>${S.ref.categories.map((c) => `<option value="${c.id}" ${+q.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : ''}
   ${list.length ? list.map((p) => provCard(p, `<a class="btn p" href="#/new/${kind}?to=${p.id}">Оставить заявку</a>`)).join('')
    : `<div class="empty">В городе ${esc(S.city)} пока нет исполнителей этого типа.<br><a href="#/business">Подключите свой бизнес</a></div>`}`;
}
catalog.after = (v) => { const f = $('#catF', v); if (f) f.onchange = () => { location.hash = '#/catalog/sto' + (f.value ? '?cat=' + f.value : ''); }; };

async function provider(id) {
  const p = await api.getProvider(id);
  const [revs, pr] = await Promise.all([api.providerReviews(id), p.kind === 'sto' ? api.providerPrices(id) : []]);
  return `<a href="#/catalog/${p.kind}" class="small">← ${KINDS[p.kind].title}</a>${provCard(p, `<a class="btn p" href="#/new/${p.kind}?to=${p.id}">Оставить заявку</a>`)}
   ${pr.length ? `<div class="card"><h3>Прайс</h3><table><tr><th>Услуга</th><th>Авто</th><th>Цена</th></tr>${pr.map((x) => `<tr><td>${esc(x.service)}</td><td>${esc([x.brand, x.model].filter(Boolean).join(' ') || 'Все')}</td><td>${money(x.price)}</td></tr>`).join('')}</table></div>` : ''}
   <div class="card"><h3>Отзывы</h3>${revs.filter((r) => r.is_published).map((r) => `<p>${stars(r.rating)} <span class="small muted">${dt(r.created_at)}</span><br>${esc(r.comment)}</p>`).join('') || '<p class="muted">Пока нет отзывов</p>'}</div>
   <div class="card small muted">Ссылка на эту страницу: <span class="mono">${esc(siteUrl())}#/provider/${p.id}</span></div>`;
}

// ------------------------------------------------------------ новая заявка
async function newRequest(kind = 'sto', q) {
  if (!KINDS[kind]) kind = 'sto';
  const tabs = `<div class="tabs">${Object.entries(KINDS).map(([k, x]) => `<a href="#/new/${k}" class="${k === kind ? 'on' : ''}">${x.icon} ${x.short}</a>`).join('')}</div>`;
  if (!S.me) return `<h1>Новая заявка</h1>${tabs}${needLogin('создания заявки')}`;
  const warn = !S.me.phone || !S.me.consent ? `<div class="notice warn">Перед первой заявкой заполните <a href="#/profile">профиль</a>: телефон и согласие на обработку данных.</div>` : '';
  const [provs, cars] = await Promise.all([api.listProviders({ kind, city: S.city }), api.vehicles()]);
  const car = `<label>Автомобиль</label>${cars.length ? `<select name="car"><option value="">— ввести вручную —</option>${cars.map((c) => `<option>${esc(`${c.brand} ${c.model} ${c.year || ''}`.trim())}</option>`).join('')}</select>` : ''}
    <input name="vehicle_info" placeholder="Марка, модель, год (например Toyota Camry 2015)">`;
  const pick = (label, required) => `<label>${label}</label><select name="target_provider_id" ${required ? 'required' : ''}>${required ? '' : '<option value="">📢 Отправить всем в городе</option>'}${provs.map((p) => `<option value="${p.id}" ${+q.to === p.id ? 'selected' : ''}>${esc(p.name)} · ★${Number(p.rating).toFixed(1)}</option>`).join('')}</select>`;
  let body = '';
  if (kind === 'sto') {
    body = `<label>Что нужно сделать?</label><select name="category_id" id="catSel" required><option value="">— выберите направление —</option>${S.ref.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      <label>Уточните</label><select name="subcategory" id="subSel"><option value="">— сначала выберите направление —</option></select>
      ${pick('Куда отправить')}${car}<label>Опишите проблему</label><textarea name="description" rows="3" placeholder="Например: стук спереди справа на кочках">${esc(q.sub ? 'Интересует: ' + q.sub : '')}</textarea>`;
  } else if (kind === 'tow') {
    body = `<label>Тип транспорта</label>${opts('vehicle', pairs(TOW_VEHICLES), TOW_VEHICLES[0])}<label>Колёса</label>${opts('wheels', pairs(WHEELS), WHEELS[0])}
      <label>Где машина?</label><div class="row"><input name="location" class="grow" required placeholder="Адрес или ориентир"><button type="button" id="geo">📍 Моё место</button></div>
      <input type="hidden" name="lat"><input type="hidden" name="lon">${pick('Кому отправить')}${car}<label>Комментарий</label><textarea name="description" rows="2" placeholder="Куда везти, особенности"></textarea>`;
  } else if (kind === 'wash') {
    if (!provs.length) return `<h1>Автомойка</h1>${tabs}<div class="empty">В городе ${esc(S.city)} пока нет моек.</div>`;
    const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return [d.toISOString().slice(0, 10), i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' })]; });
    body = `${pick('Мойка', true)}<label>Услуга</label>${opts('service_type', pairs(WASH_SERVICES), WASH_SERVICES[1])}<label>Кузов</label>${opts('car_type', pairs(CAR_TYPES), CAR_TYPES[0])}
      <label>День</label>${opts('day', days, days[0][0])}<label>Желаемое время</label><div class="slots" id="slots"></div><label>Комментарий</label><textarea name="description" rows="2"></textarea>`;
  } else if (kind === 'parts') {
    body = `<label>Где искать</label>${opts('supplier_type', [['', '📋 Везде'], ...Object.entries(SUPPLIER)], '')}<label>Какая запчасть нужна?</label><input name="description" required placeholder="Например: фара передняя левая">
      ${car}<label>Срочность</label>${opts('urgency', pairs(PARTS_URGENCY), PARTS_URGENCY[1])}<label>Оригинал или аналог</label>${opts('original', pairs(PARTS_ORIG), PARTS_ORIG[2])}
      <label>Получение</label>${opts('delivery', pairs(PARTS_DELIVERY), PARTS_DELIVERY[0])}<label>Бюджет (необязательно), ₸</label><input name="budget" type="number" min="0" step="500">
      <p class="small muted">Поставщики пришлют цены анонимно, вы выберете лучшее — тогда обе стороны увидят контакты. Заявка активна 3 часа.</p>`;
  } else {
    body = `<label>Что нужно?</label>${opts('service_type', Object.entries(URGENT), q.type || 'locksmith')}
      <label>Где вы?</label><div class="row"><input name="location" class="grow" required placeholder="Адрес или ориентир"><button type="button" id="geo">📍 Моё место</button></div>
      <input type="hidden" name="lat"><input type="hidden" name="lon">${car}<label>Опишите ситуацию</label><textarea name="description" rows="2" placeholder="Например: ключи в закрытой машине"></textarea>`;
  }
  return `<h1>${KINDS[kind].icon} ${KINDS[kind].title}</h1>${tabs}${warn}<form id="reqForm" class="card" data-kind="${kind}"><div class="small muted">Город: <b>${esc(S.city)}</b> (меняется вверху)</div>${body}
    <button class="p block" style="margin-top:16px">Отправить заявку</button></form>`;
}
newRequest.after = (v, kind) => {
  const f = $('#reqForm', v); if (!f) return;
  const cs = $('#catSel', v);
  if (cs) cs.onchange = () => { $('#subSel', v).innerHTML = '<option value="">— не знаю / другое —</option>' + S.ref.subcategories.filter((s) => s.category_id === +cs.value).map((s) => `<option>${esc(s.name)}</option>`).join(''); };
  const g = $('#geo', v);
  if (g) g.onclick = () => navigator.geolocation?.getCurrentPosition((p) => { f.lat.value = p.coords.latitude.toFixed(6); f.lon.value = p.coords.longitude.toFixed(6);
    if (!f.location.value) f.location.value = 'Геолокация отправлена'; toast('Координаты добавлены'); }, () => toast('Не удалось определить место', true));
  if (f.car) f.car.onchange = () => { if (f.car.value) f.vehicle_info.value = f.car.value; };
  const slots = $('#slots', v);
  const drawSlots = async () => {
    if (!slots) return;
    const p = await api.getProvider(f.target_provider_id.value);
    const m = /(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/.exec(p.working_hours || '') || [0, 9, 0, 20, 0];
    const step = p.slot_minutes || 60, day = new Date(f.day.value + 'T00:00:00'), out = [];
    for (let t = +m[1] * 60 + +m[2]; t + step <= +m[3] * 60 + +m[4]; t += step) {
      const d = new Date(day); d.setMinutes(t); if (d > new Date()) out.push(d);
    }
    slots.innerHTML = out.length ? out.map((d, i) => `<label class="opt"><input type="radio" name="desired_time" value="${d.toISOString()}" ${i === 0 ? 'checked' : ''}><span>${d.toTimeString().slice(0, 5)}</span></label>`).join('') : '<span class="muted small">На этот день свободного времени нет</span>';
  };
  if (slots) { f.target_provider_id.onchange = drawSlots; $$('[name=day]', f).forEach((r) => r.onchange = drawSlots); drawSlots(); }
  f.onsubmit = (e) => { e.preventDefault(); const d = formData(f); const btn = $('button.p', f);
    const details = {}; for (const k of ['vehicle', 'wheels', 'location', 'lat', 'lon', 'car_type', 'urgency', 'original', 'delivery', 'budget']) if (d[k]) details[k] = d[k];
    const p = { type: kind, city: S.city, category_id: d.category_id || null, subcategory: d.subcategory || null, service_type: d.service_type || null,
      supplier_type: d.supplier_type || null, target_provider_id: d.target_provider_id || null, description: d.description || '', vehicle_info: d.vehicle_info || '', details, desired_time: d.desired_time || null };
    if (kind === 'wash' && !p.desired_time) return toast('Выберите время', true);
    btn.disabled = true;
    api.createRequest(p).then((id) => { toast('Заявка отправлена! Исполнители уже видят её.'); location.hash = '#/request/' + id; }).catch((er) => { toast(er.message, true); btn.disabled = false; });
  };
};

// ------------------------------------------------------------ мои заявки
const reqTitle = (r) => `${KINDS[r.type].icon} ${r.type === 'sto' ? esc(catName(r.category_id) || 'СТО') : r.type === 'urgent' ? esc(URGENT[r.service_type] || 'Выездная помощь') : r.type === 'wash' ? esc(r.service_type || 'Мойка') : KINDS[r.type].title}`;
const reqInfo = (r) => {
  const d = r.details || {};
  const rows = [['Номер', `<span class="mono">#${r.id}</span>`], ['Создана', dt(r.created_at)], ['Город', esc(r.city)],
    r.subcategory && ['Уточнение', esc(r.subcategory)], r.vehicle_info && ['Авто', esc(r.vehicle_info)], r.description && ['Описание', esc(r.description)],
    d.vehicle && ['Транспорт', esc(d.vehicle)], d.wheels && ['Колёса', esc(d.wheels)],
    d.location && ['Место', esc(d.location) + (d.lat ? ` · <a target="_blank" rel="noopener" href="https://2gis.kz/geo/${d.lon},${d.lat}">карта</a>` : '')],
    d.car_type && ['Кузов', esc(d.car_type)], r.desired_time && ['Желаемое время', dt(r.desired_time)], r.assigned_time && ['Назначено', dt(r.assigned_time)],
    r.supplier_type && ['Где искать', SUPPLIER[r.supplier_type]], d.urgency && ['Срочность', esc(d.urgency)], d.original && ['Оригинал/аналог', esc(d.original)],
    d.delivery && ['Получение', esc(d.delivery)], d.budget && ['Бюджет', money(d.budget)], r.price && ['Цена мойки', money(r.price)], r.final_amount && ['Сумма', money(r.final_amount)],
    r.expires_at && ['Активна до', dt(r.expires_at)]].filter(Boolean);
  return `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
};
async function requests() {
  if (!S.me) return `<h1>Мои заявки</h1>${needLogin('просмотра заявок')}`;
  const list = await api.myRequests(); autoRefresh();
  return `<h1>Мои заявки</h1>${list.length ? list.map((r) => `<a class="card" style="display:block;color:inherit" href="#/request/${r.id}"><div class="row between"><b>${reqTitle(r)}</b>${badge(effStatus(r))}</div>
    <div class="small muted">#${r.id} · ${dt(r.created_at)}${r.vehicle_info ? ' · ' + esc(r.vehicle_info) : ''}</div><div class="small">${esc((r.description || r.subcategory || '').slice(0, 120))}</div></a>`).join('')
    : '<div class="empty">Заявок пока нет. <a href="#/new/sto">Создать первую</a></div>'}`;
}
async function request(id) {
  if (!S.me) return needLogin();
  const r = (await api.myRequests()).find((x) => x.id === +id); if (!r) return '<div class="empty">Заявка не найдена</div>';
  const st = effStatus(r); autoRefresh();
  let block = '';
  const prov = r.accepted_by ? await api.getProvider(r.accepted_by).catch(() => null) : null;
  if (r.type === 'parts' && ['new', 'offers'].includes(st)) {
    const offs = await api.requestOffers(r.id);
    block = `<div class="card"><h3>Предложения поставщиков</h3>${offs.length ? offs.map((o) => `<div class="row between" style="border-bottom:1px solid #262626;padding:8px 0"><div><span class="price">${money(o.price)}</span><br><span class="small">${esc(o.provider_name)} · ★${Number(o.provider_rating).toFixed(1)}${o.delivery ? ' · 🚚' : ''}</span><br><span class="small muted">${esc(o.comment)}</span></div>
      <button class="p" data-offer="${o.id}">Выбрать</button></div>`).join('') : '<p class="muted">Ждём предложения… Страница обновляется сама.</p>'}</div>`;
  } else if (['new'].includes(st)) {
    block = `<div class="card"><p>⏳ Заявку видят исполнители. Как только кто-то примет — здесь появятся его контакты.</p></div>`;
    if (['tow', 'sto', 'urgent'].includes(r.type) && Date.now() - new Date(r.created_at) > 5 * 60000) {
      const all = await api.listProviders({ kind: r.type, city: r.city });
      block += `<div class="card"><h3>Пока никто не ответил — позвоните напрямую</h3>${all.map((p) => `<div class="row between small" style="padding:4px 0"><span>${esc(p.name)}</span>${tel(p.phone)}</div>`).join('') || '<p class="muted">Нет исполнителей в городе</p>'}</div>`;
    }
  }
  if (prov && !['new', 'offers'].includes(st)) block += `<div class="card"><h3>Исполнитель</h3>${provCard(prov)}</div>`;
  const btns = [];
  if (r.type === 'wash' && st === 'price_offered') btns.push(`<div class="notice">Мойка предлагает: <b>${money(r.price)}</b>, время <b>${dt(r.assigned_time)}</b></div><button class="ok" data-a="washApprove">✅ Подтвердить запись</button>`);
  if (r.type === 'wash' && st === 'waiting_client') btns.push('<div class="notice">🚗 Машина готова — можно забирать!</div><button class="ok" data-a="clientConfirm">Забрал машину</button>');
  if (r.type === 'parts' && st === 'delivered') btns.push('<button class="ok" data-a="clientConfirm">📦 Получил запчасть</button>');
  if (['tow', 'sto', 'urgent'].includes(r.type) && st === 'active') btns.push('<button class="ok" data-a="clientConfirm">✅ Работа выполнена</button>');
  if (!['completed', 'cancelled', 'expired'].includes(st)) btns.push('<button class="danger" data-a="cancelRequest">Отменить заявку</button>');
  let review = '';
  if (st === 'completed' && r.accepted_by) {
    const mine = await api.myReviewFor(r.id);
    review = mine ? `<div class="card"><h3>Ваша оценка</h3>${stars(mine.rating)} ${esc(mine.comment)} ${mine.is_published ? '' : '<span class="small muted">(отзыв на модерации)</span>'}</div>`
      : `<form class="card" id="revForm"><h3>Оцените исполнителя</h3>${opts('rating', [5, 4, 3, 2, 1].map((n) => [String(n), '★'.repeat(n)]), '5')}<label>Отзыв (необязательно)</label><textarea name="comment" rows="2"></textarea><button class="p" style="margin-top:10px">Отправить оценку</button></form>`;
  }
  return `<a href="#/requests" class="small">← Мои заявки</a><div class="card"><div class="row between"><h2>${reqTitle(r)}</h2>${badge(st)}</div>${reqInfo(r)}</div>${block}
    ${btns.length ? `<div class="card row">${btns.join('')}</div>` : ''}${review}`;
}
request.after = (v, id) => {
  $$('[data-offer]', v).forEach((b) => b.onclick = () => act(b, () => api.selectOffer(+b.dataset.offer), 'Предложение выбрано — контакты открыты'));
  $$('[data-a]', v).forEach((b) => b.onclick = () => { if (b.dataset.a === 'cancelRequest' && !confirm('Отменить заявку?')) return; act(b, () => api[b.dataset.a](+id), 'Готово'); });
  const f = $('#revForm', v); if (f) f.onsubmit = (e) => { e.preventDefault(); const d = formData(f); act($('button', f), () => api.leaveReview(+id, +d.rating, d.comment), 'Спасибо за оценку!'); };
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
    <label>Госномер (необязательно)</label><input name="plate"><button class="p" style="margin-top:12px">Добавить</button></form>${reg}`;
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
    <button class="danger" id="delData">Удалить мои данные</button><button class="ghost" id="logout">Выйти</button></div>`;
}
profile.after = (v) => {
  const f = $('#prf', v); if (!f) return login.after(v);
  f.onsubmit = (e) => { e.preventDefault(); const d = formData(f); act($('button', f), async () => { S.me = await api.updateProfile({ ...d, consent: !!d.consent }); S.city = d.city; localStorage.setItem('am24-city', S.city); }, 'Профиль сохранён'); };
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
    <div class="tabs">${[['feed', '📥 Заявки'], ...(p.kind === 'sto' ? [['prices', '💰 Прайс']] : []), ['org', '🏢 Организация'], ['link', '🔗 Моя ссылка']].map(([t, n]) => `<a href="#/cabinet?p=${p.id}&t=${t}" class="${t === tab ? 'on' : ''}">${n}</a>`).join('')}</div>`;
  if (tab === 'prices') {
    const pr = await api.providerPrices(p.id);
    return `${head}<div class="card"><h3>Мой прайс</h3>${pr.length ? `<table><tr><th>Услуга</th><th>Авто</th><th>Цена</th><th></th></tr>${pr.map((x) => `<tr><td>${esc(x.service)}</td><td>${esc([x.brand, x.model].filter(Boolean).join(' ') || 'Все')}${x.year_from ? ` ${x.year_from}–${x.year_to || ''}` : ''}</td><td>${money(x.price)}</td><td><button class="danger" data-dp="${x.id}">✕</button></td></tr>`).join('')}</table>` : '<p class="muted">Прайс пуст. Клиенты находят вас в «Узнать цены» по этим строкам.</p>'}</div>
      <form class="card" id="prForm"><h3>Добавить цену</h3><label>Услуга</label><input name="service" list="svc2" required><datalist id="svc2">${S.ref.price_services.map((s) => `<option>${esc(s.name)}</option>`).join('')}</datalist>
      <div class="row"><div class="grow"><label>Марка («все» — пусто)</label><input name="brand" list="br2"><datalist id="br2">${S.ref.brands.map((b) => `<option>${esc(b.name)}</option>`).join('')}</datalist></div><div class="grow"><label>Модель</label><input name="model"></div></div>
      <div class="row"><div class="grow"><label>Год от</label><input name="year_from" type="number"></div><div class="grow"><label>Год до</label><input name="year_to" type="number"></div><div class="grow"><label>Цена, ₸</label><input name="price" type="number" min="1" required></div></div>
      <button class="p" style="margin-top:12px">Добавить</button></form>`;
  }
  if (tab === 'org') {
    return `${head}<form class="card" id="orgForm"><label>Название</label><input name="name" value="${esc(p.name)}" required><label>Телефон</label><input name="phone" value="${esc(p.phone)}">
      <label>Адрес</label><input name="address" value="${esc(p.address)}"><label>Часы работы</label><input name="working_hours" value="${esc(p.working_hours)}" placeholder="09:00-19:00">
      ${p.kind === 'sto' ? `<label>Направления (пусто — получать все заявки СТО)</label>${opts('specs', S.ref.categories.map((c) => [String(c.id), c.name]), p.specs.map(String), 'checkbox')}` : ''}
      ${p.kind === 'wash' ? `<div class="row"><div class="grow"><label>Боксов</label><input name="boxes" type="number" min="1" value="${p.boxes}"></div><div class="grow"><label>Минут на машину</label><input name="slot_minutes" type="number" min="15" step="15" value="${p.slot_minutes}"></div></div>` : ''}
      ${p.kind === 'parts' ? `<label class="check"><input type="checkbox" name="delivery" ${p.delivery ? 'checked' : ''}> <span>Есть доставка</span></label>` : ''}
      <p class="small muted">Рейтинг: ${stars(p.rating)} ${Number(p.rating).toFixed(1)} (${p.reviews_count} отз.) · город ${esc(p.city)}</p><button class="p">Сохранить</button></form>`;
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
    return `<div class="card"><div class="row between"><b>${reqTitle(r)}</b>${badge(st)}</div>${reqInfo(r)}<div class="row" style="margin-top:10px">${a}</div></div>`;
  };
  return `${head}<p class="small muted">Лента обновляется каждые ${CONFIG.REFRESH_SECONDS} сек. Новые заявки города ${esc(p.city)} по вашему профилю появляются здесь.</p>
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
  const of = $('#orgForm', v); if (of) of.onsubmit = (e) => { e.preventDefault(); const d = formData(of); const patch = { name: d.name, phone: d.phone, address: d.address, working_hours: d.working_hours };
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
    return head + `<div class="card"><table><tr><th>Название</th><th>Тип</th><th>Город</th><th>Рейтинг</th><th></th></tr>${p.map((x) => `<tr><td><a href="#/provider/${x.id}">${esc(x.name)}</a></td><td>${KINDS[x.kind].short}</td><td>${esc(x.city)}</td><td>${Number(x.rating).toFixed(1)}</td><td><button class="${x.is_active ? 'danger' : 'ok'}" data-pa="${x.id}:${x.is_active ? 0 : 1}">${x.is_active ? 'Отключить' : 'Включить'}</button></td></tr>`).join('')}</table></div>`; }
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
  $$('[data-ca]', v).forEach((b) => b.onclick = () => { const [id, on] = b.dataset.ca.split(':'); act(b, async () => { await api.setCityActive(+id, on === '1'); S.ref = await api.ref(); }, 'Готово'); });
  const cf = $('#cityForm', v); if (cf) cf.onsubmit = (e) => { e.preventDefault(); act($('button', cf), async () => { await api.addCity(cf.querySelector('[name=name]').value.trim()); S.ref = await api.ref(); }, 'Город добавлен'); };
};

boot();
