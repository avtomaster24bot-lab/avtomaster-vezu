// Чат по заказу: order.html?id=N&t=<секрет клиента> — клиент (даже без входа) и владелец организации переписываются на сайте.
// Цикл: новая → уточнение → цена согласована → в работе → выполнено → оплачено → оценено → закрыт.
// После закрытия (оплата + оценка) переписка удаляется через CHAT_PURGE_DAYS дня, итог заказа, цена и отзыв остаются.
import { CONFIG } from './config.js';
import { api, IS_DEMO, FORCED_DEMO, leaveDemo } from './api.js';
import { KINDS, LEAD_STATUS, ORDER_STEPS, CHAT_PURGE_DAYS } from './consts.js';
import { money, fmtPhone } from './region.js';
import { PRIMARY, sendLink, ownerContact } from './messaging.js';
import { cardUrl } from './cardkit.js';
import { orderUrl, ownerOrderUrl, myOrders, rememberOrder } from './orders.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = (m, err) => { const t = $('#toast'); t.textContent = m; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 3500); };
const tm = (d) => new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const day = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const linkify = (t) => esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');

const Q = new URLSearchParams(location.search);
const ID = +Q.get('id');
const AS_OWNER = Q.get('as') === 'owner';
let TOKEN = AS_OWNER ? '' : Q.get('t') || '';
if (!TOKEN && ID && !AS_OWNER) TOKEN = myOrders().find((x) => x.id === ID && !!x.demo === IS_DEMO)?.token || '';
const lastWa = () => { try { return sessionStorage.getItem('am24v-last-wa-' + ID) || ''; } catch { return ''; } };
const S = { o: null, msgs: [], last: 0, caps: {}, unsub: null, poll: null };

function chrome() {
  const b = $('#themeBtn'); const set = (t, save) => { document.documentElement.dataset.theme = t; b.textContent = t === 'light' ? '🌙' : '☀️'; if (save) localStorage.setItem('am24v-theme', t); };
  set(document.documentElement.dataset.theme || 'dark'); b.onclick = () => set(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true);
  if (IS_DEMO) { const bar = $('#demoBar'); bar.hidden = false;
    const mineTok = myOrders().find((x) => x.id === ID && x.demo)?.token;
    bar.innerHTML = `<b>ДЕМО</b><span>переписка хранится только в этом браузере; чужой исполнитель отвечает автоматически.</span>${ID ? `${mineTok ? '<button data-as="client">👤 Глазами клиента</button>' : ''}<button data-as="owner">🔧 Глазами исполнителя</button>` : ''}${FORCED_DEMO ? '<button data-leave>Выйти из демо</button>' : ''}`;
    $$('[data-as]', bar).forEach((x) => x.onclick = async () => {
      if (x.dataset.as === 'owner') { await api.loginDemo('master'); location.href = `order.html?id=${ID}&as=owner`; } else location.href = orderUrl(ID, mineTok); });
    const lv = $('[data-leave]', bar); if (lv) lv.onclick = () => { leaveDemo(); location.href = './'; }; }
}

// ---------- список «Мои заказы» (без id) ----------
function list() {
  const L = myOrders().filter((x) => !!x.demo === IS_DEMO);
  $('#order').innerHTML = `<h1>💬 Мои заказы</h1><p class="muted">Заявки и заказы, которые вы отправили с визиток и витрин с этого устройства. По ссылке переписка открывается без входа.</p>
    ${L.map((x) => `<a class="card lead oc-li" href="${esc(orderUrl(x.id, x.token))}"><b>№${x.id} · ${esc(x.title || 'Заявка')}</b><span class="small muted">${esc(x.provider || 'Диспетчер')} · ${tm(x.created_at)}</span></a>`).join('')
      || '<div class="empty"><div class="empty-i">💬</div><p><b>Пока нет заказов на этом устройстве</b></p><p class="small muted">Откройте визитку мастера или магазина и нажмите «Написать здесь, на сайте» — заказ и переписка появятся тут. Регистрация не нужна.</p><div class="row center"><a class="btn p" href="./#/catalog/sto">Найти исполнителя</a></div></div>'}`;
}

