// ДЕМО-бэкенд: та же логика, что в функциях Supabase (supabase/01_schema.sql), но данные хранятся
// только в этом браузере (localStorage). Все люди и организации здесь — вымышленные.
import { SEED } from './seed.js';
import { CONFIG } from './config.js';
// Все телефоны в демо — один несуществующий номер-пример (CONFIG.EXAMPLE_PHONE): кнопки с ним никуда не звонят и не пишут.
const EX_PHONE = '+' + String(CONFIG.EXAMPLE_PHONE || '70000000000').replace(/\D/g, '');

// v6: демо-данные пересозданы без похожих на настоящие номеров; старую копию (v5) удаляем
try { localStorage.removeItem('am24v-demo-db-v5'); } catch { /* ignore */ }
const KEY = 'am24v-demo-db-v6', UKEY = 'am24v-demo-user', PKEY = 'am24v-demo-photos';
const now = () => new Date().toISOString();
const tok = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()) + Date.now()).replace(/[^a-z0-9]/gi, '').slice(0, 32);
const plus = (min) => new Date(Date.now() + min * 60000).toISOString();
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const C = 'Талдыкорган';

function initial() {
  const P = (id, kind, name, extra = {}) => ({ id, kind, owner_id: null, name, city: C, address: '', phone: EX_PHONE,
    working_hours: '09:00-19:00', specs: [], supplier_type: null, service_type: null, boxes: 1, slot_minutes: 60, delivery: false,
    rating: 0, reviews_count: 0, is_active: true, created_at: ago(9000), about: '', photos: [], whatsapp: '', verified: false, card: {}, store_url: '', shop_enabled: false, ...extra });
  const providers = [
    P(1, 'sto', 'Демо-СТО «Мотор»', { owner_id: 'u-master', address: 'ул. Примерная, 1', specs: [1, 2, 7, 8, 9], rating: 4.8, reviews_count: 12, verified: true, whatsapp: EX_PHONE,
      about: 'Ремонт двигателя, ходовой и компьютерная диагностика. 4 подъёмника, гарантия на работы 6 месяцев. Можно подождать в зоне отдыха с Wi‑Fi.', photos: ['assets/img/sto.webp', 'assets/img/master.webp'],
      card: { slogan: 'Честный ремонт с гарантией 6 месяцев', services: [{ name: 'Компьютерная диагностика', price: 5000 }, { name: 'Замена масла', price: 4000 }, { name: 'Ремонт ходовой', price: 'от 8000' }, { name: 'Развал-схождение 3D', price: 7000 }], tg: 'demo_motor', payments: ['kaspi', 'cash', 'card'] } }),
    P(2, 'sto', 'Демо-СТО «Ходовая+»', { address: 'ул. Примерная, 15', specs: [2, 5, 11], rating: 4.5, reviews_count: 7, about: 'Подвеска, рулевое, развал-схождение 3D.' }),
    P(3, 'sto', 'Демо-СТО «Автоэлектрик»', { address: 'пр. Демо, 8', specs: [3, 15], rating: 4.2, reviews_count: 3 }),
    P(4, 'tow', 'Демо-эвакуатор «Быстрый»', { owner_id: 'u-master', rating: 4.9, reviews_count: 20, working_hours: 'Круглосуточно', verified: true, whatsapp: EX_PHONE, about: 'Ломаная платформа, город и межгород. Подача 20–40 минут.', photos: ['assets/img/tow.webp'],
      card: { slogan: 'Подача за 20–40 минут, 24/7', services: [{ name: 'Эвакуация по городу', price: 12000 }, { name: 'Межгород', price: '250 ₸/км' }, { name: 'Спецтехника', price: 'договорная' }], payments: ['kaspi', 'cash'] } }),
    P(5, 'tow', 'Демо-эвакуатор «Сокол»', { rating: 4.4, reviews_count: 5, working_hours: 'Круглосуточно' }),
    P(6, 'wash', 'Демо-мойка «Блеск»', { owner_id: 'u-master', address: 'ул. Чистая, 3', boxes: 3, slot_minutes: 30, working_hours: '08:00-22:00', rating: 4.7, reviews_count: 15, verified: true, photos: ['assets/img/wash.webp'], about: 'Три бокса, бесконтактная и ручная мойка, химчистка.', whatsapp: EX_PHONE,
      card: { services: [{ name: 'Кузов', price: 2500 }, { name: 'Комплекс', price: 5000 }, { name: 'Химчистка салона', price: 25000 }], payments: ['kaspi', 'cash'] } }),
    P(7, 'wash', 'Демо-мойка «Аква»', { address: 'ул. Водная, 9', boxes: 2, working_hours: '09:00-21:00', rating: 4.3, reviews_count: 4 }),
    P(8, 'parts', 'Демо-магазин «Запчасть»', { owner_id: 'u-master', supplier_type: 'shop', delivery: true, rating: 4.6, reviews_count: 9, photos: ['assets/img/parts.webp'], whatsapp: EX_PHONE,
      address: 'ул. Магазинная, 5', about: 'Масла, фильтры, тормоза, свет и аккумуляторы. Подбор по VIN, доставка по городу.', shop_enabled: true,
      card: { slogan: 'Подбор по VIN за 5 минут', services: [{ name: 'Подбор по VIN', price: 'бесплатно' }, { name: 'Доставка по городу', price: 1000 }], payments: ['kaspi', 'cash', 'card'], shop_title: 'Запчасть — интернет-магазин', shop_accent: '#E8B84B' } }),
    P(9, 'parts', 'Демо-авторазбор «Японец»', { supplier_type: 'razborka', rating: 4.1, reviews_count: 6, whatsapp: EX_PHONE, store_url: 'https://biznes-shablon.vercel.app/catalog',
      about: 'Б/у запчасти на японские авто. Свой интернет-магазин на «Учёт + Магазин» — кнопка «Магазин» ведёт туда.' }),
    P(10, 'urgent', 'Демо-мастер «Замки 24»', { owner_id: 'u-master', service_type: 'locksmith', working_hours: 'Круглосуточно', rating: 5, reviews_count: 8, photos: ['assets/img/help.webp'], whatsapp: EX_PHONE,
      card: { services: [{ name: 'Вскрытие авто', price: 'от 7000' }, { name: 'Изготовление ключа', price: 'от 15000' }] } }),
    P(11, 'urgent', 'Демо-шиномонтаж на выезде', { service_type: 'tire', rating: 4.5, reviews_count: 4 }),
    P(12, 'urgent', 'Демо-электрик на выезде', { service_type: 'electrician', rating: 4.0, reviews_count: 2 }),
    P(13, 'sto', 'Демо-СТО «Алматы Сервис»', { city: 'Алматы', specs: [], rating: 4.6, reviews_count: 30 }),
    P(14, 'cargo', 'Демо-перевозчик «Газель 24»', { owner_id: 'u-master', working_hours: '08:00-22:00', rating: 4.9, reviews_count: 14, verified: true, whatsapp: EX_PHONE,
      photos: ['assets/img/cargo/v-gazel.webp'], about: 'Газель с тентом, аккуратно перевезём мебель и технику. Есть грузчики.',
      card: { slogan: 'Переезды и мебель — быстро и бережно', cargo: { vehicle: 'gazel', extras: ['Грузчики', 'Тент', 'Ремни'], price: 6000, unit: 'час' }, zones: 'Весь город и пригороды', services: [{ name: 'Переезд квартиры', price: 'от 15000' }, { name: 'Грузчик', price: '3000/час' }], payments: ['kaspi', 'cash'] } }),
    P(15, 'cargo', 'Демо-грузовик «Три тонны»', { working_hours: 'Круглосуточно', rating: 4.6, reviews_count: 6, whatsapp: EX_PHONE, photos: ['assets/img/cargo/v-truck3.webp'],
      card: { cargo: { vehicle: 'truck3', extras: ['Тент'], price: 9000, unit: 'час' }, zones: 'Город и межгород', services: [{ name: 'Стройматериалы', price: 'от 12000' }] } }),
    P(16, 'cargo', 'Демо-каблук «Мелкий груз»', { working_hours: '09:00-20:00', rating: 4.3, reviews_count: 3, whatsapp: EX_PHONE, photos: ['assets/img/cargo/v-kabluk.webp'],
      card: { cargo: { vehicle: 'kabluk', extras: [], price: 4000, unit: 'час' }, zones: 'По городу' } }),
  ];
  const profiles = {
    'u-client': { id: 'u-client', username: 'demo_client', full_name: 'Демо Клиент', phone: EX_PHONE, city: C, role: 'client', consent: true },
    'u-master': { id: 'u-master', username: 'demo_master', full_name: 'Демо Мастер', phone: EX_PHONE, city: C, role: 'client', consent: true },
    'u-admin': { id: 'u-admin', username: 'demo_admin', full_name: 'Демо Админ', phone: EX_PHONE, city: C, role: 'global_admin', consent: true },
    'u-other': { id: 'u-other', username: null, full_name: 'Другой клиент (демо)', phone: EX_PHONE, city: C, role: 'client', consent: true },
    'u-city': { id: 'u-city', username: 'demo_almaty', full_name: 'Демо Админ Алматы', phone: EX_PHONE, city: 'Алматы', role: 'regional_admin', managed_city: 'Алматы', consent: true },
  };
  const R = (id, type, extra) => ({ id, type, user_id: 'u-other', city: C, status: 'new', category_id: null, subcategory: null, service_type: null,
    supplier_type: null, target_provider_id: null, description: '', vehicle_info: '', details: {}, desired_time: null, assigned_time: null,
    price: null, accepted_by: null, accepted_offer_id: null, final_amount: null, expires_at: plus(55), created_at: ago(5), updated_at: ago(5), ...extra });
  const requests = [
    R(1, 'sto', { category_id: 2, subcategory: 'Замена амортизаторов', description: 'Стук спереди справа на кочках', vehicle_info: 'Toyota Camry 2014' }),
    R(2, 'tow', { description: 'Не заводится, нужно отвезти на СТО', vehicle_info: 'Hyundai Solaris', details: { vehicle: 'Легковой автомобиль', wheels: 'Колёса крутятся', location: 'ул. Демо, 10 (у ТЦ)' } }),
    R(3, 'parts', { supplier_type: 'shop', description: 'Фара передняя левая', vehicle_info: 'Kia Rio 2017', expires_at: plus(170), details: { urgency: 'В течение недели', original: 'Неважно', delivery: 'Заберу сам' } }),
    R(4, 'wash', { target_provider_id: 6, service_type: 'Комплексная мойка', details: { car_type: 'Внедорожник' }, desired_time: plus(180), expires_at: null }),
    R(5, 'sto', { user_id: 'u-client', category_id: 7, subcategory: 'Компьютерная диагностика', description: 'Горит Check Engine', vehicle_info: 'Toyota Corolla 2012',
      status: 'completed', accepted_by: 2, accepted_at: ago(3992), final_amount: 5000, created_at: ago(4000), updated_at: ago(3900), expires_at: ago(3940) }),
  ];
  const reviews = [
    { id: 1, user_id: 'u-other', provider_id: 1, request_id: null, rating: 5, comment: 'Быстро нашли причину стука, цена как договаривались.', is_published: true, created_at: ago(20000), reply: 'Спасибо! Ждём на плановое ТО.', reply_at: ago(19000) },
    { id: 2, user_id: 'u-other', provider_id: 4, request_id: null, rating: 5, comment: 'Приехал за 25 минут.', is_published: true, created_at: ago(15000) },
    { id: 3, user_id: 'u-other', provider_id: 2, request_id: null, rating: 4, comment: 'Хорошо, но пришлось подождать.', is_published: false, created_at: ago(100) },
  ];
  let pid = 1;
  const prices = SEED.ref_prices.map((p) => ({ id: pid++, provider_id: null, service: p.service, brand: p.brand, model: p.model, price: p.price, notes: 'Справочная цена', year_from: null, year_to: null }));
  for (const [svc, pr] of [['Замена масла', 4000], ['Компьютерная диагностика', 5000], ['Замена передних колодок', 4500], ['Развал-схождение', 7000], ['Замена ремня ГРМ', 25000]]) {
    prices.push({ id: pid++, provider_id: 1, service: svc, brand: '', model: '', price: pr, notes: '', year_from: null, year_to: null });
    prices.push({ id: pid++, provider_id: 2, service: svc, brand: '', model: '', price: Math.round(pr * 1.15 / 100) * 100, notes: '', year_from: null, year_to: null });
  }
  return { seq: 100, profiles, providers, requests, reviews, prices, offers: [], declines: [], messages: [], vehicles: [
    { id: 1, user_id: 'u-client', brand: 'Toyota', model: 'Corolla', year: 2012, plate: '123ABC05', engine_volume: '1.6' }],
    registrations: [{ id: 1, user_id: 'u-other', kind: 'sto', name: 'Демо-заявка: СТО «Новое»', phone: EX_PHONE, address: 'ул. Новая, 1', city: C, details: { specs: [1, 2] }, status: 'pending', created_at: ago(60) }],
    cities: SEED.cities.map((c) => ({ ...c })), products: demoProducts(), leads: [
      { id: 1, provider_id: 14, kind: 'cargo', source: 'card', customer_name: 'Айгерим', customer_phone: EX_PHONE, message: 'Переезд: Шевченко 10 → Абая 55, завтра в 10:00', payload: { what: 'Переезд' }, total: null, status: 'new', created_at: ago(30) },
      { id: 2, provider_id: 8, kind: 'order', source: 'shop', customer_name: 'Ерлан', customer_phone: EX_PHONE, message: 'Масло 5W-30 4 л × 1, Фильтр масляный × 1', payload: { items: [] }, total: 21400, status: 'in_work', created_at: ago(120) }].map((x) => ({ ...x, token: tok(), chan: tok(), last_msg_at: x.created_at, last_from: 'client' })),
    orderMsgs: [
      { id: 1, lead_id: 1, author: 'system', body: 'Заявка создана. Здесь можно уточнить детали и цену — переписка остаётся на сайте.', created_at: ago(30) },
      { id: 2, lead_id: 2, author: 'system', body: 'Заявка создана. Здесь можно уточнить детали и цену — переписка остаётся на сайте.', created_at: ago(120) },
      { id: 3, lead_id: 2, author: 'owner', body: 'Здравствуйте! Всё в наличии, соберём к 18:00.', created_at: ago(110) },
      { id: 4, lead_id: 2, author: 'system', body: 'Заказ в работе.', created_at: ago(109) }] };
}
function demoProducts() {
  const L = [['Моторное масло 5W-30, 4 л', 'Масла и жидкости', 18900, 12], ['Антифриз G12, 5 л', 'Масла и жидкости', 7900, 8], ['Тормозная жидкость DOT-4', 'Масла и жидкости', 2400, 20],
    ['Фильтр масляный', 'Фильтры', 2500, 30], ['Фильтр воздушный', 'Фильтры', 3900, 15], ['Фильтр салонный угольный', 'Фильтры', 4500, 2],
    ['Колодки передние', 'Тормоза', 12900, 6], ['Диск тормозной', 'Тормоза', 16500, 4], ['Лампа H4 +130%', 'Свет', 3500, 25], ['Фара передняя левая', 'Свет', 42000, 1],
    ['Аккумулятор 60 А·ч', 'Аккумуляторы', 39900, 5], ['Щётки стеклоочистителя, пара', 'Аксессуары', 5900, 10]];
  return L.map(([name, category, price, stock], i) => ({ id: i + 1, provider_id: 8, sku: 'SKU-' + String(i + 1).padStart(6, '0'), name, category, price, stock, photo: '', description: 'Демо-товар: название, цена и остаток вымышленные.', is_published: true, created_at: ago(1000 - i) }));
}

