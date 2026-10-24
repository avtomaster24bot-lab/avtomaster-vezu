(function () {
  'use strict';
  var V = window.VEZU, f = document.getElementById('f'), KEY = 'vezu-card';
  var state = { w: '1,5 т', s: '012' };

  // начальные данные: ?d=… → localStorage → по умолчанию
  var q = new URLSearchParams(location.search), init = null;
  if (q.get('d')) init = V.decodeCard(q.get('d'));
  if (!init) try { init = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (init) state = Object.assign(state, V.clean(init));
  delete state.x;

  ['n', 't', 'c', 'i', 'm'].forEach(function (k) { if (state[k]) f.elements[k].value = state[k]; });
  if (state.p) f.elements.p.value = V.fmtPhone(state.p);

  var cap = document.getElementById('cap');
  cap.innerHTML = V.CAPACITY.map(function (c) { return '<button type="button" class="qchip" data-v="' + c + '">до ' + c + '</button>'; }).join('');
  var svc = document.getElementById('svc');
  svc.innerHTML = V.SERVICES.map(function (s, i) { return '<button type="button" class="qchip" data-i="' + i + '" aria-pressed="false">' + V.esc(s) + '</button>'; }).join('');

  cap.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    state.w = state.w === b.dataset.v ? '' : b.dataset.v; update();
  });
  svc.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var i = b.dataset.i, s = state.s || '';
    state.s = s.indexOf(i) >= 0 ? s.replace(i, '') : (s + i).split('').sort().join('');
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
  f.addEventListener('input', update);
  f.addEventListener('submit', function (e) { e.preventDefault(); });

  var link = '', d = {};
  function update() {
    ['n', 't', 'c', 'i', 'm'].forEach(function (k) { state[k] = f.elements[k].value.trim(); });
    state.p = V.normPhone(phone.value);
    d = V.clean(state);
    document.getElementById('cnt').textContent = (state.m || '').length + '/80';
    cap.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === state.w); });
    svc.querySelectorAll('button').forEach(function (b) { var on = (state.s || '').indexOf(b.dataset.i) >= 0; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    f.elements.i.classList.toggle('bad', !!state.i && !/^https:\/\//i.test(state.i));
    document.getElementById('pv').innerHTML = V.cardHero(d, true);
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}

    var ok = !!(d.n && d.p);
    document.getElementById('rbody').classList.toggle('locked', !ok);
    document.getElementById('rhint').textContent = ok
      ? 'Отправьте ссылку клиентам, покажите QR или распечатайте визитки.'
      : 'Укажите имя и номер WhatsApp — появятся ссылка и QR.';
    link = ok ? V.cardUrl(d) : '';
    document.getElementById('link').value = link || 'Здесь появится ваша ссылка';
    document.getElementById('open').href = link || '#';
    document.getElementById('qr').innerHTML = V.qrSvg(link || 'https://example.com');
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

  var area = document.getElementById('print-area');
  function cardBlock() {
    var sv = V.services(d).slice(0, 5).join(' · ');
    return '<div class="pc"><div><div class="b">Грузоперевозки</div><div class="n">' + V.esc(d.n) + '</div>' +
      '<div class="m">' + V.esc(V.metaLine(d)) + '</div>' + (sv ? '<div class="s">' + V.esc(sv) + '</div>' : '') +
      '<div class="p">' + V.esc(V.fmtPhone(d.p)) + '</div><div class="w">WhatsApp · звонки</div></div>' +
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