// ---------- шкала статуса ----------
function steps(o) {
  if (o.status === 'cancelled') return `<div class="oc-steps"><span class="on bad">✕ Заказ отменён</span></div>`;
  const order = ['new', 'clarify', 'agreed', 'in_work', 'done', 'paid', 'closed'];
  let k = order.indexOf(o.status); if (o.status === 'closed') k = order.length;
  const reached = (s) => s === 'rated' ? !!o.rating : order.indexOf(s) <= k && !(s === 'agreed' && !o.agreed_price && k < order.indexOf('in_work'));
  return `<ol class="oc-steps" aria-label="Статус заказа">${ORDER_STEPS.map(([s, t]) => `<li class="${reached(s) ? 'on' : ''} ${s === o.status ? 'cur' : ''}">${esc(t)}</li>`).join('')}</ol>`;
}

function head(o) {
  const p = o.provider, me = o.role, k = KINDS[o.payload?.service || p?.kind];
  const other = me === 'owner' ? `👤 ${esc(o.customer_name || 'Клиент')}${o.customer_phone ? ' · ' + esc(fmtPhone(o.customer_phone)) : ''}` : p ? `<a href="${esc(cardUrl(p.id))}">${k?.icon || '🏢'} ${esc(p.name)}</a>${p.rating ? ` · ★ ${Number(p.rating).toFixed(1)}` : ''}` : '📢 Диспетчер сервиса';
  const [st, c] = LEAD_STATUS[o.status] || [o.status, 'grey'];
  return `<div class="card oc-head"><div class="row between"><h1>${o.kind === 'order' ? '🛍 Заказ' : '📝 Заявка'} №${o.id}</h1><span class="badge ${c}">${esc(st)}</span></div>
    <div class="small">${other}</div>${steps(o)}
    <details class="oc-sum"><summary>Что заказано${o.agreed_price ? ` · согласовано <b>${money(o.agreed_price)}</b>` : o.total ? ` · ${money(o.total)}` : ''}</summary><pre class="msgtext">${esc(o.message)}</pre></details></div>`;
}

function bubble(m, o) {
  if (m.author === 'system') return `<div class="oc-sys" data-mid="${m.id}">${linkify(m.body)}<small>${tm(m.created_at)}</small></div>`;
  const mine = m.author === (o.role === 'owner' ? 'owner' : 'client');
  const who = m.author === 'owner' ? (o.provider?.name || 'Исполнитель') : (o.customer_name || 'Клиент');
  const offer = m.offer_price ? `<div class="oc-offer ${m.offer_state}"><span>Предложение цены</span><b>${money(m.offer_price)}</b>
      ${m.offer_state === 'open' && o.role === 'client' && !o.closed_at ? `<button class="p sm" data-accept="${m.id}">✅ Принять цену</button>` : `<small>${{ open: 'ждёт ответа клиента', accepted: '✅ принята', declined: 'отклонена', expired: 'заменена новым предложением' }[m.offer_state] || ''}</small>`}</div>` : '';
  return `<div class="oc-msg ${mine ? 'me' : 'them'}" data-mid="${m.id}"><div class="oc-who">${esc(mine ? 'Вы' : who)}</div>
    ${m.photo ? `<a href="${esc(m.photo)}" target="_blank" rel="noopener"><img class="oc-ph" src="${esc(m.photo)}" alt="Фото в чате"></a>` : ''}${m.body ? `<div>${linkify(m.body)}</div>` : ''}${offer}<small>${tm(m.created_at)}</small></div>`;
}