let db = null;
const load = () => { if (!db) { try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; } if (!db) { db = initial(); save(); } } return db; };
const save = () => localStorage.setItem(KEY, JSON.stringify(db));
const id = () => ++load().seq;
const uid = () => localStorage.getItem(UKEY);
const me = () => load().profiles[uid()] || null;
const fail = (m) => { throw new Error(m); };
const isAdmin = (city) => { const m = me(); return !!m && (m.role === 'global_admin' || (m.role === 'regional_admin' && (!city || m.managed_city === city))); };
const prov = (pid) => load().providers.find((p) => p.id === +pid);
const myProv = (pid) => { const p = prov(pid); if (!p || p.owner_id !== uid()) fail('Это не ваша организация'); if (!p.is_active) fail('Организация отключена администратором'); return p; };
const req = (rid) => load().requests.find((r) => r.id === +rid) || fail('Заявка не найдена');
const myReq = (rid) => { const r = req(rid); if (r.user_id !== uid()) fail('Заявка не найдена'); return r; };
const live = (r) => ['new', 'offers'].includes(r.status) && (!r.expires_at || new Date(r.expires_at) > new Date());
function matches(r, p) {
  return p.is_active && p.kind === r.type && p.city === r.city && (!r.target_provider_id || r.target_provider_id === p.id)
    && (r.type !== 'urgent' || !r.service_type || r.service_type === p.service_type)
    && (r.type !== 'parts' || !r.supplier_type || r.supplier_type === p.supplier_type)
    && (r.type !== 'sto' || !r.category_id || !p.specs.length || p.specs.includes(r.category_id) || r.target_provider_id === p.id);
}
const touch = (r, patch) => { const was = r.accepted_by; Object.assign(r, patch, { updated_at: now() }); if (!was && r.accepted_by && !r.accepted_at) r.accepted_at = now(); save(); };
const recalc = (pid) => { const rs = load().reviews.filter((x) => x.provider_id === pid); const p = prov(pid);
  p.reviews_count = rs.length; p.rating = rs.length ? Math.round(rs.reduce((s, x) => s + x.rating, 0) / rs.length * 100) / 100 : 0; };
