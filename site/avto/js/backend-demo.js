// ДЕМО-бэкенд: та же логика, что в функциях Supabase (supabase/01_schema.sql), но данные хранятся
// только в этом браузере (localStorage). Все люди и организации здесь — вымышленные.
import { SEED } from './seed.js';

const KEY = 'am24-demo-db-v1', UKEY = 'am24-demo-user';
const now = () => new Date().toISOString();
const plus = (min) => new Date(Date.now() + min * 60000).toISOString();
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const C = 'Талдыкорган';

function initial() {
  const P = (id, kind, name, extra = {}) => ({ id, kind, owner_id: null, name, city: C, address: '', phone: '+7 700 000 00 ' + String(id).padStart(2, '0'),
    working_hours: '09:00-19:00', specs: [], supplier_type: null, service_type: null, boxes: 1, slot_minutes: 60, delivery: false,
    rating: 0, reviews_count: 0, is_active: true, created_at: ago(9000), ...extra });
  const providers = [
    P(1, 'sto', 'Демо-СТО «Мотор»', { owner_id: 'u-master', address: 'ул. Примерная, 1', specs: [1, 2, 7, 8, 9], rating: 4.8, reviews_count: 12 }),
    P(2, 'sto', 'Демо-СТО «Ходовая+»', { address: 'ул. Примерная, 15', specs: [2, 5, 11], rating: 4.5, reviews_count: 7 }),
    P(3, 'sto', 'Демо-СТО «Автоэлектрик»', { address: 'пр. Демо, 8', specs: [3, 15], rating: 4.2, reviews_count: 3 }),
    P(4, 'tow', 'Демо-эвакуатор «Быстрый»', { owner_id: 'u-master', rating: 4.9, reviews_count: 20, working_hours: 'Круглосуточно' }),
    P(5, 'tow', 'Демо-эвакуатор «Сокол»', { rating: 4.4, reviews_count: 5, working_hours: 'Круглосуточно' }),
    P(6, 'wash', 'Демо-мойка «Блеск»', { owner_id: 'u-master', address: 'ул. Чистая, 3', boxes: 3, slot_minutes: 30, working_hours: '08:00-22:00', rating: 4.7, reviews_count: 15 }),
    P(7, 'wash', 'Демо-мойка «Аква»', { address: 'ул. Водная, 9', boxes: 2, working_hours: '09:00-21:00', rating: 4.3, reviews_count: 4 }),
    P(8, 'parts', 'Демо-магазин «Запчасть»', { owner_id: 'u-master', supplier_type: 'shop', delivery: true, rating: 4.6, reviews_count: 9 }),
    P(9, 'parts', 'Демо-авторазбор «Японец»', { supplier_type: 'razborka', rating: 4.1, reviews_count: 6 }),
    P(10, 'urgent', 'Демо-мастер «Замки 24»', { owner_id: 'u-master', service_type: 'locksmith', working_hours: 'Круглосуточно', rating: 5, reviews_count: 8 }),
    P(11, 'urgent', 'Демо-шиномонтаж на выезде', { service_type: 'tire', rating: 4.5, reviews_count: 4 }),
    P(12, 'urgent', 'Демо-электрик на выезде', { service_type: 'electrician', rating: 4.0, reviews_count: 2 }),
    P(13, 'sto', 'Демо-СТО «Алматы Сервис»', { city: 'Алматы', specs: [], rating: 4.6, reviews_count: 30 }),
  ];
  const profiles = {
    'u-client': { id: 'u-client', username: 'demo_client', full_name: 'Демо Клиент', phone: '+77001112233', city: C, role: 'client', consent: true },
    'u-master': { id: 'u-master', username: 'demo_master', full_name: 'Демо Мастер', phone: '+77002223344', city: C, role: 'client', consent: true },
    'u-admin': { id: 'u-admin', username: 'demo_admin', full_name: 'Демо Админ', phone: '+77003334455', city: C, role: 'global_admin', consent: true },
    'u-other': { id: 'u-other', username: null, full_name: 'Другой клиент (демо)', phone: '+77009990000', city: C, role: 'client', consent: true },
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
      status: 'completed', accepted_by: 2, final_amount: 5000, created_at: ago(4000), updated_at: ago(3900), expires_at: ago(3940) }),
  ];
  const reviews = [
    { id: 1, user_id: 'u-other', provider_id: 1, request_id: null, rating: 5, comment: 'Быстро нашли причину стука, цена как договаривались.', is_published: true, created_at: ago(20000) },
    { id: 2, user_id: 'u-other', provider_id: 4, request_id: null, rating: 5, comment: 'Приехал за 25 минут.', is_published: true, created_at: ago(15000) },
    { id: 3, user_id: 'u-other', provider_id: 2, request_id: null, rating: 4, comment: 'Хорошо, но пришлось подождать.', is_published: false, created_at: ago(100) },
  ];
  let pid = 1;
  const prices = SEED.ref_prices.map((p) => ({ id: pid++, provider_id: null, service: p.service, brand: p.brand, model: p.model, price: p.price, notes: 'Справочная цена', year_from: null, year_to: null }));
  for (const [svc, pr] of [['Замена масла', 4000], ['Компьютерная диагностика', 5000], ['Замена передних колодок', 4500], ['Развал-схождение', 7000], ['Замена ремня ГРМ', 25000]]) {
    prices.push({ id: pid++, provider_id: 1, service: svc, brand: '', model: '', price: pr, notes: '', year_from: null, year_to: null });
    prices.push({ id: pid++, provider_id: 2, service: svc, brand: '', model: '', price: Math.round(pr * 1.15 / 100) * 100, notes: '', year_from: null, year_to: null });
  }
  return { seq: 100, profiles, providers, requests, reviews, prices, offers: [], declines: [], vehicles: [
    { id: 1, user_id: 'u-client', brand: 'Toyota', model: 'Corolla', year: 2012, plate: '123ABC05', engine_volume: '1.6' }],
    registrations: [{ id: 1, user_id: 'u-other', kind: 'sto', name: 'Демо-заявка: СТО «Новое»', phone: '+77005550000', address: 'ул. Новая, 1', city: C, details: { specs: [1, 2] }, status: 'pending', created_at: ago(60) }],
    cities: SEED.cities.map((c) => ({ ...c })) };
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
const touch = (r, patch) => { Object.assign(r, patch, { updated_at: now() }); save(); };
const recalc = (pid) => { const rs = load().reviews.filter((x) => x.provider_id === pid); const p = prov(pid);
  p.reviews_count = rs.length; p.rating = rs.length ? Math.round(rs.reduce((s, x) => s + x.rating, 0) / rs.length * 100) / 100 : 0; };
