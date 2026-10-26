(function () {
  'use strict';
  var V = window.VEZU, q = new URLSearchParams(location.search), d = null;
  if (q.has('demo')) d = V.DEMO;
  else if (q.get('d')) d = V.decodeCard(q.get('d'));
  var app = document.getElementById('app');
  if (!d || !d.n) {
    app.innerHTML = '<div class="err glass"><h1>Визитка не найдена</h1><p class="muted">Похоже, ссылка обрезана или скопирована не полностью. Попросите водителя прислать её ещё раз.</p>' +
      '<div class="btns" style="justify-content:center;margin-top:20px"><a class="btn btn-grad" href="new.html">Создать свою визитку</a><a class="btn btn-glass" href="./">На главную</a></div></div>';
    return;
  }
  var url = V.cardUrl(d);
  document.title = d.n + (d.c ? ' · ' + d.c : '') + ' — грузоперевозки | ВЕЗУ';
  document.getElementById('hero').innerHTML = V.cardHero(d);

  var hello = 'Здравствуйте, ' + d.n.split(' ')[0] + '! Нашёл(ла) вашу визитку. Нужна перевозка.';
  var wa = document.getElementById('wa'), call = document.getElementById('call');
  V.bindWaLink(wa, d.p, hello);
  call.href = 'tel:+' + d.p;
  if (!d.p) { wa.setAttribute('disabled', ''); call.setAttribute('disabled', ''); }

  V.bindOrderForm(document.getElementById('order'), function () { return d.p; }, function () { return d.n; });

  document.getElementById('vcf').addEventListener('click', function () {
    V.download(V.fileName(d.n) + '.vcf', V.vcf(d, url), 'text/vcard;charset=utf-8');
  });
  document.getElementById('qr').innerHTML = V.qrSvg(url);
  var shareText = 'Грузоперевозки: ' + d.n + (V.metaLine(d) ? ' (' + V.metaLine(d) + ')' : '') + '. Пишите в WhatsApp:';
  document.getElementById('share').addEventListener('click', function () { V.share(document.title, shareText, url); });
  document.getElementById('copy').addEventListener('click', function () { V.copy(url); });
})();
