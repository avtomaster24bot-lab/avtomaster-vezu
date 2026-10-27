// АвтоМастер24 — service worker. Всегда сначала сеть: страницы — без HTTP-кэша (no-store),
// скрипты/стили/картинки — с проверкой свежести (no-cache → 304, если не менялись). Кэш — только запасной вариант без сети.
// При выходе новой версии старые кэши этого сайта (am24v-*) удаляются; кэши старого сайта АвтоМастер24 (am24-*) на том же домене не трогаем, вкладки сразу переходят на новый SW.
const CACHE = 'am24v-6.5';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/heal.js', 'js/app.js', 'js/api.js', 'js/config.js', 'js/consts.js', 'js/seed.js', 'js/icons.js',
  'js/backend-demo.js', 'js/backend-supabase.js', 'js/region.js', 'js/messaging.js', 'js/cardkit.js', 'js/card.js', 'js/shop.js', 'js/orders.js', 'js/order.js', 'js/vendor/qrcode.js',
  'card.html', 'shop.html', 'order.html', 'css/shop.css', 'assets/app-icon.svg', 'assets/app-192.png', 'assets/app-512.png', 'manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'no-cache' })).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('am24v-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith(new URL(self.registration.scope).pathname)) return; // Supabase, CDN, Telegram — напрямую
  const page = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  const key = page ? u.origin + u.pathname : req; // ?id=…&_r=… у страниц — одна запись кэша
  e.respondWith(fetch(req, { cache: page ? 'no-store' : 'no-cache' }).then((r) => {
    if (r.ok && r.type === 'basic') { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(key, cp)).catch(() => {}); }
    return r;
  }).catch(() => caches.match(key, { ignoreSearch: !page }).then((r) => r || (page ? caches.match('index.html') : Response.error()))));
});