export const stems = (q) => (q || '').toLowerCase().split(/[^a-zа-яё0-9]+/i).filter((w) => w.length > 1).map((w) => w.length > 4 ? w.slice(0, Math.max(4, w.length - 2)) : w);
const clone = (x) => JSON.parse(JSON.stringify(x));
const dlog = (action, target, city, details) => { const d = load(); d.adminLog = d.adminLog || []; d.adminLog.push({ id: d.adminLog.length + 1, actor_id: uid(), action, target_user: target, city, details, created_at: now() }); };

export const demo = {
  mode: 'demo',
  async ref() { return { ...SEED, cities: load().cities }; },
  async session() { return me() ? clone(me()) : null; },
  async loginDemo(role) { localStorage.setItem(UKEY, { client: 'u-client', master: 'u-master', admin: 'u-admin' }[role]); },
  async logout() { localStorage.removeItem(UKEY); },
  async resetDemo() { localStorage.removeItem(KEY); localStorage.removeItem(PKEY); db = null; load(); },
  async updateProfile({ full_name, phone, city, consent }) {
    const m = me() || fail('Войдите');
    const digits = (phone || '').replace(/\D/g, '');
    if (phone && !/^[78]\d{10}$/.test(digits)) fail('Телефон в формате +7 7XX XXX XX XX');
    Object.assign(m, { full_name: full_name || m.full_name, phone: phone ? '+7' + digits.slice(1) : null, city, consent: !!consent }); save(); return clone(m);
  },
  async deleteMyData() { const m = me(); m.phone = null; m.consent = false; save(); },

  async listProviders({ kind, city } = {}) {
    return clone(load().providers.filter((p) => p.is_active && (!kind || p.kind === kind) && (!city || p.city === city)).sort((a, b) => b.rating - a.rating));
  },
  async getProvider(pid) { return clone(prov(pid) || fail('Не найдено')); },
  async providerReviews(pid) { return clone(load().reviews.filter((x) => x.provider_id === +pid && (x.is_published || x.user_id === uid()))); },
  async myProviders() { return clone(load().providers.filter((p) => p.owner_id === uid())); },
  async updateProvider(pid, patch) {
    const p = prov(pid); if (!p || (p.owner_id !== uid() && !isAdmin(p.city))) fail('Нет прав');
    const allowed = ['name', 'address', 'phone', 'working_hours', 'specs', 'boxes', 'slot_minutes', 'delivery', 'supplier_type', 'service_type', 'about', 'photos', 'whatsapp', 'card', 'store_url', 'shop_enabled'];
    for (const k of Object.keys(patch)) if (allowed.includes(k) || isAdmin(p.city)) p[k] = patch[k];
    save(); return clone(p);
  },

  async createRequest(p) {
    const m = me() || fail('Войдите');
    if (!m.consent) fail('Нужно согласие на обработку персональных данных (Профиль)');
    if (!m.phone) fail('Укажите телефон в профиле — без него исполнитель не сможет связаться');
    const ttl = p.type === 'parts' ? 180 : p.type === 'wash' ? null : p.type === 'cargo' ? 120 : 60;
    const r = { id: id(), type: p.type, user_id: m.id, city: p.city || m.city, status: 'new', category_id: p.category_id ? +p.category_id : null,
      subcategory: p.subcategory || null, service_type: p.service_type || null, supplier_type: p.supplier_type || null,
      target_provider_id: p.target_provider_id ? +p.target_provider_id : null, description: p.description || '', vehicle_info: p.vehicle_info || '',
      details: p.details || {}, desired_time: p.desired_time || null, assigned_time: null, price: null, accepted_by: null, accepted_offer_id: null,
      final_amount: null, expires_at: ttl ? plus(ttl) : null, created_at: now(), updated_at: now() };
    load().requests.push(r); save();
    // в демо через 4 секунды «откликается» исполнитель, чтобы было видно весь путь
    setTimeout(() => demoAutoReply(r.id), 4000);
    return r.id;
  },
  async myRequests() { return clone(load().requests.filter((r) => r.user_id === uid()).sort((a, b) => b.id - a.id)); },
  async cancelRequest(rid) { const r = myReq(rid); if (['completed', 'cancelled'].includes(r.status)) fail('Заявку уже нельзя отменить'); touch(r, { status: 'cancelled' }); },
  async requestOffers(rid) {
    const r = myReq(rid);
    return load().offers.filter((o) => o.request_id === r.id).sort((a, b) => a.price - b.price).map((o) => { const p = prov(o.provider_id);
      return { id: o.id, price: o.price, comment: o.comment, is_selected: o.is_selected, created_at: o.created_at, provider_id: o.is_selected ? p.id : null,
        provider_name: o.is_selected ? p.name : 'Поставщик №' + p.id, provider_phone: o.is_selected ? p.phone : null,
        provider_address: o.is_selected ? p.address : null, provider_rating: p.rating, delivery: p.delivery }; });
  },
  async selectOffer(oid) {
    const o = load().offers.find((x) => x.id === +oid) || fail('Предложение не найдено'); const r = myReq(o.request_id);
    if (!['new', 'offers'].includes(r.status)) fail('Предложение уже выбрано');
    load().offers.filter((x) => x.request_id === r.id).forEach((x) => { x.is_selected = x.id === o.id; });
    touch(r, { status: 'active', accepted_by: o.provider_id, accepted_offer_id: o.id, final_amount: o.price });
    setTimeout(() => { const rr = req(r.id); if (rr.status === 'active' && prov(rr.accepted_by)?.owner_id !== 'u-master') touch(rr, { status: 'delivered' }); }, 6000);
  },
  async washApprove(rid) { const r = myReq(rid); if (r.status !== 'price_offered') fail('Мойка ещё не предложила цену и время'); touch(r, { status: 'client_approved', final_amount: r.price }); },
  async clientConfirm(rid) { const r = myReq(rid); if (!['active', 'delivered', 'waiting_client', 'in_progress'].includes(r.status)) fail('Нельзя завершить заявку в этом статусе'); touch(r, { status: 'completed' }); },
  async leaveReview(rid, rating, comment) {
    const r = myReq(rid); if (r.status !== 'completed' || !r.accepted_by) fail('Оценить можно только выполненную заявку');
    if (load().reviews.some((x) => x.request_id === r.id)) fail('Вы уже оценили эту заявку');
    load().reviews.push({ id: id(), user_id: uid(), provider_id: r.accepted_by, request_id: r.id, rating: +rating, comment: comment || '', is_published: !(comment || '').trim(), created_at: now() });
    recalc(r.accepted_by); save();
  },
  async myReviewFor(rid) { return clone(load().reviews.find((x) => x.request_id === +rid) || null); },

  async providerFeed(pid) {
    const p = myProv(pid); const dec = load().declines.filter((d) => d.provider_id === p.id).map((d) => d.request_id);
    return clone(load().requests.filter((r) => r.accepted_by === p.id || r.target_provider_id === p.id || (live(r) && matches(r, p) && !dec.includes(r.id))).sort((a, b) => b.id - a.id));
  },
  async myOffers(pid) { myProv(pid); return clone(load().offers.filter((o) => o.provider_id === +pid)); },
  async accept(rid, pid) {
    const p = myProv(pid); const r = req(rid);
    if (!matches(r, p)) fail('Заявка недоступна'); if (['parts', 'wash'].includes(r.type)) fail('Для этой заявки отправьте предложение');
    if (r.status !== 'new') fail('Заявку уже принял другой исполнитель'); if (!live(r)) fail('Срок заявки истёк');
    touch(r, { status: 'active', accepted_by: p.id });
  },
  async decline(rid, pid) { const p = myProv(pid); load().declines.push({ request_id: +rid, provider_id: p.id }); save(); },
  async complete(rid, pid, amount) {
    const p = myProv(pid); const r = req(rid); if (r.accepted_by !== p.id) fail('Заявка не ваша');
    if (r.type === 'parts') { if (r.status !== 'active') fail('Неверный статус'); touch(r, { status: 'delivered' }); }
    else { if (!['active', 'in_progress', 'waiting_client', 'client_approved'].includes(r.status)) fail('Неверный статус'); touch(r, { status: 'completed', final_amount: amount ? +amount : r.final_amount }); }
  },
  async makeOffer(rid, pid, price, comment) {
    const p = myProv(pid); const r = req(rid);
    if (r.type !== 'parts' || !matches(r, p)) fail('Заявка недоступна'); if (!live(r)) fail('Заявка уже закрыта'); if (!(+price > 0)) fail('Укажите цену');
    const ex = load().offers.find((o) => o.request_id === r.id && o.provider_id === p.id);
    if (ex) Object.assign(ex, { price: +price, comment: comment || '' }); else load().offers.push({ id: id(), request_id: r.id, provider_id: p.id, price: +price, comment: comment || '', is_selected: false, created_at: now() });
    if (r.status === 'new') r.status = 'offers'; touch(r, {});
  },
  async washQuote(rid, pid, price, time) {
    const p = myProv(pid); const r = req(rid);
    if (r.type !== 'wash' || !(matches(r, p) || r.accepted_by === p.id)) fail('Заявка недоступна');
    if (!['new', 'price_offered'].includes(r.status)) fail('Запись уже подтверждена');
    if (!(+price > 0) || !time) fail('Укажите цену и время');
    touch(r, { status: 'price_offered', accepted_by: p.id, price: +price, assigned_time: new Date(time).toISOString() });
  },
  async washStatus(rid, pid, st) {
    const p = myProv(pid); const r = req(rid); if (r.accepted_by !== p.id) fail('Заявка не ваша');
    const ok = (r.status === 'client_approved' && st === 'in_progress') || (r.status === 'in_progress' && st === 'waiting_client') || (['waiting_client', 'in_progress'].includes(r.status) && st === 'completed');
    if (!ok) fail('Неверный переход статуса'); touch(r, { status: st });
  },
  async clientContact(rid) {
    const r = req(rid); const p = prov(r.accepted_by);
    if (!((p && p.owner_id === uid()) || isAdmin(r.city))) fail('Контакт доступен после принятия заявки');
    if (r.type === 'wash' && ['new', 'price_offered'].includes(r.status) && !isAdmin(r.city)) fail('Контакт доступен после подтверждения клиентом');
    const c = load().profiles[r.user_id]; return { full_name: c.full_name, phone: c.phone, username: c.username };
  },

  async vehicles() { return clone(load().vehicles.filter((v) => v.user_id === uid())); },
  async addVehicle(v) { if (!uid()) fail('Войдите'); if (!v.brand) fail('Укажите марку'); load().vehicles.push({ ...v, id: id(), user_id: uid() }); save(); },
  async deleteVehicle(vid) { const d = load(); d.vehicles = d.vehicles.filter((v) => !(v.id === +vid && v.user_id === uid())); save(); },

  async searchPrices({ service, brand }) {
    const words = stems(service), b = (brand || '').toLowerCase();
    return clone(load().prices.filter((p) => words.every((w) => p.service.toLowerCase().includes(w)) && (!b || !p.brand || p.brand.toLowerCase() === b))
      .map((p) => ({ ...p, provider: p.provider_id ? prov(p.provider_id) : null })).filter((p) => !p.provider || p.provider.is_active).sort((a, b2) => a.price - b2.price).slice(0, 200));
  },
  async providerPrices(pid) { return clone(load().prices.filter((p) => p.provider_id === +pid)); },
  async addPrice(x) { const p = prov(x.provider_id); if (!p || (p.owner_id !== uid() && !isAdmin())) fail('Нет прав'); if (!(+x.price > 0)) fail('Цена должна быть больше 0');
    load().prices.push({ ...x, id: id(), price: +x.price }); save(); },
  async deletePrice(xid) { const d = load(); const x = d.prices.find((p) => p.id === +xid); if (!x || !(prov(x.provider_id)?.owner_id === uid() || isAdmin())) fail('Нет прав');
    d.prices = d.prices.filter((p) => p.id !== +xid); save(); },

  async registerBusiness(p) {
    const m = me() || fail('Войдите'); if (!p.name || !p.phone || !p.city) fail('Заполните название, телефон и город');
    load().registrations.push({ id: id(), user_id: m.id, kind: p.kind, name: p.name, phone: p.phone, address: p.address || '', city: p.city, details: p.details || {}, status: 'pending', created_at: now() }); save();
  },
  async myRegistrations() { return clone(load().registrations.filter((g) => g.user_id === uid()).sort((a, b) => b.id - a.id)); },

  async adminRegistrations() { if (!isAdmin()) fail('Нет прав'); return clone(load().registrations.filter((g) => isAdmin(g.city)).sort((a, b) => b.id - a.id)); },
  async reviewRegistration(gid, approve, reason) {
    const g = load().registrations.find((x) => x.id === +gid); if (!g || !isAdmin(g.city)) fail('Нет прав'); if (g.status !== 'pending') fail('Заявка уже рассмотрена');
    if (approve) { const d = g.details || {}; const p = { id: id(), kind: g.kind, owner_id: g.user_id, name: g.name, city: g.city, address: g.address, phone: g.phone,
      working_hours: d.working_hours || '', specs: (d.specs || []).map(Number), supplier_type: d.supplier_type || null, service_type: d.service_type || null,
      boxes: +d.boxes || 1, slot_minutes: +d.slot_minutes || 60, delivery: !!d.delivery, rating: 0, reviews_count: 0, is_active: true, created_at: now() };
      load().providers.push(p); g.provider_id = p.id; }
    Object.assign(g, { status: approve ? 'approved' : 'rejected', reason: reason || null, reviewed_at: now() }); save();
  },
  async adminRequests() { if (!isAdmin()) fail('Нет прав'); return clone(load().requests.filter((r) => isAdmin(r.city)).sort((a, b) => b.id - a.id)); },
  async adminStats() {
    if (!isAdmin()) fail('Нет прав'); const d = load(); const rs = d.requests.filter((r) => isAdmin(r.city));
    return { users: Object.keys(d.profiles).length, providers: d.providers.filter((p) => isAdmin(p.city)).length, requests: rs.length,
      completed: rs.filter((r) => r.status === 'completed').length, active: rs.filter((r) => !['completed', 'cancelled'].includes(r.status) && r.status !== 'expired').length,
      pending_regs: d.registrations.filter((g) => g.status === 'pending').length, pending_reviews: d.reviews.filter((x) => !x.is_published).length,
      turnover: rs.filter((r) => r.status === 'completed').reduce((s, r) => s + (r.final_amount || 0), 0) };
  },
  async pendingReviews() { if (!isAdmin()) fail('Нет прав'); return clone(load().reviews.filter((x) => !x.is_published).map((x) => ({ ...x, provider_name: prov(x.provider_id)?.name }))); },
  async moderateReview(rid, publish) {
    if (!isAdmin()) fail('Нет прав'); const d = load(); const x = d.reviews.find((r) => r.id === +rid); if (!x) return;
    if (publish) x.is_published = true; else { d.reviews = d.reviews.filter((r) => r.id !== x.id); recalc(x.provider_id); } save();
  },
  async adminProviders() { if (!isAdmin()) fail('Нет прав'); return clone(load().providers.filter((p) => isAdmin(p.city))); },
  async setProviderActive(pid, active) { const p = prov(pid); if (!p || !isAdmin(p.city)) fail('Нет прав'); p.is_active = !!active; save(); },
  async setCityActive(cid, active) { if (!isAdmin()) fail('Нет прав'); const c = load().cities.find((x) => x.id === +cid); c.active = !!active; save(); },
  async setProviderVerified(pid, v) { const p = prov(pid); if (!p || !isAdmin(p.city)) fail('Нет прав'); p.verified = !!v; save(); },

  // ---- обновление 3: фото, чат, статистика, ответы на отзывы
  async caps() { return { v3: true, v4: true, v5: true, v7: true }; },
  // ---- обновление 7: админы города и права (та же логика, что в supabase/07_admin_roles.sql)
  async adminList() { if (!isAdmin()) fail('Нет прав'); return clone(Object.values(load().profiles).filter((u) => u.role !== 'client')); },
  async adminUsers(q = '') {
    if (!isAdmin()) fail('Нет прав'); const d = load(), s = String(q || '').toLowerCase().trim(), dg = s.replace(/\D/g, '');
    return clone(Object.values(d.profiles).filter((u) => isAdmin(u.city) && (!s || (u.username || '').toLowerCase().includes(s) || (u.full_name || '').toLowerCase().includes(s) || (dg.length >= 4 && (u.phone || '').replace(/\D/g, '').includes(dg))))
      .map((u) => ({ ...u, requests: d.requests.filter((r) => r.user_id === u.id).length, orgs: d.providers.filter((p) => p.owner_id === u.id).length, created_at: u.created_at || ago(20000) })));
  },
  async setRole(userId, role, city = null) {
    const m = me(); if (m?.role !== 'global_admin') fail('Назначать администраторов может только главный администратор');
    const d = load(), u = d.profiles[userId]; if (!u) fail('Пользователь не найден');
    if (!['client', 'regional_admin', 'global_admin'].includes(role)) fail('Неизвестная роль');
    if (u.blocked_at && role !== 'client') fail('Пользователь заблокирован');
    if (role === 'regional_admin' && !d.cities.some((c) => c.name === city)) fail('Выберите город');
    if (u.role === 'global_admin' && role !== 'global_admin' && Object.values(d.profiles).filter((x) => x.role === 'global_admin').length <= 1) fail('Нельзя снять последнего главного администратора');
    dlog('role', userId, role === 'regional_admin' ? city : null, { from: u.role, to: role, city, username: u.username });
    Object.assign(u, { role, managed_city: role === 'regional_admin' ? city : null }); save(); return 'Готово';
  },
  async blockUser(userId, block, reason = '') {
    const d = load(), u = d.profiles[userId]; if (!u) fail('Пользователь не найден');
    if (!isAdmin(u.city)) fail('Нет прав'); if (userId === uid()) fail('Нельзя заблокировать себя');
    if (u.role !== 'client') fail('Сначала снимите с пользователя права администратора');
    if (block && !String(reason).trim()) fail('Укажите причину блокировки');
    Object.assign(u, { blocked_at: block ? now() : null, blocked_reason: block ? String(reason).trim().slice(0, 300) : null });
    dlog(block ? 'block' : 'unblock', userId, u.city, { reason }); save();
  },
  async adminLog() {
    if (!isAdmin()) fail('Нет прав'); const d = load(), m = me(), P = (x) => (x && d.profiles[x] ? { username: d.profiles[x].username, full_name: d.profiles[x].full_name } : null);
    return clone((d.adminLog || []).filter((x) => m.role === 'global_admin' || (x.city && isAdmin(x.city))).slice().reverse().map((x) => ({ ...x, actor: P(x.actor_id), target: P(x.target_user) })));
  },
  async settings(city = '') { return clone((load().settings || []).filter((x) => x.city === '' || x.city === (city || ''))); },
  async setSetting(key, city, value) {
    const c = city || '', m = me(); if (key !== 'city_notice') fail('Неизвестная настройка');
    if (c === '' ? m?.role !== 'global_admin' : !isAdmin(c)) fail('Нет прав на этот город');
    const d = load(); d.settings = (d.settings || []).filter((x) => !(x.key === key && x.city === c));
    if (value != null && String(value).trim()) { if (String(value).length > 500) fail('Текст до 500 символов'); d.settings.push({ key, city: c, value, updated_at: now() }); }
    dlog('setting', null, c || null, { key, value }); save();
  },
  async uploadRequestPhoto(blob) { if (!uid()) fail('Войдите'); return putPhoto(`req/${uid()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`, blob); },
  async photoUrls(paths) { const m = photos(); return (paths || []).map((x) => (/^(assets|https?:|data:)/.test(x) ? x : m[x]) || ''); },
  async uploadProviderPhoto(pid, blob) { const p = prov(pid); if (!p || (p.owner_id !== uid() && !isAdmin(p.city))) fail('Нет прав'); return new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => no(new Error('Не удалось прочитать фото')); fr.readAsDataURL(blob); }); },
  async providerStats(pid) {
    const rs = load().requests.filter((r) => r.accepted_by === +pid);
    const ts = rs.filter((r) => r.accepted_at).map((r) => (new Date(r.accepted_at) - new Date(r.created_at)) / 60000).sort((a, b) => a - b);
    const pr = load().prices.filter((x) => x.provider_id === +pid).map((x) => x.price);
    return { completed: rs.filter((r) => r.status === 'completed').length + (+pid === 1 ? 37 : +pid === 4 ? 52 : +pid === 6 ? 120 : 0),
      response_min: ts.length ? Math.round(ts[Math.floor(ts.length / 2)]) : (+pid === 1 ? 6 : +pid === 4 ? 3 : null), price_from: pr.length ? Math.min(...pr) : null };
  },
  async pricesFrom(ids) { const out = {}; for (const x of load().prices) if (x.provider_id && ids.includes(x.provider_id)) out[x.provider_id] = Math.min(out[x.provider_id] ?? Infinity, x.price); return out; },
  async getRequest(rid) {
    const r = req(rid); const p = prov(r.accepted_by);
    if (!(r.user_id === uid() || (p && p.owner_id === uid()) || (r.target_provider_id && prov(r.target_provider_id)?.owner_id === uid()) || isAdmin(r.city)
      || load().providers.some((pp) => pp.owner_id === uid() && matches(r, pp)))) fail('Заявка не найдена');
    return clone(r);
  },
  async messages(rid) { chatRole(rid); return clone(load().messages.filter((m) => m.request_id === +rid)); },
  async sendMessage(rid, body) {
    const role = chatRole(rid); const r = req(rid);
    if (role === 'admin') fail('Чат доступен клиенту и исполнителю, который взял заявку');
    if (r.status === 'cancelled') fail('Чат по этой заявке закрыт');
    if (!(body || '').trim()) fail('Пустое сообщение');
    const m = { id: id(), request_id: r.id, sender_id: uid(), from_provider: role === 'provider', body: body.trim().slice(0, 2000), created_at: now() };
    load().messages.push(m); save(); bus.forEach((f) => f(m));
    // в демо чужой исполнитель/клиент отвечает сам
    const other = role === 'client' ? prov(r.accepted_by)?.owner_id !== 'u-master' : r.user_id !== 'u-client';
    if (other && load().messages.filter((x) => x.request_id === r.id).length < 8) setTimeout(() => {
      const a = { id: id(), request_id: r.id, sender_id: null, from_provider: role === 'client', created_at: now(),
        body: role === 'client' ? 'Понял вас 👍 Если удобно, пришлите фото — так быстрее оценим работу.' : 'Хорошо, спасибо! Жду.' };
      load().messages.push(a); save(); bus.forEach((f) => f(a)); }, 2500);
    return clone(m);
  },
  subscribeMessages(rid, cb) { const f = (m) => { if (m.request_id === +rid) cb(m); }; bus.add(f); return () => bus.delete(f); },
  async replyReview(rvid, text) {
    const x = load().reviews.find((r) => r.id === +rvid) || fail('Отзыв не найден');
    if (!(prov(x.provider_id)?.owner_id === uid() || isAdmin())) fail('Нет прав');
    x.reply = (text || '').trim().slice(0, 1000) || null; x.reply_at = now(); save();
  },

  async addCity(name) { if (!isAdmin()) fail('Нет прав'); if (!name) fail('Введите название'); load().cities.push({ id: id(), name, region: '', active: true }); save(); },

  // ---- обновление 4 (supabase/04_cards_cargo_shop.sql): визитки, грузоперевозки, WhatsApp-заявки, магазин
  async createCard(p) {
    const m = me() || fail('Войдите'); if (!(p.name || '').trim() || !(p.phone || p.whatsapp) || !p.city) fail('Заполните название, телефон и город');
    if (!KINDS4.includes(p.kind)) fail('Неизвестный тип');
    if (load().providers.filter((x) => x.owner_id === m.id).length >= 10) fail('Не больше 10 визиток на одного владельца');
    const x = { id: id(), kind: p.kind, owner_id: m.id, name: p.name.trim().slice(0, 120), city: p.city, address: p.address || '', phone: p.phone || '', whatsapp: p.whatsapp || p.phone || '',
      working_hours: p.working_hours || '', specs: (p.specs || []).map(Number), supplier_type: p.supplier_type || null, service_type: p.service_type || null, boxes: +p.boxes || 1, slot_minutes: +p.slot_minutes || 60,
      delivery: !!p.delivery, rating: 0, reviews_count: 0, is_active: true, verified: false, about: (p.about || '').slice(0, 2000), photos: p.photos || [], card: p.card || {}, store_url: '', shop_enabled: p.kind === 'parts', created_at: now() };
    load().providers.push(x); save(); return x.id;
  },
  async createLead(l) {
    if (!(l.message || '').trim()) fail('Пустая заявка');
    if (l.provider_id && !prov(l.provider_id)?.is_active) fail('Исполнитель не найден');
    const svc = KINDS4.includes(l.kind) ? { service: l.kind } : {};
    const x = { id: id(), provider_id: l.provider_id ? +l.provider_id : null, kind: ['request', 'order', 'callback'].includes(l.kind) ? l.kind : 'request', source: l.source || 'card', user_id: uid() || null,
      customer_name: (l.customer_name || '').slice(0, 120), customer_phone: (l.customer_phone || '').slice(0, 30), message: l.message.slice(0, 4000), payload: { ...(l.payload || {}), ...svc },
      total: l.total ? +l.total : null, status: 'new', created_at: now(), token: tok(), chan: tok(), last_msg_at: now(), last_from: 'client' };
    load().leads.push(x); save(); return x.id;
  },
  async myLeads(pid) { myProv(pid); return clone(load().leads.filter((x) => x.provider_id === +pid).sort((a, b) => b.id - a.id)); },
  async dispatchLeads() { if (!isAdmin()) fail('Нет прав'); return clone(load().leads.filter((x) => !x.provider_id).sort((a, b) => b.id - a.id)); },
  async setLeadStatus(lid, status) { return demo.setOrderStatus(lid, null, status); },

  // ---------- чат по заказу (обновление 5) ----------
  async createOrder(l) {
    fresh(); const nid = await demo.createLead(l); const x = lead(nid);
    sys(x, 'Заявка создана. Здесь можно уточнить детали и цену — переписка остаётся на сайте.');
    // демо: «исполнитель» отвечает сам, если это не ваша организация
    if (!x.provider_id || prov(x.provider_id)?.owner_id !== uid()) x.demo_reply_at = new Date(Date.now() + 2500).toISOString();
    save(); ping(x); return { id: x.id, token: x.token, chan: x.chan };
  },
  async getOrder(oid, token) {
    fresh(); const x = lead(oid); const r = orderRole(x, token); const p = prov(x.provider_id);
    const { token: _t, ip_hash: _h, demo_reply_at: _d, ...o } = x;
    return clone({ ...o, role: r, provider: p ? { id: p.id, name: p.name, kind: p.kind, phone: p.phone, whatsapp: p.whatsapp, city: p.city, address: p.address, rating: p.rating, reviews_count: p.reviews_count } : null });
  },
  async orderMessages(oid, token, after = 0) {
    fresh(); const x = lead(oid); const r = orderRole(x, token);
    demoReply(x); purge();
    x[r === 'owner' ? 'owner_seen_at' : 'client_seen_at'] = now(); save();
    return clone(msgs().filter((m) => m.lead_id === x.id && m.id > (after || 0)).sort((a, b) => a.id - b.id));
  },
  async sendOrderMessage(oid, token, m) {
    fresh(); const x = lead(oid); const r = orderRole(x, token);
    if (x.closed_at || ['closed', 'cancelled'].includes(x.status)) fail('Заказ закрыт — переписка недоступна');
    const body = (m.body || '').slice(0, 2000), price = m.offer_price ? Math.round(+m.offer_price) : null;
    if (!body.trim() && !m.photo && !price) fail('Пустое сообщение');
    if (price && r !== 'owner') fail('Цену предлагает исполнитель');
    if (m.photo && (!/^data:image\/(jpeg|png|webp);base64,/.test(m.photo) || m.photo.length > 400000)) fail('Фото слишком большое');
    if (price) msgs().forEach((o) => { if (o.lead_id === x.id && o.offer_state === 'open') o.offer_state = 'expired'; });
    const n = { id: id(), lead_id: x.id, author: r, body, photo: m.photo || null, offer_price: price, offer_state: price ? 'open' : null, created_at: now() };
    msgs().push(n); Object.assign(x, { last_msg_at: now(), last_from: r, updated_at: now() }); if (r === 'owner' && x.status === 'new') x.status = 'clarify';
    save(); ping(x); return clone(n);
  },
  async acceptOffer(oid, token, mid) {
    fresh(); const x = lead(oid); if (orderRole(x, token) !== 'client') fail('Цену принимает клиент');
    const m = msgs().find((o) => o.id === +mid && o.lead_id === x.id && o.offer_state === 'open') || fail('Предложение уже неактуально');
    m.offer_state = 'accepted'; x.agreed_price = m.offer_price; if (['new', 'clarify', 'agreed'].includes(x.status)) x.status = 'agreed';
    sys(x, `Цена согласована: ${m.offer_price}.`); save(); ping(x);
  },
  async setOrderStatus(oid, token, st) {
    fresh(); const x = lead(oid); const r = orderRole(x, token);
    if (x.closed_at) fail('Заказ уже закрыт');
    const from = { in_work: ['new', 'clarify', 'agreed'], done: ['new', 'clarify', 'agreed', 'in_work'], paid: ['agreed', 'in_work', 'done'], clarify: null, cancelled: null };
    if (r === 'client') { if (st !== 'cancelled' || !['new', 'clarify', 'agreed'].includes(x.status)) fail('Клиент может только отменить заказ до начала работ'); }
    else if (!(st in from)) fail('Неверный статус');
    else if (from[st] && !from[st].includes(x.status)) fail(st === 'paid' ? 'Сначала выполните заказ' : 'Нельзя из этого статуса');
    x.status = st; x.updated_at = now(); if (['done', 'paid'].includes(st)) x.done_at = x.done_at || now(); if (st === 'paid') x.paid_at = now();
    sys(x, { clarify: 'Исполнитель уточняет детали.', in_work: 'Заказ в работе.', done: 'Исполнитель отметил: выполнено. Оцените, пожалуйста, работу.', paid: 'Оплата получена.' }[st] || (r === 'client' ? 'Клиент отменил заказ.' : 'Исполнитель отменил заказ.'));
    if (st === 'cancelled') closeOrder(x, 'Заказ отменён.'); else if (st === 'paid' && x.rating) closeOrder(x, 'Заказ оплачен и оценён — закрыт.');
    save(); ping(x);
  },
  async rateOrder(oid, token, rating, review) {
    fresh(); const x = lead(oid); if (orderRole(x, token) !== 'client') fail('Оценивает клиент');
    if (!(rating >= 1 && rating <= 5)) fail('Оценка от 1 до 5');
    if (!['done', 'paid'].includes(x.status)) fail('Оценить можно после выполнения'); if (x.rating) fail('Вы уже оценили этот заказ');
    Object.assign(x, { rating: +rating, review: (review || '').slice(0, 1000), rated_at: now() });
    const p = prov(x.provider_id);
    if (p) { if (p.base_rating == null) { p.base_rating = p.rating || 0; p.base_count = p.reviews_count || 0; }
      const L = load().leads.filter((l) => l.provider_id === p.id && l.rating); const n = p.base_count + L.length;
      p.rating = Math.round((p.base_rating * p.base_count + L.reduce((s2, l) => s2 + l.rating, 0)) / n * 100) / 100; p.reviews_count = n; }
    sys(x, `Клиент поставил оценку ${rating}★.`);
    if (x.status === 'paid') closeOrder(x, 'Заказ оплачен и оценён — закрыт.');
    save(); ping(x);
  },
  async claimOrder(oid, phone) {
    fresh(); const x = lead(oid); const d = String(phone || '').replace(/\D/g, '');
    x.claim_tries = x.claim_at && Date.now() - new Date(x.claim_at) < 36e5 ? (x.claim_tries || 0) + 1 : 1; if (x.claim_tries === 1) x.claim_at = now(); save();
    if (x.claim_tries > 5) fail('Слишком много попыток. Попробуйте через час');
    return d.length >= 10 && String(x.customer_phone || '').replace(/\D/g, '').slice(-10) === d.slice(-10) ? x.token : null;
  },
  async providerOrderReviews(pid) { return clone(load().leads.filter((l) => l.provider_id === +pid && l.rating).sort((a, b) => (b.rated_at > a.rated_at ? 1 : -1)).slice(0, 30)
    .map((l) => ({ rating: l.rating, review: l.review, rated_at: l.rated_at, name: (l.customer_name || 'Клиент').split(' ')[0] }))); },
  subscribeOrder(o, cb) {
    const f = (e) => { if (e.key === KEY) { db = null; cb(); } }; window.addEventListener('storage', f);
    const g = (c) => { if (c === o.chan) cb(); }; obus.add(g);
    return () => { window.removeEventListener('storage', f); obus.delete(g); };
  },
  // демо: «перемотать время» — показать, как удаляется переписка через 3 дня после закрытия
  async demoTimeTravel(oid) { fresh(); const x = lead(oid); if (x.closed_at) x.closed_at = new Date(Date.now() - 4 * 864e5).toISOString(); purge(); save(); ping(x); },
  async shopProducts(pid) { return clone(load().products.filter((x) => x.provider_id === +pid && x.is_published).sort((a, b) => b.id - a.id)); },
  async myProducts(pid) { myProv(pid); return clone(load().products.filter((x) => x.provider_id === +pid).sort((a, b) => b.id - a.id)); },
  async saveProduct(pid, x) {
    myProv(pid); if (!(x.name || '').trim()) fail('Укажите название'); if (!(+x.price >= 0)) fail('Укажите цену');
    const d = load();
    if (x.id) { const o = d.products.find((p) => p.id === +x.id && p.provider_id === +pid) || fail('Товар не найден'); Object.assign(o, { ...x, id: o.id, provider_id: o.provider_id, price: +x.price, stock: x.stock === '' || x.stock == null ? null : +x.stock }); }
    else { const n = d.products.filter((p) => p.provider_id === +pid).length + 1; d.products.push({ ...x, id: id(), provider_id: +pid, sku: x.sku || 'SKU-' + String(n).padStart(6, '0'), price: +x.price, stock: x.stock === '' || x.stock == null ? null : +x.stock, is_published: x.is_published !== false, created_at: now() }); }
    save();
  },
  async deleteProduct(xid) { const d = load(); const x = d.products.find((p) => p.id === +xid) || fail('Товар не найден'); myProv(x.provider_id); d.products = d.products.filter((p) => p.id !== +xid); save(); },
  async uploadProductPhoto(pid, blob) { myProv(pid); return new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => no(new Error('Не удалось прочитать фото')); fr.readAsDataURL(blob); }); },
};
const KINDS4 = ['sto', 'tow', 'wash', 'parts', 'urgent', 'cargo'];
// ---------- помощники чата по заказу ----------
const fresh = () => { db = null; return load(); };
const msgs = () => (load().orderMsgs ||= []);
const lead = (oid) => load().leads.find((l) => l.id === +oid) || fail('Заказ не найден');
const obus = new Set();
const ping = (x) => obus.forEach((f) => f(x.chan));
function orderRole(x, token) {
  if (token) { if (token === x.token) return 'client'; fail('Заказ не найден'); }
  if ((x.provider_id && prov(x.provider_id)?.owner_id === uid()) || (!x.provider_id && isAdmin()) || (x.provider_id && isAdmin(prov(x.provider_id)?.city))) return 'owner';
  if (x.user_id && x.user_id === uid()) return 'client';
  fail('Заказ не найден');
}
const sys = (x, body) => msgs().push({ id: id(), lead_id: x.id, author: 'system', body, created_at: now() });
function closeOrder(x, why) { if (x.closed_at) return; x.closed_at = now(); if (x.status !== 'cancelled') x.status = 'closed'; sys(x, why + ' Переписка будет удалена через 3 дня. Итог заказа, цена и отзыв сохранятся.'); }
function purge() {
  const d = load(), old = (t, days) => t && Date.now() - new Date(t) > days * 864e5;
  d.leads.forEach((x) => { if (!x.closed_at && x.status === 'paid' && old(x.paid_at, 7)) closeOrder(x, 'Заказ оплачен, оценки не было 7 дней — закрыт.'); });
  const gone = new Set(d.leads.filter((x) => old(x.closed_at, 3)).map((x) => x.id));
  if (gone.size) { d.orderMsgs = msgs().filter((m) => !gone.has(m.lead_id)); d.leads.forEach((x) => { if (gone.has(x.id) && !x.chat_purged_at) x.chat_purged_at = now(); }); }
}
function demoReply(x) {
  if (!x.demo_reply_at || new Date(x.demo_reply_at) > new Date() || x.closed_at) return;
  delete x.demo_reply_at;
  const p = prov(x.provider_id), price = x.total || ({ cargo: 12000, tow: 15000, sto: 9000, wash: 6000, parts: 18000, urgent: 7000 }[x.payload?.service || p?.kind] || 10000);
  msgs().push({ id: id(), lead_id: x.id, author: 'owner', body: `Здравствуйте${x.customer_name ? ', ' + x.customer_name : ''}! Это ${p?.name || 'диспетчер'} (демо). Всё понял, уточню пару деталей. Предварительно так:`, created_at: now() });
  msgs().push({ id: id(), lead_id: x.id, author: 'owner', body: 'Цена с учётом всего, что вы описали', offer_price: price, offer_state: 'open', created_at: now() });
  Object.assign(x, { status: x.status === 'new' ? 'clarify' : x.status, last_msg_at: now(), last_from: 'owner' });
}

