(function () {
  'use strict';
  var V = window.VEZU, f = document.getElementById('f'), KEY = 'vezu-card';
  var state = { w: '1,5 т', s: '012', pu: 0, f: 0, th: 0 };

  // начальные данные: ?c=… / ?d=… (из «Редактировать визитку») → localStorage → по умолчанию
  var q = new URLSearchParams(location.search), init = null;
  if (q.get('c') || q.get('d')) init = V.readCard();
  if (!init) try { init = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (init) { init = V.clean(init); delete init.x; state = Object.assign(state, init); if (!init.s) state.s = ''; if (!init.w) state.w = ''; }

  var TEXT = ['n', 't', 'c', 'i', 'm', 'z', 'tg'];
  TEXT.forEach(function (k) { if (state[k]) f.elements[k].value = state[k]; });
  if (state.tg) f.elements.tg.value = '@' + state.tg;
  if (state.p) f.elements.p.value = V.fmtPhone(state.p);
  if (state.pr) f.elements.pr.value = V.fmtNum(state.pr);

  function chips(el, items, attr) {
    el.innerHTML = items.map(function (x) { return '<button type="button" class="qchip" ' + attr + '="' + V.esc(x.v) + '" aria-pressed="false">' + V.esc(x.l) + '</button>'; }).join('');
  }
  var cap = document.getElementById('cap'), svc = document.getElementById('svc'), ex = document.getElementById('ex'), pay = document.getElementById('pay'), pu = document.getElementById('pu'), themes = document.getElementById('themes');
  chips(cap, V.CAPACITY.map(function (c) { return { v: c, l: 'до ' + c }; }), 'data-v');
  chips(svc, V.SERVICES.map(function (s, i) { return { v: i, l: s }; }), 'data-i');
  chips(ex, V.EXTRAS.map(function (k, i) { return { v: 1 << i, l: V.t(k) }; }), 'data-bit');
  chips(pay, V.PAYMENTS.map(function (k, i) { return { v: 1 << (i + 3), l: V.t(k) }; }), 'data-bit');
  themes.innerHTML = V.THEMES.map(function (n, i) { return '<button type="button" class="sw th-' + i + '" data-th="' + i + '" aria-pressed="false"><i></i><span>' + V.esc(n) + '</span></button>'; }).join('');

  var hs = f.elements.hs, he = f.elements.he, h24 = document.getElementById('h24');
  var opt = function (h) { return '<option value="' + h + '">' + ('0' + h).slice(-2) + ':00</option>'; };
  var o1 = '<option value="">с …</option>', o2 = '<option value="">до …</option>';
  for (var h = 0; h < 24; h++) o1 += opt(h);
  for (h = 1; h <= 24; h++) o2 += opt(h);
  hs.innerHTML = o1; he.innerHTML = o2;
  if (state.hs != null) { hs.value = state.hs; he.value = state.he; }

  cap.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; state.w = state.w === b.dataset.v ? '' : b.dataset.v; update(); });
  svc.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var i = b.dataset.i, s = state.s || '';
    state.s = s.indexOf(i) >= 0 ? s.replace(i, '') : (s + i).split('').sort().join('');
    update();
  });
  [ex, pay].forEach(function (el) { el.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; state.f = (state.f || 0) ^ +b.dataset.bit; update(); }); });
  pu.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; state.pu = +b.dataset.v; update(); });
  themes.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; state.th = +b.dataset.th; update(); });
  h24.addEventListener('click', function () {
    if (hs.value === '0' && he.value === '24') { hs.value = ''; he.value = ''; } else { hs.value = '0'; he.value = '24'; }
    update();
  });

  var phone = f.elements.p;
  phone.addEventListener('input', function () {
    var d = phone.value.replace(/\D/g, '');
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d && d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);
    var o = d ? '+7' : '';
    if (d.length > 1) o += ' ' + d.slice(1, 4);
    if (d.length > 4) o += ' ' + d.slice(4, 7);
    if (d.length > 7) o += ' ' + d.slice(7, 9);
    if (d.length > 9) o += ' ' + d.slice(9, 11);
    phone.value = o;
  });
  f.elements.pr.addEventListener('input', function () { f.elements.pr.value = V.fmtNum(f.elements.pr.value.replace(/\D/g, '').slice(0, 9)); });
  f.addEventListener('input', update);
  f.addEventListener('change', update);
  f.addEventListener('submit', function (e) { e.preventDefault(); });

  var link = '', d = {}, seq = 0;
  var pvwrap = document.getElementById('pvwrap');
  function on(el, test) { el.querySelectorAll('button').forEach(function (b) { var v = test(b); b.classList.toggle('on', v); b.setAttribute('aria-pressed', v); }); }
  function update() {
    TEXT.forEach(function (k) { state[k] = f.elements[k].value.trim(); });
    state.p = V.normPhone(phone.value);
    state.pr = f.elements.pr.value;
    state.hs = hs.value; state.he = he.value;
    d = V.clean(state);
    document.getElementById('cnt').textContent = (state.m || '').length + '/80';
    on(cap, function (b) { return b.dataset.v === state.w; });
    on(svc, function (b) { return (state.s || '').indexOf(b.dataset.i) >= 0; });
    on(ex, function (b) { return !!((state.f || 0) & +b.dataset.bit); });
    on(pay, function (b) { return !!((state.f || 0) & +b.dataset.bit); });
    on(pu, function (b) { return +b.dataset.v === (state.pu || 0); });
    on(themes, function (b) { return +b.dataset.th === (state.th || 0); });
    h24.classList.toggle('on', d.hs === 0 && d.he === 24);
    f.elements.i.classList.toggle('bad', !!state.i && !/^https:\/\//i.test(state.i));
    f.elements.tg.classList.toggle('bad', !!state.tg && !d.tg);
    V.applyTheme(pvwrap, d.th);
    document.getElementById('pv').innerHTML = V.cardHero(d, true);
    document.getElementById('pvtg').hidden = !d.tg;
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}

    var ok = !!(d.n && d.p);
    document.getElementById('rbody').classList.toggle('locked', !ok);
    document.getElementById('rhint').textContent = ok
      ? 'Отправьте ссылку клиентам, покажите QR или распечатайте визитки.'
      : 'Укажите имя и номер WhatsApp — появятся ссылка и QR.';
    if (!ok) { link = ''; setLink(''); return; }
    var my = ++seq;
    setLink(V.cardUrl(d));
    V.cardUrlAsync(d).then(function (u) { if (my === seq) setLink(u); });
  }
  function setLink(u) {
    link = u;
    document.getElementById('link').value = u || 'Здесь появится ваша ссылка';
    document.getElementById('open').href = u || '#';
    document.getElementById('qr').innerHTML = V.qrSvg(u || 'https://example.com');
    document.getElementById('result').dataset.len = u.length;
  }
  update();

  document.getElementById('copy').addEventListener('click', function () { if (link) V.copy(link); });
  document.getElementById('share').addEventListener('click', function () {
    if (link) V.share('Моя визитка — ' + d.n, 'Грузоперевозки: ' + d.n + '. Заказ в WhatsApp:', link);
  });
  document.getElementById('png').addEventListener('click', function () {
    if (!link) return;
    V.download('qr-' + V.fileName(d.n) + '.png', V.qrPng(link, d.n + (d.c ? ' · ' + d.c : ''), 'Грузоперевозки · ' + V.fmtPhone(d.p)));
  });
  V.bindInstall(document.getElementById('install'));

  var area = document.getElementById('print-area');
  function cardBlock() {
    var sv = V.services(d).slice(0, 5).join(' · ');
    var extra = [V.priceText(d), V.hoursText(d)].filter(Boolean).join(' · ');
    return '<div class="pc"><div><div class="b">Грузоперевозки</div><div class="n">' + V.esc(d.n) + '</div>' +
      '<div class="m">' + V.esc(V.metaLine(d)) + '</div>' + (sv ? '<div class="s">' + V.esc(sv) + '</div>' : '') +
      (extra ? '<div class="s">' + V.esc(extra) + '</div>' : '') +
      '<div class="p">' + V.esc(V.fmtPhone(d.p)) + '</div><div class="w">WhatsApp · звонки' + (d.tg ? ' · t.me/' + V.esc(d.tg) : '') + '</div></div>' +
      '<div class="q">' + V.qrSvg(link, '#0b0b1f', '#ffffff') + '<i>визитка и заказ</i></div></div>';
  }
  document.getElementById('pcards').addEventListener('click', function () {
    if (!link) return;
    var one = cardBlock(), html = ''; for (var i = 0; i < 10; i++) html += one;
    area.innerHTML = '<div class="pc-sheet">' + html + '</div>'; window.print();
  });
  document.getElementById('psticker').addEventListener('click', function () {
    if (!link) return;
    area.innerHTML = '<div class="st"><div><div class="t1">ГРУЗОПЕРЕВОЗКИ</div><div class="t2">' + V.esc(V.metaLine(d) || 'до 3 тонн') + '</div></div>' +
      '<div class="q">' + V.qrSvg(link, '#0b0b1f', '#ffffff') + '</div><div class="t3">Наведите камеру — закажите в WhatsApp</div>' +
      '<div><div class="p">' + V.esc(V.fmtPhone(d.p)) + '</div><div class="n">' + V.esc(d.n) + '</div></div></div>';
    window.print();
  });
})();
