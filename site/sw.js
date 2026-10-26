// АвтоМастер24 — service worker: приложение открывается без сети (последняя версия из кэша).
// Сначала сеть (чтобы после обновления сайта сразу была новая версия), при ошибке — кэш.
const CACHE = 'am24-v4.0';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/api.js', 'js/config.js', 'js/consts.js', 'js/seed.js',
  'js/backend-demo.js', 'js/backend-supabase.js', 'js/region.js', 'js/messaging.js', 'js/cardkit.js', 'js/card.js', 'js/shop.js', 'js/vendor/qrcode.js',
  'card.html', 'shop.html', 'css/shop.css', 'assets/favicon.svg', 'assets/icon-192.png', 'manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('am24-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // Supabase, Telegram, шрифты — напрямую
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); } return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