export const stems = (q) => (q || '').toLowerCase().split(/[^a-zа-яё0-9]+/i).filter((w) => w.length > 1).map((w) => w.length > 5 ? w.slice(0, w.length - 2) : w);
const clone = (x) => JSON.parse(JSON.stringify(x));

export const demo = {
  mode: 'demo',
  async ref() { return { ...SEED, cities: load().cities }; },
  async session() { return me() ? clone(me()) : null; },
  async loginDemo(role) { localStorage.setItem(UKEY, { client: 'u-client', master: 'u-master', admin: 'u-admin' }[role]); },
  async logout() { localStorage.removeItem(UKEY); },
  async resetDemo() { localStorage.removeItem(KEY); db = null; load(); },
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
    const allowed = ['name', 'address', 'phone', 'working_hours', 'specs', 'boxes', 'slot_minutes', 'delivery', 'supplier_type', 'service_type'];
    for (const k of Object.keys(patch)) if (allowed.includes(k) || isAdmin(p.city)) p[k] = patch[k];
    save(); return clone(p);
  },

  async createRequest(p) {
    const m = me() || fail('Войдите');
    if (!m.consent) fail('Нужно согласие на обработку персональных данных (Профиль)');
    if (!m.phone) fail('Укажите телефон в профиле — без него исполнитель не сможет связаться');
    const ttl = p.type === 'parts' ? 180 : p.type === 'wash' ? null : 60;
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
  async addCity(name) { if (!isAdmin()) fail('Нет прав'); if (!name) fail('Введите название'); load().cities.push({ id: id(), name, region: '', active: true }); save(); },
};

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
}