function actions(o) {
  if (o.closed_at) return '';
  const b = (st, t, c = '') => `<button class="sm ${c}" data-st="${st}">${t}</button>`;
  if (o.role === 'owner') {
    const A = { new: [b('in_work', '🔧 Взять в работу', 'p')], clarify: [b('in_work', '🔧 Взять в работу', 'p')], agreed: [b('in_work', '🔧 Взять в работу', 'p')],
      in_work: [b('done', '🏁 Выполнено', 'p')], done: [b('paid', '💰 Оплата получена', 'p')], paid: [] }[o.status] || [];
    if (['agreed', 'in_work'].includes(o.status)) A.push(b('paid', '💰 Оплата получена'));
    if (!['paid'].includes(o.status)) A.push(b('cancelled', 'Отменить', 'ghost'));
    return `<div class="row oc-acts">${A.join('')}${o.status === 'paid' && !o.rating ? '<span class="small muted">Ждём оценку клиента — после неё заказ закроется.</span>' : ''}</div>`;
  }
  const A = [];
  if (['new', 'clarify', 'agreed'].includes(o.status)) A.push(b('cancelled', 'Отменить заказ', 'ghost'));
  if (['agreed', 'in_work', 'done'].includes(o.status)) A.push('<button class="sm" data-paid>💳 Я оплатил(а)</button>');
  return A.length ? `<div class="row oc-acts">${A.join('')}</div>` : '';
}

