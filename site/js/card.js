// Цифровая визитка исполнителя: card.html?id=N — для всех типов (СТО, эвакуатор, мойка, магазин, выездная помощь, грузоперевозки).
// Заявка с визитки уходит владельцу в WhatsApp (messaging.js) и сохраняется у него в кабинете (api.createLead).
import { CONFIG } from './config.js';
import { api, IS_DEMO, FORCED_DEMO, leaveDemo } from './api.js';
import { KINDS, CARD_ROLE, URGENT, SUPPLIER, WASH_SERVICES, CAR_TYPES, WHEELS, PARTS_ORIG, PARTS_DELIVERY, CARGO_SERVICES, CARGO_VEHICLES, CARGO_WHEN } from './consts.js';
import { REGION, money, mapSearch, mapPoint, fmtPhone, validPhone } from './region.js';
import { PRIMARY, sendLink, requestText, ownerContact } from './messaging.js';
import { startOrder, myOrders } from './orders.js';
import { qrSvg, qrPng, download, vcard, share, cardUrl, shopUrl, hasShop, isExternalShop } from './cardkit.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const IMG = { sto: 'assets/img/sto.webp', tow: 'assets/img/tow.webp', wash: 'assets/img/wash.webp', parts: 'assets/img/parts.webp', urgent: 'assets/img/help.webp', cargo: 'assets/img/cargo.webp' };
const toast = (m, err) => { const t = $('#toast'); t.textContent = m; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 3500); };
const opts = (name, list, sel, type = 'radio') => `<div class="opts">${list.map(([v, t]) => `<label class="opt"><input type="${type}" name="${name}" value="${esc(v)}" ${(Array.isArray(sel) ? sel.includes(v) : sel === v) ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>`;
const pairs = (a) => a.map((x) => [x, x]);
const initials = (n) => String(n || '?').replace(/[«»"'()]/g, '').split(/\s+/).filter((w) => /^[\p{L}\d]/u.test(w) && !/^демо/i.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '★';
function openNow(wh) {
  if (!wh) return null; if (/кругл|24\s*\/\s*7|24 часа/i.test(wh)) return true;
  const m = /(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/.exec(wh); if (!m) return null;
  const n = new Date(new Date().toLocaleString('en-US', { timeZone: REGION.tz })), t = n.getHours() * 60 + n.getMinutes(), a = +m[1] * 60 + +m[2], b = +m[3] * 60 + +m[4];
  return b > a ? t >= a && t < b : t >= a || t < b;
}
const veh = (id) => CARGO_VEHICLES.find((v) => v.id === id);

function theme() {
  const b = $('#themeBtn'); const set = (t, save) => { document.documentElement.dataset.theme = t; b.textContent = t === 'light' ? '🌙' : '☀️'; if (save) localStorage.setItem('am24-theme', t); };
  set(document.documentElement.dataset.theme || 'dark'); b.onclick = () => set(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true);
  if (IS_DEMO) { const bar = $('#demoBar'); bar.hidden = false; bar.innerHTML = `<b>ДЕМО</b><span>визитка вымышленная, данные только в этом браузере.</span>${FORCED_DEMO ? '<button data-leave>Выйти из демо</button>' : ''}`;
    const lv = $('[data-leave]', bar); if (lv) lv.onclick = () => { leaveDemo(); location.href = './'; }; }
}

// поля быстрой заявки — свои для каждого типа
function orderFields(p) {
  const c = p.card || {}, svc = (c.services || []).map((x) => x.name).filter(Boolean);
  const geo = (name, ph) => `<div class="row"><input name="${name}" class="grow" placeholder="${ph}"><button type="button" class="sm" data-geo="${name}">📍 Я здесь</button></div>`;
  const car = '<label>Автомобиль</label><input name="car" placeholder="Марка, модель, год">';
  switch (p.kind) {
    case 'cargo': return `<label>Что везём?</label>${opts('what', pairs(CARGO_SERVICES.slice(0, 6)), 'Переезд')}<label>Откуда</label>${geo('from', 'Адрес погрузки')}<label>Куда</label><input name="to" placeholder="Адрес выгрузки или город">
      <label>Когда</label>${opts('when', pairs(CARGO_WHEN), 'Сегодня')}<label class="check"><input type="checkbox" name="loaders"> <span>Нужны грузчики</span></label><label>Ваша цена (необязательно), ${REGION.symbol}</label><input name="price" type="number" min="0" step="500">`;
    case 'tow': return `<label>Где машина?</label>${geo('from', 'Адрес или ориентир')}<label>Куда везти</label><input name="to" placeholder="Адрес, СТО или город">${car}<label>Колёса</label>${opts('wheels', pairs(WHEELS), WHEELS[0])}`;
    case 'wash': return `<label>Услуга</label>${opts('what', pairs(svc.length ? svc : WASH_SERVICES), (svc[0] || WASH_SERVICES[1]))}<label>Кузов</label>${opts('body', pairs(CAR_TYPES), CAR_TYPES[0])}<label>Когда</label>${opts('when', pairs(['Сейчас', 'Сегодня', 'Завтра', 'Договоримся']), 'Сегодня')}`;
    case 'parts': return `<label>Какая запчасть нужна?</label><input name="what" required placeholder="Например: колодки передние"><label>Авто или VIN</label><input name="car" placeholder="Toyota Camry 2015 или VIN"><label>Оригинал или аналог</label>${opts('orig', pairs(PARTS_ORIG), PARTS_ORIG[2])}<label>Получение</label>${opts('delivery', pairs(PARTS_DELIVERY), PARTS_DELIVERY[0])}`;
    case 'urgent': return `<label>Что случилось?</label>${opts('what', Object.values(URGENT).map((x) => [x, x]), URGENT[p.service_type] || Object.values(URGENT)[0])}<label>Где вы?</label>${geo('from', 'Адрес или ориентир')}${car}`;
    default: return `<label>Что нужно?</label>${svc.length ? opts('what', pairs([...svc, 'Другое']), svc[0]) : '<input name="what" placeholder="Например: диагностика, замена масла">'}${car}<label>Когда удобно?</label>${opts('when', pairs(['Сегодня', 'Завтра', 'На этой неделе', 'Договоримся']), 'Сегодня')}`;
  }
}
function orderPlain(p, d) {
  const L = p.kind === 'cargo' ? [['Груз', d.what], ['Откуда', d.from], ['Куда', d.to], ['Когда', d.when], ['Грузчики', d.loaders ? 'нужны' : ''], ['Цена клиента', d.price && money(d.price)]]
    : p.kind === 'tow' ? [['Где машина', d.from], ['Куда', d.to], ['Авто', d.car], ['Колёса', d.wheels]]
    : p.kind === 'wash' ? [['Услуга', d.what], ['Кузов', d.body], ['Когда', d.when]]
    : p.kind === 'parts' ? [['Запчасть', d.what], ['Авто/VIN', d.car], ['Оригинал/аналог', d.orig], ['Получение', d.delivery]]
    : p.kind === 'urgent' ? [['Нужно', d.what], ['Где', d.from], ['Авто', d.car]]
    : [['Нужно', d.what], ['Авто', d.car], ['Когда', d.when]];
  if (d.lat) L.push(['Точка на карте', mapPoint(d.lat, d.lon)]);
  if (d.comment) L.push(['Комментарий', d.comment]);
  return L;
}

async function main() {
  theme();
  const id = +new URLSearchParams(location.search).get('id');
  const root = $('#card');
  let p, caps;
  try { if (!id) throw new Error('no id'); [p, caps] = await Promise.all([api.getProvider(id), api.caps().catch(() => ({}))]); }
  catch { root.innerHTML = `<div class="card center"><div class="big-i">🤷</div><h2>Визитка не найдена</h2><p class="muted">Ссылка неполная или визитку отключили. Найдите исполнителя в каталоге.</p>${IS_DEMO ? '' : '<p class="small muted">Посмотреть, как выглядит визитка: <a href="card.html?id=14&demo=1">пример в демо</a>.</p>'}<div class="row" style="justify-content:center"><a class="btn p" href="./#/catalog/sto">Каталог</a><a class="btn" href="./#/business">Создать свою визитку</a></div></div>`; return; }
  const c = p.card || {}, url = cardUrl(p.id), to = ownerContact(p), open = openNow(p.working_hours), cg = c.cargo || {};
  document.title = `${p.name} — ${CARD_ROLE[p.kind]} · ${CONFIG.SITE_NAME}`;
  const role = [CARD_ROLE[p.kind], p.kind === 'urgent' && URGENT[p.service_type], p.kind === 'parts' && SUPPLIER[p.supplier_type]?.replace(/^\S+\s/, '')].filter(Boolean).join(' · ');
  const shopBtn = hasShop(p) ? `<a class="btn shopbtn block" href="${esc(shopUrl(p))}" ${isExternalShop(p) ? 'target="_blank" rel="noopener"' : ''}>🛍 Магазин — смотреть товары</a>` : '';
  const pay = (c.payments || []).map((k) => REGION.payments.find(([x]) => x === k)?.[1]).filter(Boolean);
  root.innerHTML = `
  <section class="vc-hero" style="background-image:url('${esc(p.photos?.[0] || IMG[p.kind])}')"><div class="vc-hero-in">
    <div class="vc-ava" aria-hidden="true">${esc(initials(p.name))}</div>
    <div class="grow"><div class="vc-role">${KINDS[p.kind].icon} ${esc(role)}</div><h1>${esc(p.name)}</h1>
    <div class="row small">${p.verified ? '<span class="vbadge">✔ Проверен</span>' : ''}${open == null ? '' : open ? '<span class="chip-s ok">● Сейчас работает</span>' : '<span class="chip-s off">● Сейчас закрыто</span>'}${p.reviews_count ? `<span class="chip-s">★ ${Number(p.rating).toFixed(1)} · ${p.reviews_count} отз.</span>` : ''}<span class="chip-s">📍 ${esc(p.city)}</span></div></div></div></section>
  ${c.slogan ? `<p class="vc-slogan">${esc(c.slogan)}</p>` : ''}
  ${caps.v5 ? '<a class="btn p block vc-chat" href="#orderF">💬 Написать здесь, на сайте — ответ придёт в чат</a>' : ''}
  <div class="vc-main">${to ? `<a class="btn wa big" id="waBtn" target="_blank" rel="noopener" href="${esc(sendLink(to, `Здравствуйте! Нашёл вашу визитку на ${CONFIG.SITE_NAME}: ${url}`))}">${PRIMARY.icon} Написать в ${PRIMARY.label}</a>` : ''}${p.phone ? `<a class="btn big" href="tel:+${esc(String(p.phone).replace(/\D/g, ''))}">📞 Позвонить</a>` : ''}</div>
  ${shopBtn}
  <div class="vc-acts"><a class="btn" id="vcf" href="#" download="${esc(p.name)}.vcf">👤 В контакты</a><button id="shareBtn">🔗 Поделиться</button><button id="qrBtn">▦ QR-код</button>
    ${c.tg ? `<a class="btn" href="https://t.me/${esc(c.tg)}" target="_blank" rel="noopener">✈️ Telegram</a>` : ''}${c.ig ? `<a class="btn" href="https://instagram.com/${esc(c.ig)}" target="_blank" rel="noopener">📷 Instagram</a>` : ''}</div>
  ${p.kind === 'cargo' && cg.vehicle ? `<div class="card vc-veh"><img src="${esc(veh(cg.vehicle)?.img || IMG.cargo)}" alt="${esc(veh(cg.vehicle)?.name || '')}"><div><b>${esc(veh(cg.vehicle)?.name || '')}</b> <span class="muted">${esc(veh(cg.vehicle)?.cap || '')}</span>
    ${cg.price ? `<div class="price">от ${money(cg.price)}<small> / ${esc(cg.unit || 'час')}</small></div>` : ''}${cg.extras?.length ? `<div class="small">Есть: ${esc(cg.extras.join(', '))}</div>` : ''}${c.zones ? `<div class="small muted">Районы: ${esc(c.zones)}</div>` : ''}</div></div>` : ''}
  <form class="card" id="orderF" novalidate><h2 style="margin-top:0">📝 Быстрая заявка</h2><p class="small muted">Заполните — ${caps.v5 ? 'откроется чат на сайте, а' : ''} сообщение уйдёт ${esc(p.name)} в ${PRIMARY.label}${caps.v4 ? ' и сохранится у него в кабинете' : ''}.</p>
    ${orderFields(p)}<input type="hidden" name="lat"><input type="hidden" name="lon"><label>Комментарий</label><textarea name="comment" rows="2" maxlength="1000"></textarea>
    <div class="row"><div class="grow"><label>Ваше имя</label><input name="name" autocomplete="name" maxlength="80"></div><div class="grow"><label>Телефон (необязательно)</label><input name="phone" type="tel" autocomplete="tel" placeholder="${esc(REGION.phone.placeholder)}"></div></div>
    <button class="btn wa big block" style="margin-top:14px" ${to ? '' : 'disabled'}>${PRIMARY.icon} Отправить заявку в ${PRIMARY.label}</button><div id="sent"></div></form>
  ${(c.services || []).length ? `<div class="card"><h3>Услуги и цены</h3><table class="svc">${c.services.map((x) => `<tr><td>${esc(x.name)}</td><td><b>${typeof x.price === 'number' ? money(x.price) : esc(x.price || '')}</b></td></tr>`).join('')}</table></div>` : ''}
  <div class="card"><dl class="kv">${p.address ? `<dt>Адрес</dt><dd>${esc(p.address)}<br><a href="${esc(mapSearch(p.city, p.address))}" target="_blank" rel="noopener">🗺 ${REGION.maps.name}</a> · <a href="${esc(REGION.maps.alt.search([p.city, p.address].join(', ')))}" target="_blank" rel="noopener">${REGION.maps.alt.name}</a></dd>` : ''}
    <dt>Город</dt><dd>${esc(p.city)}</dd>${p.working_hours ? `<dt>Часы</dt><dd>${esc(p.working_hours)}</dd>` : ''}${p.phone ? `<dt>Телефон</dt><dd>${esc(fmtPhone(p.phone))}</dd>` : ''}${pay.length ? `<dt>Оплата</dt><dd>${esc(pay.join(', '))}</dd>` : ''}${p.kind === 'parts' && p.delivery ? '<dt>Доставка</dt><dd>Есть</dd>' : ''}</dl>
    ${p.about ? `<p>${esc(p.about)}</p>` : ''}</div>
  ${(p.photos || []).length > 1 ? `<div class="gallery">${p.photos.map((u, i) => `<a class="gph" href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Фото ${i + 1}" loading="lazy"></a>`).join('')}</div>` : ''}
  <section id="ordRev"></section>
  <div class="row" style="justify-content:center;margin:8px 0"><a class="btn sm" href="./#/provider/${p.id}">⭐ Отзывы и рейтинг</a><a class="btn sm" href="./#/catalog/${p.kind}">Другие: ${esc(KINDS[p.kind].title)}</a></div>
  <a class="vc-made" href="./#/business">Сделано на ${esc(CONFIG.SITE_NAME)} — <b>создайте свою визитку бесплатно →</b></a>`;
  $('#vcf').href = vcard(p, url);
  $('#shareBtn').onclick = () => share(`${p.name} — ${CARD_ROLE[p.kind]}`, url, toast);
  $('#qrBtn').onclick = () => showQr(p, url);
  $$('[data-geo]').forEach((b) => b.onclick = () => {
    if (!navigator.geolocation) return toast('Браузер не умеет определять место — впишите адрес', true);
    b.disabled = true; b.textContent = 'Ищу…';
    navigator.geolocation.getCurrentPosition((pos) => { const f = $('#orderF'); f.lat.value = pos.coords.latitude.toFixed(6); f.lon.value = pos.coords.longitude.toFixed(6); const inp = f[b.dataset.geo]; if (!inp.value) inp.value = 'По геолокации'; b.textContent = '✅ Есть точка'; toast('Точка добавлена — исполнитель получит ссылку на карту'); },
      () => { b.disabled = false; b.textContent = '📍 Я здесь'; toast('Не удалось определить место — разрешите геолокацию или впишите адрес', true); }, { enableHighAccuracy: true, timeout: 10000 });
  });
  if (caps.v5) api.providerOrderReviews(p.id).then((R) => { if (!R.length) return;
    $('#ordRev').innerHTML = `<div class="card"><h2 style="margin-top:0">⭐ Отзывы по заказам · ${Number(p.rating).toFixed(1)} (${p.reviews_count})</h2><p class="small muted">Оценки ставят клиенты после выполненного заказа в чате на сайте.</p>
      ${R.slice(0, 6).map((r) => `<div class="vc-rev"><b>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</b> <span class="small muted">${esc(r.name)} · ${new Date(r.rated_at).toLocaleDateString('ru-RU')}</span>${r.review ? `<p>${esc(r.review)}</p>` : ''}</div>`).join('')}</div>`; }).catch(() => {});
  const mine = myOrders().filter((x) => !!x.demo === IS_DEMO && x.provider === p.name);
  if (mine.length) $('#sent').innerHTML = `<div class="notice">💬 У вас есть переписка с ${esc(p.name)}: ${mine.slice(0, 3).map((x) => `<a href="order.html?id=${x.id}&t=${encodeURIComponent(x.token)}">заявка №${x.id}</a>`).join(', ')}</div>`;
  const f = $('#orderF');
  f.onsubmit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    if (p.kind === 'parts' && !d.what) return toast('Напишите, какая запчасть нужна', true);
    if (p.kind === 'cargo' && !(d.from || d.to)) return toast('Укажите, откуда и куда везём', true);
    if (d.phone && !validPhone(d.phone)) return toast(`Телефон в формате ${REGION.phone.placeholder}`, true);
    const text = requestText({ title: `${KINDS[p.kind].title}${d.what ? ': ' + d.what : ''}`, provider: p, fields: orderPlain(p, d), customer: { name: d.name, phone: d.phone }, url });
    const lead = { provider_id: p.id, kind: p.kind, source: 'card', customer_name: d.name || '', customer_phone: d.phone || '', message: text, payload: d };
    if (caps.v5) { // заявка → чат на сайте + уведомление в WhatsApp со ссылкой на чат
      const btn = $('button:not([type=button])', f); if (btn) btn.disabled = true;
      $('#sent').innerHTML = '<div class="notice">⏳ Создаём чат по заявке…</div>';
      startOrder({ to, text, lead, title: `${KINDS[p.kind].title}${d.what ? ': ' + d.what : ''}`, providerName: p.name, demo: IS_DEMO })
        .then((r) => { location.href = r.chatUrl + '&new=1'; })
        .catch((er) => { if (btn) btn.disabled = false; $('#sent').innerHTML = ''; toast(er.message, true); });
      return;
    }
    const link = sendLink(to, text);
    window.open(link, '_blank', 'noopener'); // открываем сразу — по нажатию, чтобы браузер не заблокировал окно
    $('#sent').innerHTML = `<div class="notice">✅ Открываем ${PRIMARY.label}… Если не открылся — <a class="btn sm wa" id="waAgain" target="_blank" rel="noopener" href="${esc(link)}">${PRIMARY.icon} открыть ещё раз</a></div>`;
    if (caps.v4) api.createLead(lead)
      .then((n) => { $('#sent').insertAdjacentHTML('beforeend', `<p class="small muted">Заявка №${n} сохранена у исполнителя.</p>`); }).catch(() => {});
  };
}
async function showQr(p, url) {
  const d = document.createElement('div'); d.className = 'lightbox qr-modal'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'QR-код визитки');
  d.innerHTML = `<div class="card center" style="max-width:360px"><h3>QR этой визитки</h3><p class="small muted">Покажите клиенту — он наведёт камеру и откроет визитку.</p><div class="qrbox big">${await qrSvg(url, { size: 260 })}</div>
    <p class="small mono">${esc(url)}</p><div class="row" style="justify-content:center"><button class="p" id="qrPng">⬇️ Скачать PNG</button><button id="qrCopy">Копировать ссылку</button><button id="qrX">Закрыть</button></div></div>`;
  document.body.appendChild(d);
  d.onclick = (e) => { if (e.target === d) d.remove(); };
  $('#qrX', d).onclick = () => d.remove();
  $('#qrCopy', d).onclick = () => { navigator.clipboard?.writeText(url); toast('Ссылка скопирована'); };
  $('#qrPng', d).onclick = async () => download(`vizitka-${p.id}.png`, await qrPng(url, { title: p.name, sub: CARD_ROLE[p.kind] }));
}
main();
