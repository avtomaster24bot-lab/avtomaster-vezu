// Боевой бэкенд: Supabase (Postgres + RLS). Все изменения статусов — через функции am_* (supabase/01_schema.sql).
import { CONFIG } from './config.js';
import { stems } from './backend-demo.js';

let sb = null;
async function client() {
  if (sb) return sb;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'am24-auth' } });
  return sb;
}
function human(e) {
  const m = e?.message || String(e);
  if (/JWT|session|not authenticated/i.test(m)) return 'Сессия истекла — войдите снова';
  if (/row-level security|permission denied|42501/i.test(m)) return 'Недостаточно прав для этого действия';
  return m;
}
const must = ({ data, error }) => { if (error) throw new Error(human(error)); return data; };
const rpc = async (fn, args = {}) => must(await (await client()).rpc(fn, args));
const from = async (t) => (await client()).from(t);

export async function supabaseReady() {
  if (CONFIG.FORCE_DEMO || !/^https:\/\//.test(CONFIG.SUPABASE_URL || '') || !CONFIG.SUPABASE_ANON_KEY) return false;
  try {
    const c = JSON.parse(sessionStorage.getItem('am24-ready') || 'null');
    if (c && Date.now() - c.t < 60000) return c.ok;
  } catch { /* ignore */ }
  let ok = false;
  try {
    const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 7000);
    const r = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/am_cities?select=id&limit=1`, { headers: { apikey: CONFIG.SUPABASE_ANON_KEY }, signal: ctrl.signal });
    clearTimeout(tm); ok = r.ok;
  } catch { ok = false; }
  try { sessionStorage.setItem('am24-ready', JSON.stringify({ ok, t: Date.now() })); } catch { /* ignore */ }
  return ok;
}

export const live = {
  mode: 'live',
  async ref() {
    const q = async (t, order = 'id') => must(await (await from(t)).select('*').order(order));
    const [cities, categories, subcategories, price_services, brands, models] = await Promise.all(
      ['am_cities', 'am_categories', 'am_subcategories', 'am_price_services', 'am_brands', 'am_models'].map((t) => q(t)));
    const { SEED } = await import('./seed.js');
    return { cities, categories, subcategories, price_services, brands, models, price_categories: [...new Set(price_services.map((s) => s.category))], maintenance: SEED.maintenance };
  },
  async session() {
    const s = await client(); const { data } = await s.auth.getSession();
    if (!data.session) return null;
    try { return await rpc('am_ensure_profile'); } catch (e) { if (/сесс/i.test(e.message)) { await s.auth.signOut({ scope: 'local' }); return null; } throw e; }
  },
  async loginTelegram(tgUser) {
    const r = await fetch(CONFIG.TELEGRAM_AUTH_URL, { method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CONFIG.SUPABASE_ANON_KEY, Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}` }, body: JSON.stringify(tgUser) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const map = { invalid_hash: 'Подпись Telegram не прошла проверку', auth_expired: 'Данные входа устарели, попробуйте ещё раз', too_many_requests: 'Слишком много попыток, подождите минуту', banned: 'Аккаунт заблокирован' };
      throw new Error(map[j.error] || `Ошибка входа (${j.error || r.status})`);
    }
    const s = await client();
    const { error } = await s.auth.setSession({ access_token: j.access_token, refresh_token: j.refresh_token });
    if (error) throw new Error(human(error));
  },
  async logout() { const s = await client(); await s.auth.signOut({ scope: 'local' }).catch(() => {}); },
  async updateProfile({ full_name, phone, city, consent }) { return rpc('am_update_profile', { p_full_name: full_name, p_phone: phone, p_city: city, p_consent: !!consent }); },
  async deleteMyData() { return rpc('am_delete_my_data'); },

  async listProviders({ kind, city } = {}) {
    let q = (await from('am_providers')).select('*').eq('is_active', true).order('rating', { ascending: false });
    if (kind) q = q.eq('kind', kind); if (city) q = q.eq('city', city); return must(await q);
  },
  async getProvider(id) { return must(await (await from('am_providers')).select('*').eq('id', id).single()); },
  async providerReviews(id) { return must(await (await from('am_reviews')).select('id,rating,comment,is_published,created_at,request_id').eq('provider_id', id).order('created_at', { ascending: false }).limit(50)); },
  async myProviders() {
    const s = await client(); const { data } = await s.auth.getUser(); if (!data.user) return [];
    return must(await (await from('am_providers')).select('*').eq('owner_id', data.user.id).order('id'));
  },
  async updateProvider(id, patch) { return must(await (await from('am_providers')).update(patch).eq('id', id).select().single()); },

  async createRequest(p) { return rpc('am_create_request', { p }); },
  async myRequests() {
    const s = await client(); const { data } = await s.auth.getUser(); if (!data.user) return [];
    return must(await (await from('am_requests')).select('*').eq('user_id', data.user.id).order('id', { ascending: false }).limit(100));
  },
  async cancelRequest(id) { return rpc('am_cancel_request', { p_id: id }); },
  async requestOffers(id) { return rpc('am_request_offers', { p_id: id }); },
  async selectOffer(oid) { return rpc('am_select_offer', { p_offer: oid }); },
  async washApprove(id) { return rpc('am_wash_approve', { p_id: id }); },
  async clientConfirm(id) { return rpc('am_client_confirm', { p_id: id }); },
  async leaveReview(id, rating, comment) { return rpc('am_leave_review', { p_id: id, p_rating: +rating, p_comment: comment || '' }); },
  async myReviewFor(id) { return must(await (await from('am_reviews')).select('*').eq('request_id', id).maybeSingle()); },

  async providerFeed(pid) { return rpc('am_provider_feed', { p_provider: +pid }); },
  async myOffers(pid) { return must(await (await from('am_offers')).select('*').eq('provider_id', pid)); },
  async accept(id, pid) { return rpc('am_accept_request', { p_id: id, p_provider: +pid }); },
  async decline(id, pid) { return rpc('am_decline_request', { p_id: id, p_provider: +pid }); },
  async complete(id, pid, amount) { return rpc('am_complete_request', { p_id: id, p_provider: +pid, p_amount: amount ? +amount : null }); },
  async makeOffer(id, pid, price, comment) { return rpc('am_make_offer', { p_id: id, p_provider: +pid, p_price: +price, p_comment: comment || '' }); },
  async washQuote(id, pid, price, time) { return rpc('am_wash_quote', { p_id: id, p_provider: +pid, p_price: +price, p_time: new Date(time).toISOString() }); },
  async washStatus(id, pid, st) { return rpc('am_wash_status', { p_id: id, p_provider: +pid, p_status: st }); },
  async clientContact(id) { const r = await rpc('am_client_contact', { p_id: id }); return r?.[0] || null; },

  async vehicles() { return must(await (await from('am_vehicles')).select('*').order('id')); },
  async addVehicle(v) { if (!v.brand) throw new Error('Укажите марку'); return must(await (await from('am_vehicles')).insert(v)); },
  async deleteVehicle(id) { return must(await (await from('am_vehicles')).delete().eq('id', id)); },

  async searchPrices({ service, brand }) {
    let q = (await from('am_prices')).select('*, provider:am_providers(id,name,city,address,phone,rating,is_active)').order('price').limit(200);
    for (const w of stems(service)) q = q.ilike('service', `%${w}%`);
    if (brand) q = q.or(`brand.eq.,brand.is.null,brand.ilike.${brand}`);
    return (must(await q) || []).filter((p) => !p.provider || p.provider.is_active);
  },
  async providerPrices(pid) { return must(await (await from('am_prices')).select('*').eq('provider_id', pid).order('service')); },
  async addPrice(x) { return must(await (await from('am_prices')).insert({ ...x, price: +x.price })); },
  async deletePrice(id) { return must(await (await from('am_prices')).delete().eq('id', id)); },

  async registerBusiness(p) { return rpc('am_register_business', { p }); },
  async myRegistrations() {
    const s = await client(); const { data } = await s.auth.getUser(); if (!data.user) return [];
    return must(await (await from('am_registrations')).select('*').eq('user_id', data.user.id).order('id', { ascending: false }));
  },
  async adminRegistrations() { return must(await (await from('am_registrations')).select('*').order('id', { ascending: false }).limit(200)); },
  async reviewRegistration(id, approve, reason) { return rpc('am_review_registration', { p_id: id, p_approve: !!approve, p_reason: reason || null }); },
  async adminRequests() { return rpc('am_admin_requests'); },
  async adminStats() { return rpc('am_admin_stats'); },
  async pendingReviews() { return must(await (await from('am_reviews')).select('*, p:am_providers(name)').eq('is_published', false).order('id')).map((x) => ({ ...x, provider_name: x.p?.name })); },
  async moderateReview(id, publish) { return rpc('am_moderate_review', { p_id: id, p_publish: !!publish }); },
  async adminProviders() { return must(await (await from('am_providers')).select('*').order('id')); },
  async setProviderActive(id, active) { return must(await (await from('am_providers')).update({ is_active: !!active }).eq('id', id)); },
  async setCityActive(id, active) { return must(await (await from('am_cities')).update({ active: !!active }).eq('id', id)); },
  async addCity(name) { return must(await (await from('am_cities')).insert({ name })); },
};