function rateBox(o) {
  if (o.role !== 'client' || o.rating || !['done', 'paid'].includes(o.status)) return '';
  return `<form class="card oc-rate" id="rateF"><h3>⭐ Оцените работу</h3><div class="stars-in" role="radiogroup" aria-label="Оценка">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="r" value="${n}" ${n === 5 ? 'checked' : ''}><span>★</span></label>`).join('')}</div>
    <textarea name="review" rows="2" maxlength="1000" placeholder="Что понравилось? (видно на визитке исполнителя)"></textarea><button class="p">Отправить оценку</button>
    <p class="small muted">Оценка попадёт в рейтинг визитки. ${o.status === 'paid' ? 'После неё заказ закроется.' : 'Заказ закроется, когда исполнитель отметит оплату.'}</p></form>`;
}

function footer(o) {
  if (o.chat_purged_at) return `<div class="card oc-closed"><b>🗑 Переписка удалена ${day(o.chat_purged_at)}</b><p class="small muted">Итог заказа сохранён: ${o.agreed_price ? 'цена ' + money(o.agreed_price) + ', ' : ''}${o.rating ? 'оценка ' + '★'.repeat(o.rating) + (o.review ? ` — «${esc(o.review)}»` : '') : 'без оценки'}.</p></div>`;
  if (o.closed_at) {
    const del = new Date(new Date(o.closed_at).getTime() + CHAT_PURGE_DAYS * 864e5);
    return `<div class="card oc-closed"><b>🔒 Заказ ${o.status === 'cancelled' ? 'отменён' : 'закрыт'} ${day(o.closed_at)}</b><p class="small muted">Переписка будет удалена ${day(del)}. Итог заказа${o.agreed_price ? ', цена ' + money(o.agreed_price) : ''}${o.rating ? ' и отзыв ' + '★'.repeat(o.rating) : ''} сохранятся.</p>
      ${IS_DEMO ? '<button class="sm" id="timeTravel">⏩ Демо: перемотать на 4 дня вперёд</button>' : ''}</div>`;
  }
  const owner = o.role === 'owner';
  return `<form class="oc-compose" id="msgF"><div class="row oc-tools"><label class="btn sm" title="Фото"><input type="file" accept="image/*" id="phIn" hidden>📷 Фото</label>
      ${owner ? `<input name="offer_price" type="number" min="1" step="1" inputmode="numeric" placeholder="💰 Цена, ${esc(money(0).replace(/[\d\s]/g, '') || '₸')}" class="oc-price">` : ''}<span class="small muted" id="phName"></span></div>
    <div class="row"><textarea name="body" rows="2" maxlength="2000" placeholder="${owner ? 'Ответ клиенту: уточните детали или предложите цену' : 'Напишите исполнителю: детали, вопросы, фото'}" class="grow"></textarea><button class="p" aria-label="Отправить">➤</button></div></form>
    ${owner ? '<p class="hint small">💡 Чтобы предложить цену, впишите сумму в поле «Цена» и отправьте — у клиента появится кнопка «Принять». Новая цена заменяет прежнюю.</p>' : '<p class="hint small">💡 Спросите о цене и сроках. Когда исполнитель предложит цену, нажмите «Принять» — она зафиксируется в заказе.</p>'}
    <p class="small muted oc-note">🔒 Переписка хранится на сайте до закрытия заказа и удаляется через ${CHAT_PURGE_DAYS} дня после оплаты и оценки. Итог заказа, цена и отзыв сохраняются.</p>`;
}

function waBox(o) {
  // WhatsApp — уведомление/запасной канал; в каждом сообщении — ссылка на этот чат
  if (o.role === 'owner') {
    if (!o.customer_phone) return '';
    const text = `Здравствуйте${o.customer_name ? ', ' + o.customer_name : ''}! Это ${o.provider?.name || CONFIG.SITE_NAME}. Ответил(а) вам в чате по заявке №${o.id} на сайте:\n${orderUrl(o.id)}&c=1\n(откройте ссылку и подтвердите свой номер телефона)`;
    return `<a class="btn sm wa" target="_blank" rel="noopener" href="${esc(sendLink(o.customer_phone, text))}">${PRIMARY.icon} Сообщить клиенту в ${PRIMARY.label}</a>`;
  }
  const to = o.provider ? ownerContact(o.provider) : CONFIG.DISPATCH_WHATSAPP;
  if (!to) return '';
  const text = `Здравствуйте! Написал(а) вам в чате по заявке №${o.id} на ${CONFIG.SITE_NAME}:\n${ownerOrderUrl(o.id)}`;
  return `<a class="btn sm wa" id="waNotify" target="_blank" rel="noopener" href="${esc(sendLink(to, text))}">${PRIMARY.icon} Напомнить в ${PRIMARY.label}</a>`;
}

function render() {
  const o = S.o, fresh = Q.get('new') === '1' && o.role === 'client';
  $('#order').innerHTML = `${fresh ? `<div class="notice ok oc-new"><b>✅ Заявка отправлена</b><br>${PRIMARY.label} исполнителя открывается в новой вкладке — там готовое сообщение со ссылкой на этот чат, останется нажать «Отправить». Дальше переписка идёт здесь, на сайте.
      <div class="row" style="margin-top:8px">${lastWa() ? `<a class="btn sm wa" target="_blank" rel="noopener" href="${esc(lastWa())}">${PRIMARY.icon} Не открылся? Открыть ${PRIMARY.label}</a>` : ''}<button class="sm" id="copyLink">🔗 Скопировать ссылку на чат</button></div>
      <p class="small muted">Сохраните ссылку — по ней вы вернётесь в переписку без входа.</p></div>` : ''}
    ${head(o)}
    <div class="row between oc-bar">${actions(o) || '<span></span>'}<div class="row">${waBox(o)}<button class="sm ghost" id="notifBtn" ${'Notification' in window && Notification.permission !== 'granted' ? '' : 'hidden'}>🔔 Уведомления</button></div></div>
    <section class="oc-chat" id="chat" aria-live="polite">${S.msgs.map((m) => bubble(m, o)).join('') || (o.chat_purged_at ? '' : '<p class="muted center">Сообщений пока нет.</p>')}</section>
    ${rateBox(o)}${footer(o)}`;
  bind(); const c = $('#chat'); c.scrollTop = c.scrollHeight;
}

let photo = null;
async function shrink(file) {
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); });
  let w = img.naturalWidth, h = img.naturalHeight; const k = Math.min(1, 1024 / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
  const cv = Object.assign(document.createElement('canvas'), { width: w, height: h }); cv.getContext('2d').drawImage(img, 0, 0, w, h);
  for (const q of [0.72, 0.6, 0.45, 0.35]) { const u = cv.toDataURL('image/jpeg', q); if (u.length < 380000) return u; }
  throw new Error('Фото слишком большое');
}
const act = async (fn, ok) => { try { await fn(); if (ok) toast(ok); document.activeElement?.blur?.(); await refresh(true); } catch (e) { toast(e.message, true); } };
function bind() {
  const o = S.o;
  const cl = $('#copyLink'); if (cl) cl.onclick = () => { navigator.clipboard?.writeText(orderUrl(o.id, TOKEN)); toast('Ссылка на чат скопирована'); };
  const nb = $('#notifBtn'); if (nb) nb.onclick = async () => { const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Уведомления включены' : 'Уведомления не разрешены', r !== 'granted'); nb.hidden = r === 'granted'; };
  $$('[data-st]').forEach((b) => b.onclick = () => { if (b.dataset.st === 'cancelled' && !confirm('Отменить заказ?')) return; act(() => api.setOrderStatus(o.id, TOKEN, b.dataset.st), 'Статус обновлён'); });
  $$('[data-accept]').forEach((b) => b.onclick = () => act(() => api.acceptOffer(o.id, TOKEN, +b.dataset.accept), 'Цена согласована'));
  const pd = $('[data-paid]'); if (pd) pd.onclick = () => act(() => api.sendOrderMessage(o.id, TOKEN, { body: '💳 Я оплатил(а). Подтвердите, пожалуйста, получение оплаты.' }), 'Исполнитель увидит сообщение');
  const tt = $('#timeTravel'); if (tt) tt.onclick = () => act(() => api.demoTimeTravel(o.id), 'Прошло 4 дня (демо)');
  const si = $('.stars-in'); if (si) { const paint = () => { const r = +($('input:checked', si)?.value || 0); $$('label', si).forEach((l, i) => l.classList.toggle('on', i < r)); }; si.onchange = paint; paint(); }
  const rf = $('#rateF'); if (rf) rf.onsubmit = (e) => { e.preventDefault(); const d = new FormData(rf); act(() => api.rateOrder(o.id, TOKEN, +d.get('r'), d.get('review') || ''), 'Спасибо за оценку!'); };
  const f = $('#msgF'); if (!f) return;
  $('#phIn').onchange = async (e) => { const file = e.target.files[0]; if (!file) return; try { photo = await shrink(file); $('#phName').textContent = '📎 ' + file.name; } catch (er) { toast(er.message, true); } };
  f.body.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer:fine)').matches) { e.preventDefault(); f.requestSubmit(); } };
  f.onsubmit = (e) => {
    e.preventDefault(); const body = f.body.value.trim(), price = f.offer_price?.value;
    if (!body && !photo && !price) return;
    const btn = $('button.p', f); btn.disabled = true;
    act(async () => { await api.sendOrderMessage(o.id, TOKEN, { body, photo, offer_price: price ? +price : null }); f.reset(); photo = null; }).finally(() => { btn.disabled = false; });
  };
}

function notify(m) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
  try { new Notification(`Новое сообщение · заявка №${S.o.id}`, { body: m.offer_price ? `Предложение цены: ${money(m.offer_price)}` : (m.body || 'Фото').slice(0, 120), icon: 'assets/icon-192.png', tag: 'am24v-order-' + S.o.id }); } catch { /* ignore */ }
}

async function refresh(full) {
  const M = await api.orderMessages(ID, TOKEN, full ? 0 : S.last); const o = await api.getOrder(ID, TOKEN); // сначала сообщения (отмечают «прочитано»), затем статус
  const fresh = full ? M : M.filter((m) => m.id > S.last);
  const mine = o.role === 'owner' ? 'owner' : 'client';
  if (!full && S.last) fresh.filter((m) => m.author !== mine && m.author !== 'system').forEach(notify);
  const changed = full || fresh.length || o.status !== S.o?.status || o.rating !== S.o?.rating || o.chat_purged_at !== S.o?.chat_purged_at;
  S.o = o; S.msgs = full ? M : S.msgs.concat(fresh); S.last = S.msgs.length ? S.msgs[S.msgs.length - 1].id : 0;
  if (o.chat_purged_at) S.msgs = [];
  if (changed && !document.activeElement?.closest('#msgF, #rateF')) render();
  else if (changed) { const c = $('#chat'); if (c) { c.innerHTML = S.msgs.map((m) => bubble(m, o)).join(''); c.scrollTop = c.scrollHeight; bindOffers(); } }
}
function bindOffers() { $$('[data-accept]').forEach((b) => b.onclick = () => act(() => api.acceptOffer(S.o.id, TOKEN, +b.dataset.accept), 'Цена согласована')); }

async function claim() {
  $('#order').innerHTML = `<div class="card center" style="max-width:420px;margin:24px auto"><div class="big-i">💬</div><h2>Чат по заявке №${ID}</h2>
    <p class="muted">Чтобы открыть переписку, подтвердите номер телефона, который вы указали в заявке. Исполнитель может открыть чат через «Вход».</p>
    <form id="claimF"><input name="phone" type="tel" required autocomplete="tel" placeholder="+7 7XX XXX XX XX"><button class="p block" style="margin-top:8px">Открыть чат</button></form>
    <p class="small"><a href="./#/login">Я исполнитель — войти</a></p></div>`;
  $('#claimF').onsubmit = async (e) => {
    e.preventDefault();
    try { const t = await api.claimOrder(ID, e.target.phone.value); if (!t) return toast('Телефон не совпадает с указанным в заявке', true);
      TOKEN = t; rememberOrder({ id: ID, token: t, title: 'Заявка', provider: '', created_at: new Date().toISOString(), demo: IS_DEMO });
      history.replaceState(null, '', orderUrl(ID, t)); start(); } catch (er) { toast(er.message, true); }
  };
}

async function start() {
  try { await refresh(true); }
  catch (e) {
    if (AS_OWNER) { $('#order').innerHTML = `<div class="card center" style="max-width:420px;margin:24px auto"><div class="big-i">🔧</div><h2>Чат по заявке №${ID}</h2><p class="muted">Это ссылка для исполнителя. Войдите через Telegram тем аккаунтом, к которому привязана визитка, — заявка откроется в Кабинете → «📲 Заявки и чаты».</p><a class="btn p" href="./#/login">Войти</a></div>`; return; }
    if (!TOKEN && /не найден/i.test(e.message)) return claim();
    $('#order').innerHTML = `<div class="card center"><div class="big-i">🤷</div><h2>Заказ не найден</h2><p class="muted">${esc(e.message)}. Ссылка неполная, или переписка доступна только участникам.</p><a class="btn p" href="order.html">Мои заказы</a></div>`; return;
  }
  if (S.o.role === 'client' && TOKEN) rememberOrder({ id: S.o.id, token: TOKEN, title: (S.o.message || '').split('\n').find((l) => /\*/.test(l))?.replace(/.*\*(.+)\*.*/, '$1') || 'Заявка', provider: S.o.provider?.name || 'Диспетчер', created_at: S.o.created_at, demo: IS_DEMO });
  S.unsub?.(); S.unsub = api.subscribeOrder(S.o, () => refresh(false).catch(() => {}));
  clearInterval(S.poll); S.poll = setInterval(() => { if (!document.hidden || ('Notification' in window && Notification.permission === 'granted')) refresh(false).catch(() => {}); }, IS_DEMO ? 2500 : 6000);
}

(async () => {
  chrome();
  S.caps = await api.caps().catch(() => ({}));
  if (!S.caps.v5) { $('#order').innerHTML = `<div class="card center"><div class="big-i">🛠</div><h2>Чат по заказам скоро заработает</h2><p class="muted">Пока заявки уходят исполнителю в ${PRIMARY.label}. Посмотреть, как работает чат, можно <a href="order.html?demo=1">в демо</a>.</p></div>`; return; }
  if (!ID) return list();
  start();
})();
