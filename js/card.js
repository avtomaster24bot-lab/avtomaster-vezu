(function () {
  'use strict';
  var V = window.VEZU, d = V.readCard();
  var app = document.getElementById('app');
  var langBtns = document.querySelectorAll('[data-lang]');
  function markLang() { langBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === V.lang())); }); }
  V.setLang(V.savedLang()); markLang();

  if (!d || !d.n) {
    var renderErr = function () {
      app.innerHTML = '<div class="err glass"><h1>' + V.esc(V.t('nf_t')) + '</h1><p class="muted">' + V.esc(V.t('nf_s')) + '</p>' +
        '<div class="btns" style="justify-content:center;margin-top:20px"><a class="btn btn-grad" href="new.html">' + V.esc(V.t('nf_new')) + '</a><a class="btn btn-glass" href="./">' + V.esc(V.t('nf_home')) + '</a></div></div>';
    };
    renderErr();
    langBtns.forEach(function (b) { b.addEventListener('click', function () { V.setLang(b.dataset.lang, true); markLang(); renderErr(); }); });
    return;
  }

  V.applyTheme(document.documentElement, d.th);
  var url = V.cardUrl(d);
  document.title = d.n + (d.c ? ' · ' + d.c : '') + ' — грузоперевозки | ВЕЗУ';
  var hero = document.getElementById('hero'), det = document.getElementById('details');
  function render() {
    hero.innerHTML = V.cardHero(d);
    var html = V.cardDetails(d);
    det.innerHTML = html ? '<h2>' + V.esc(V.t('details')) + '</h2>' + html : '';
    det.hidden = !html;
  }
  render();
  if (d.hs != null) setInterval(function () { hero.innerHTML = V.cardHero(d); }, 60000);

  var hello = 'Здравствуйте, ' + d.n.split(' ')[0] + '! Нашёл(ла) вашу визитку. Нужна перевозка.';
  var wa = document.getElementById('wa'), call = document.getElementById('call'), tg = document.getElementById('tg');
  V.bindWaLink(wa, d.p, hello);
  call.href = 'tel:+' + d.p;
  if (!d.p) { wa.setAttribute('disabled', ''); call.setAttribute('disabled', ''); }
  if (d.tg) { tg.href = 'https://t.me/' + d.tg; tg.hidden = false; }

  V.bindOrderForm(document.getElementById('order'), function () { return d.p; }, function () { return d.n; });

  document.getElementById('vcf').addEventListener('click', function () {
    V.download(V.fileName(d.n) + '.vcf', V.vcf(d, url), 'text/vcard;charset=utf-8');
  });
  V.cardUrlAsync(d).then(function (u) { url = u; V.cardManifest(d, url); });
  function showQR() {
    var s = V.sheet(V.t('qr_t'), '<p class="muted">' + V.esc(V.t('qr_s')) + '</p><div class="qr qr-big" id="qrsheet">' + V.qrSvg(url) + '</div>' +
      '<button type="button" class="btn btn-glass btn-block" id="qrcopy"><svg><use href="#i-link"/></svg>' + V.esc(V.t('copy')) + '</button>', 'sheet-qr');
    s.el.querySelector('#qrcopy').addEventListener('click', function () { V.copy(url); });
  }
  document.getElementById('qrbtn').addEventListener('click', showQR);
  document.getElementById('share').addEventListener('click', function () {
    V.share(document.title, 'Грузоперевозки: ' + d.n + (d.c ? ' (' + d.c + ')' : '') + '. Пишите в WhatsApp:', url);
  });
  V.editUrl(d).then(function (u) { document.getElementById('edit').href = u; });
  V.bindInstall(document.getElementById('install'));
  document.getElementById('made').href = 'new.html';

  langBtns.forEach(function (b) {
    b.addEventListener('click', function () { V.setLang(b.dataset.lang, true); markLang(); render(); });
  });
})();