const bus = new Set();
const photos = () => { try { return JSON.parse(localStorage.getItem(PKEY)) || {}; } catch { return {}; } };
function putPhoto(path, blob) {
  return new Promise((ok, no) => { const fr = new FileReader(); fr.onerror = () => no(new Error('Не удалось прочитать фото'));
    fr.onload = () => { const m = photos(); m[path] = fr.result;
      try { localStorage.setItem(PKEY, JSON.stringify(m)); ok(path); } catch { no(new Error('В демо-режиме место для фото закончилось — нажмите «Сбросить демо»')); } };
    fr.readAsDataURL(blob); });
}
function chatRole(rid) {
  const r = req(rid); const p = prov(r.accepted_by);
  if (r.user_id === uid()) return 'client';
  if (p && p.owner_id === uid()) return 'provider';
  if (isAdmin(r.city)) return 'admin';
  fail('Чат недоступен');
}

// Имитация исполнителей в демо: чужие организации «откликаются» сами
function demoAutoReply(rid) {
  const r = load().requests.find((x) => x.id === rid); if (!r || r.status !== 'new') return;
  const cands = load().providers.filter((p) => p.owner_id !== 'u-master' && matches(r, p));
  if (!cands.length) return;
  const p = cands[0];
  if (r.type === 'parts') {
    cands.slice(0, 2).forEach((pp, i) => load().offers.push({ id: id(), request_id: r.id, provider_id: pp.id, price: 15000 + i * 3500, comment: i ? 'Б/у, в хорошем состоянии' : 'Новая, оригинал, в наличии', is_selected: false, created_at: now() }));
    touch(r, { status: 'offers' });
  } else if (r.type === 'wash') {
    touch(r, { status: 'price_offered', accepted_by: p.id, price: 6000, assigned_time: r.desired_time || plus(120) });
  } else touch(r, { status: 'active', accepted_by: p.id });
  if (r.type !== 'parts') load().messages.push({ id: id(), request_id: r.id, sender_id: null, from_provider: true, created_at: now(),
    body: r.type === 'parts' ? 'Здравствуйте! Есть в наличии, можем отложить.' : r.type === 'wash' ? 'Здравствуйте! Предложили вам время — подтвердите, пожалуйста.' : 'Здравствуйте! Заявку принял, могу уточнить детали здесь в чате.' });
  save(); bus.forEach((f) => f({ request_id: r.id }));
}
