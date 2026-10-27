// АвтоМастер24 — «самолечение» страницы (обычный скрипт, работает даже если модули не загрузились).
// 1) если за 12 с страница так и не отрисовалась — показываем плашку с кнопками «Обновить» и «Сбросить и открыть заново»;
// 2) am24Reset() — чистит старую сессию/кэш/service worker этого сайта (данные других сайтов не трогает).
(function () {
  var BUILD = '6.3';
  // Старый сайт АвтоМастер24 (/avtomaster24-web/) живёт на том же домене и хранит свои ключи am24-*
  // (в т.ч. сессию am24-auth от своей базы). Гибрид хранит всё под am24v-* и чужие ключи НЕ трогает.
  // Один раз переносим свои настройки, которые раньше лежали под am24-*; сессию am24-auth не трогаем никогда.
  try {
    if (!localStorage.getItem('am24v-mig2')) {
      var own = /^am24-(my-orders|demo-db-v5|demo-user|demo-photos|force-demo|backend|cart-.*|last-wa-.*)$/; // были только у гибрида
      var shared = /^am24-(theme|city|fav|onboarded)$/; // есть и у старого сайта — копируем, оригинал оставляем
      var all = []; for (var i = 0; i < localStorage.length; i++) all.push(localStorage.key(i)); // снимок: порядок ключей меняется при записи
      for (var j = 0; j < all.length; j++) {
        var k = all[j]; if (!k) continue;
        var m = own.test(k), s = shared.test(k); if (!m && !s) continue;
        var nk = 'am24v-' + k.slice(5);
        if (localStorage.getItem(nk) === null && k !== 'am24-backend') localStorage.setItem(nk, localStorage.getItem(k));
        if (m) localStorage.removeItem(k);
      }
      localStorage.setItem('am24v-mig2', '1');
    }
  } catch (e) {}
  window.AM24_BUILD = BUILD;
  window.am24Reset = function () {
    try { ['am24v-auth', 'am24v-backend'].forEach(function (k) { localStorage.removeItem(k); }); sessionStorage.removeItem('am24v-ready'); } catch (e) {}
    var jobs = [];
    try { if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('am24v-') === 0; }).map(function (k) { return caches.delete(k); })); })); } catch (e) {}
    try { if (navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.filter(function (r) { return r.scope.indexOf('/avtomaster-vezu/') > -1; }).map(function (r) { return r.unregister(); })); })); } catch (e) {}
    Promise.all(jobs).catch(function () {}).then(function () { var u = location.href.replace(/([?&])_r=\d+/, '$1'); location.replace(u + (u.indexOf('?') > -1 ? '&' : '?') + '_r=' + Date.now()); });
  };
  var errs = [];
  window.addEventListener('error', function (e) { errs.push(e.message || 'resource'); });
  window.addEventListener('unhandledrejection', function (e) { errs.push(String(e.reason && e.reason.message || e.reason)); });
  function stuck() {
    var m = document.querySelector('main');
    if (!m) return false;
    if (m.querySelector('.sk-wrap[aria-busy]')) return true;
    return /^\s*Загрузка…\s*$/.test(m.textContent || '');
  }
  function banner() {
    if (!stuck() || document.getElementById('am24v-heal')) return;
    var d = document.createElement('div');
    d.id = 'am24v-heal'; d.setAttribute('role', 'alert'); d.className = 'heal';
    d.innerHTML = '<b>Страница не загрузилась</b><span>Обычно помогает сброс сохранённых данных этого сайта (вход и кэш). Ваши заказы в базе не пропадут.</span>' +
      '<div class="heal-row"><button type="button" id="healR">Обновить</button><button type="button" id="healX" class="p">Сбросить и открыть заново</button></div>' +
      (errs.length ? '<small>' + String(errs[errs.length - 1]).replace(/[<>&]/g, '').slice(0, 140) + '</small>' : '');
    var st = document.createElement('style'); st.textContent = '.heal{position:fixed;left:12px;right:12px;bottom:84px;z-index:99;max-width:560px;margin:0 auto;background:#1b1d22;color:#fff;border:1px solid #f5b83d;border-radius:16px;padding:14px 16px;box-shadow:0 20px 50px rgba(0,0,0,.45);display:flex;flex-direction:column;gap:6px;font:14px/1.45 system-ui,sans-serif}.heal span{color:#d7dae0}.heal small{color:#9aa0aa}.heal-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}.heal button{border:0;border-radius:10px;padding:9px 14px;font-weight:700;background:#2b2f37;color:#fff;cursor:pointer}.heal button.p{background:#f5b83d;color:#111}';
    document.head.appendChild(st); document.body.appendChild(d);
    document.getElementById('healR').onclick = function () { location.reload(); };
    document.getElementById('healX').onclick = window.am24Reset;
  }
  setTimeout(banner, 12000);
})();
