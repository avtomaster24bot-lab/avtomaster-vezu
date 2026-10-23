// Выбор бэкенда: Supabase, если в базе есть таблицы am_*, иначе демо-режим в браузере.
import { live, supabaseReady } from './backend-supabase.js';
import { demo } from './backend-demo.js';
export const api = (await supabaseReady()) ? live : demo;
export const IS_DEMO = api.mode === 'demo';
