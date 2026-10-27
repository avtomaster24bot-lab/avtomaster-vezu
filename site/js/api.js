// Выбор бэкенда (адаптер данных): Supabase, если в базе есть таблицы am_*, иначе демо-режим в браузере.
// Демо можно включить вручную: ?demo=1 в адресе (выключить — ?demo=0 или кнопка «Выйти из демо»).
// Новый бэкенд для другой страны = ещё один объект с теми же методами (см. docs/ARCHITECTURE.md).
import { live, supabaseReady } from './backend-supabase.js';
import { demo } from './backend-demo.js';
const qd = new URLSearchParams(location.search).get('demo') ?? new URLSearchParams(location.hash.split('?')[1] || '').get('demo');
try { if (qd === '1') localStorage.setItem('am24v-force-demo', '1'); if (qd === '0') localStorage.removeItem('am24v-force-demo'); } catch { /* ignore */ }
export const FORCED_DEMO = (() => { try { return localStorage.getItem('am24v-force-demo') === '1'; } catch { return false; } })();
export const api = !FORCED_DEMO && (await supabaseReady()) ? live : demo;
export const IS_DEMO = api.mode === 'demo';
export const leaveDemo = () => { try { localStorage.removeItem('am24v-force-demo'); } catch { /* ignore */ } };
