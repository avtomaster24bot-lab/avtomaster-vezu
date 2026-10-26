/* ВЕЗУ — общие функции: кодирование визитки, WhatsApp, QR, vCard */
(function () {
  'use strict';

  // Номер WhatsApp для заявок с главной страницы (только цифры, например 77001234567).
  // Пусто — WhatsApp предложит выбрать, кому отправить заявку.
  var SITE_PHONE = '77714105797';

  var SERVICES = ['Переезды', 'Стройматериалы', 'Мебель', 'Вывоз мусора', 'Грузчики', 'Бытовая техника', 'Межгород', 'Мелкий груз'];
  var CAPACITY = ['0,5 т', '1 т', '1,5 т', '2 т', '3 т'];

  var DEMO = { n: 'Имя Водителя', p: '77000000000', c: 'Газель', w: '1,5 т', t: 'Алматы', s: '01234', m: 'Пример визитки — данные вымышленные', x: 1 };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function b64urlEncode(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function clean(d) {
    d = d || {};
    var out = {};
    ['n', 'c', 'w', 't', 'm', 'i'].forEach(function (k) { if (d[k]) out[k] = String(d[k]).trim().slice(0, k === 'i' ? 300 : 80); });
    var p = normPhone(d.p); if (p) out.p = p;
    if (d.s) out.s = String(d.s).replace(/[^0-9]/g, '');
    if (out.i && !/^https:\/\//i.test(out.i)) delete out.i;
    if (d.x) out.x = 1;
    return out;
  }
  function encodeCard(d) { return b64urlEncode(JSON.stringify(clean(d))); }
  function decodeCard(code) {
    try { return clean(JSON.parse(b64urlDecode(code))); } catch (e) { return null; }
  }

  function baseUrl() { return location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, ''); }
  function cardUrl(d) { return d && d.x ? baseUrl() + 'card.html?demo' : baseUrl() + 'card.html?d=' + encodeCard(d); }

  function normPhone(p) {
    var d = String(p || '').replace(/\D/g, '');
    if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
    if (d.length === 10) d = '7' + d;
    return /^7\d{10}$/.test(d) ? d : '';
  }
  function fmtPhone(d) {
    d = normPhone(d); if (!d) return '';
    return '+7 ' + d.slice(1, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7, 9) + ' ' + d.slice(9, 11);
  }
  function waLink(phone, text) {
    var p = normPhone(phone);
    return 'https://wa.me/' + p + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  // ---- WhatsApp: открываем приложение напрямую на мобильных (в т.ч. из Telegram/Instagram) ----
  var UA = navigator.userAgent || '';
  var IS_ANDROID = /Android/i.test(UA);
  var IS_IOS = /iPhone|iPad|iPod/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var IS_MOBILE = IS_ANDROID || IS_IOS;
  function inAppBrowser() {
    return !!(window.TelegramWebviewProxy || window.TelegramWebview || window.TelegramWebviewProxyProto ||
      /Telegram|FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|MicroMessenger|VKClient|OKApp|; wv\)/i.test(UA));
  }
  function waQuery(phone, text) {
    var p = normPhone(phone), q = [];
    if (p) q.push('phone=' + p);
    if (text) q.push('text=' + encodeURIComponent(text));
    return q.join('&');
  }
  function waApp(phone, text) { return 'whatsapp://send?' + waQuery(phone, text); }
  function waApi(phone, text) { return 'https://api.whatsapp.com/send?' + waQuery(phone, text); }
  function waIntent(phone, text) {
    return 'intent://send?' + waQuery(phone, text) + '#Intent;scheme=whatsapp;S.browser_fallback_url=' + encodeURIComponent(waApi(phone, text)) + ';end';
  }
  // Ссылка для href кнопки: на телефоне — сразу приложение, на компьютере — wa.me
  function waHref(phone, text) {
    if (IS_ANDROID) return waIntent(phone, text);
    if (IS_IOS) return waApp(phone, text);
    return waLink(phone, text);
  }
  function nav(u) { VEZU._nav(u); }
  var waTimer = null;
  // Вызывать только из обработчика нажатия (жест пользователя)
  function openWA(phone, text) {
    if (!IS_MOBILE) { window.open(waLink(phone, text), '_blank', 'noopener'); return; }
    hideWaHint();
    var left = false, mark = function () { left = true; };
    document.addEventListener('visibilitychange', function h() { if (document.hidden) mark(); document.removeEventListener('visibilitychange', h); });
    window.addEventListener('pagehide', mark, { once: true });
    window.addEventListener('blur', mark, { once: true });
    nav(waHref(phone, text));
    clearTimeout(waTimer);
    waTimer = setTimeout(function () {
      if (left || document.hidden) return;
      if (inAppBrowser() || IS_ANDROID) showWaHint(phone, text);
      else nav(waApi(phone, text));
    }, IS_ANDROID ? 1800 : 2000);
  }
  function hideWaHint() { var h = document.querySelector('.wa-hint'); if (h) h.remove(); }
  function showWaHint(phone, text) {
    hideWaHint();
    var p = normPhone(phone);
    var h = document.createElement('div'); h.className = 'wa-hint'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-label', 'WhatsApp не открылся');
    h.innerHTML = '<button type="button" class="wa-x" aria-label="Закрыть">×</button>' +
      (inAppBrowser()
        ? '<p><b>Если WhatsApp не открылся</b> — нажмите <b>⋮</b> (или «…») вверху и выберите «Открыть в браузере».</p>'
        : '<p><b>Если WhatsApp не открылся</b> — нажмите «Открыть WhatsApp» ещё раз или скопируйте номер.</p>') +
      '<div class="wa-hint-btns">' +
      '<a class="btn btn-wa btn-sm" data-act="retry" href="' + esc(waApp(phone, text)) + '">Открыть WhatsApp</a>' +
      (p ? '<button type="button" class="btn btn-glass btn-sm" data-act="copy">Скопировать номер</button>' : '') +
      '<a class="btn btn-glass btn-sm" data-act="web" href="' + esc(waApi(phone, text)) + '">Через сайт WhatsApp</a>' +
      '</div>';
    document.body.appendChild(h);
    h.querySelector('.wa-x').addEventListener('click', hideWaHint);
    var cp = h.querySelector('[data-act=copy]');
    if (cp) cp.addEventListener('click', function () { copy('+' + p, 'Номер скопирован: ' + fmtPhone(p)); });
    h.querySelector('[data-act=retry]').addEventListener('click', function (e) { e.preventDefault(); nav(waApp(phone, text)); });
  }
  // Привязать <a> к WhatsApp: рабочий href + открытие приложения по нажатию
  function bindWaLink(a, phone, text) {
    a.href = waHref(phone, text);
    if (IS_MOBILE) a.removeAttribute('target');
    a.addEventListener('click', function (e) { if (IS_MOBILE) { e.preventDefault(); openWA(phone, text); } });
  }

  function fmtPrice(v) {
    var n = String(v || '').replace(/\D/g, '');
    return n ? Number(n).toLocaleString('ru-RU').replace(/\u00a0/g, ' ') + ' ₸' : '';
  }

  function orderText(o, toName) {
    var lines = [toName ? 'Здравствуйте, ' + String(toName).split(' ')[0] + '! Нужна перевозка.' : 'Здравствуйте! Нужна грузоперевозка.'];
    if (o.from) lines.push('Откуда: ' + o.from);
    if (o.geo) {
      lines.push('Точка на карте (2ГИС): ' + gisLink(o.geo));
      lines.push('Google Maps: ' + gmapsLink(o.geo));
    }
    if (o.to) lines.push('Куда: ' + o.to);
    if (o.what) lines.push('Что везём: ' + o.what);
    if (o.when) lines.push('Когда: ' + o.when);
    if (o.price) lines.push('Моя цена: ' + fmtPrice(o.price));
    return lines.join('\n');
  }

  function gisLink(g) { return 'https://2gis.kz/geo/' + g.lon.toFixed(6) + ',' + g.lat.toFixed(6); }
  function gmapsLink(g) { return 'https://maps.google.com/?q=' + g.lat.toFixed(6) + ',' + g.lon.toFixed(6); }

  // Геолокация: «Где я» → координаты → короткий адрес (Nominatim)
  var GEO_ERR = {
    1: 'Доступ к геопозиции запрещён. Разрешите его: нажмите на значок слева от адреса сайта (замок или «ⓘ») → «Разрешения» → «Геоданные» → «Разрешить» и снова нажмите «Где я». На iPhone: Настройки → Конфиденциальность → Службы геолокации → включите их и разрешите для Safari/браузера.',
    2: 'Не удалось определить, где вы. Включите геолокацию (GPS) на телефоне и попробуйте ещё раз — или впишите адрес вручную.',
    3: 'Телефон слишком долго искал вас. Попробуйте ещё раз (лучше у окна или на улице) — или впишите адрес вручную.',
    0: 'Этот браузер не умеет определять местоположение. Впишите адрес вручную.'
  };
  function shortAddress(j) {
    var a = (j && j.address) || {};
    var street = a.road || a.pedestrian || a.footway || a.residential || '';
    var place = street ? street + (a.house_number ? ', ' + a.house_number : '') : (a.neighbourhood || a.suburb || a.quarter || a.hamlet || a.village || '');
    var city = a.city || a.town || a.village || a.county || a.state || '';
    var r = [place, city !== place ? city : ''].filter(Boolean).join(', ');
    if (!r && j && j.display_name) r = j.display_name.split(',').slice(0, 3).join(',').trim();
    return r;
  }
  function reverseGeocode(lat, lon) {
    var ctl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, 7000);
    return fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=ru&zoom=18&addressdetails=1&lat=' + lat + '&lon=' + lon, ctl ? { signal: ctl.signal } : {})
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) { clearTimeout(t); return shortAddress(j); });
  }
  var PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="9.5" r="2.6" fill="currentColor"/></svg>';
  function bindGeo(form) {
    var from = form.querySelector('[name=from]'); if (!from) return;
    var label = from.closest('label');
    label.classList.add('has-geo');
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'geo-btn'; btn.setAttribute('aria-label', 'Определить, где я');
    btn.innerHTML = PIN + '<span>Где я</span>';
    label.appendChild(btn);
    var msg = document.createElement('div'); msg.className = 'geo-msg'; msg.setAttribute('aria-live', 'polite'); msg.hidden = true;
    var route = form.querySelector('.route') || label;
    route.parentNode.insertBefore(msg, route.nextSibling);
    function show(html, err) { msg.innerHTML = html; msg.hidden = !html; msg.classList.toggle('geo-err', !!err); }
    function showMap() {
      var g = form._geo;
      show(g ? '<span>📍 Точка сохранена — водитель получит ссылку на карту.</span> <a href="' + esc(gisLink(g)) + '" target="_blank" rel="noopener">На карте</a>' : '');
    }
    from.addEventListener('input', function () {
      if (form._geo && !from.value.trim()) { form._geo = null; show(''); }
    });
    btn.addEventListener('click', function () {
      if (!navigator.geolocation) { show(esc(GEO_ERR[0]), true); return; }
      btn.classList.add('busy'); btn.disabled = true; btn.querySelector('span').textContent = 'Ищу…';
      show('');
      var done = function () { btn.classList.remove('busy'); btn.disabled = false; btn.querySelector('span').textContent = 'Где я'; };
      navigator.geolocation.getCurrentPosition(function (pos) {
        var g = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        var coords = g.lat.toFixed(5) + ', ' + g.lon.toFixed(5);
        reverseGeocode(g.lat, g.lon).then(function (addr) { return addr || coords; }, function () { return coords; }).then(function (addr) {
          from.value = addr; form._geo = g; done(); showMap();
          from.dispatchEvent(new Event('change'));
        });
      }, function (e) {
        done(); show(esc(GEO_ERR[e && e.code] || GEO_ERR[2]), true);
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
    });
  }

  function services(d) {
    return String(d.s || '').split('').map(function (i) { return SERVICES[+i]; }).filter(Boolean);
  }
  function initials(name) {
    var w = String(name || '').trim().split(/\s+/).filter(Boolean);
    return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase();
  }
  function metaLine(d) {
    return [d.c, d.w ? 'до ' + d.w : '', d.t].filter(Boolean).join(' · ');
  }

  // Лицевая сторона визитки (используется на card.html и в превью конструктора)
  function cardHero(d, placeholder) {
    var name = d.n || (placeholder ? 'Ваше имя' : 'Водитель');
    var meta = metaLine(d) || (placeholder ? 'Машина · до 1,5 т · Город' : '');
    var sv = services(d);
    var av = '<div class="av"><span>' + esc(initials(name)) + '</span>' +
      (d.i ? '<img src="' + esc(d.i) + '" alt="" referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '</div>';
    return '<div class="hero-card">' +
      '<div class="hc-top"><span class="hc-tag">Грузоперевозки до 3 т</span>' + (d.x ? '<span class="hc-demo">Пример</span>' : '') + '</div>' +
      av +
      '<h1 class="hc-name">' + esc(name) + '</h1>' +
      (meta ? '<p class="hc-meta">' + esc(meta) + '</p>' : '') +
      (d.p ? '<p class="hc-phone">' + esc(fmtPhone(d.p)) + '</p>' : (placeholder ? '<p class="hc-phone muted">+7 ··· ··· ·· ··</p>' : '')) +
      (sv.length ? '<ul class="chips">' + sv.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '') +
      (d.m ? '<p class="hc-note">' + esc(d.m) + '</p>' : '') +
      '</div>';
  }

  // QR
  function makeQR(text) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    var q = qrcode(0, 'L'); q.addData(text, 'Byte'); q.make(); return q;
  }
  function qrSvg(text, fg, bg) {
    var q = makeQR(text), n = q.getModuleCount(), m = 2, path = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) path += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
    var s = n + m * 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + s + ' ' + s + '" shape-rendering="crispEdges" role="img" aria-label="QR-код визитки">' +
      '<rect width="' + s + '" height="' + s + '" fill="' + (bg || '#fff') + '"/><path d="' + path + '" fill="' + (fg || '#0b0b1f') + '"/></svg>';
  }
  function qrPng(text, caption, sub) {
    var q = makeQR(text), n = q.getModuleCount(), quiet = 4, cell = Math.max(8, Math.floor(880 / (n + quiet * 2)));
    var qs = (n + quiet * 2) * cell, capH = caption ? 170 : 0;
    var cv = document.createElement('canvas'); cv.width = qs; cv.height = qs + capH;
    var g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#0b0b1f';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    if (caption) {
      g.textAlign = 'center';
      g.font = '800 54px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      g.fillText(caption, qs / 2, qs + 40);
      if (sub) { g.fillStyle = '#5a5a7a'; g.font = '500 36px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'; g.fillText(sub, qs / 2, qs + 100); }
    }
    return cv.toDataURL('image/png');
  }

  // vCard
  function vcf(d, url) {
    var e = function (s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'); };
    var L = ['BEGIN:VCARD', 'VERSION:3.0', 'N:;' + e(d.n) + ';;;', 'FN:' + e(d.n),
      'ORG:' + e('Грузоперевозки' + (d.c ? ' — ' + d.c : '')),
      'TITLE:' + e(metaLine(d))];
    if (d.p) L.push('TEL;TYPE=CELL:+' + d.p);
    if (d.t) L.push('ADR;TYPE=WORK:;;;' + e(d.t) + ';;;Казахстан');
    if (url) L.push('URL:' + url);
    var sv = services(d); if (sv.length || d.m) L.push('NOTE:' + e([sv.join(', '), d.m].filter(Boolean).join('. ')));
    L.push('END:VCARD');
    return L.join('\r\n') + '\r\n';
  }
  function download(name, data, type) {
    var a = document.createElement('a');
    a.href = typeof data === 'string' && data.indexOf('data:') === 0 ? data : URL.createObjectURL(new Blob([data], { type: type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); }, 1000);
  }
  function fileName(s) { return (String(s || 'vizitka').trim().replace(/[\\/:*?"<>|\s]+/g, '_') || 'vizitka'); }

  function toast(msg) {
    var t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function copy(text, okMsg) {
    var done = function () { toast(okMsg || 'Ссылка скопирована'); };
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    fallbackCopy(text); done();
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove();
  }
  function share(title, text, url) {
    if (navigator.share) return navigator.share({ title: title, text: text, url: url }).catch(function () {});
    copy(url);
  }

  // Мини-форма заказа: собирает поля и открывает WhatsApp
  function bindOrderForm(form, getPhone, getName) {
    bindGeo(form);
    form.querySelectorAll('[data-fill]').forEach(function (b) {
      b.addEventListener('click', function () {
        var inp = form.querySelector('[name="' + b.dataset.fill + '"]');
        inp.value = b.dataset.v || b.textContent.trim();
        form.querySelectorAll('[data-fill="' + b.dataset.fill + '"]').forEach(function (x) { x.classList.toggle('on', x === b); });
        inp.dispatchEvent(new Event('input'));
      });
    });
    var price = form.querySelector('[name=price]');
    if (price) price.addEventListener('input', function () {
      var n = price.value.replace(/\D/g, '').slice(0, 9);
      price.value = n ? Number(n).toLocaleString('ru-RU').replace(/\u00a0/g, ' ') : '';
    });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var o = {}; ['from', 'to', 'what', 'when', 'price'].forEach(function (k) { var i = form.querySelector('[name=' + k + ']'); o[k] = i ? i.value.trim() : ''; });
      if (form._geo && o.from) o.geo = form._geo;
      if (!o.from && !o.to && !o.what) { toast('Укажите хотя бы, что и куда везём'); (form.querySelector('[name=what]') || form.querySelector('input')).focus(); return; }
      openWA(getPhone(), orderText(o, getName && getName()));
    });
  }

  var VEZU = window.VEZU = {
    SITE_PHONE: SITE_PHONE, SERVICES: SERVICES, CAPACITY: CAPACITY, DEMO: DEMO,
    esc: esc, encodeCard: encodeCard, decodeCard: decodeCard, cardUrl: cardUrl, clean: clean,
    normPhone: normPhone, fmtPhone: fmtPhone, waLink: waLink, waApp: waApp, waApi: waApi, waIntent: waIntent, waHref: waHref, openWA: openWA, bindWaLink: bindWaLink, inAppBrowser: inAppBrowser,
    IS_MOBILE: IS_MOBILE, IS_ANDROID: IS_ANDROID, IS_IOS: IS_IOS, _nav: function (u) { location.href = u; }, gisLink: gisLink, gmapsLink: gmapsLink, fmtPrice: fmtPrice, orderText: orderText,
    services: services, initials: initials, metaLine: metaLine, cardHero: cardHero,
    qrSvg: qrSvg, qrPng: qrPng, vcf: vcf, download: download, fileName: fileName,
    toast: toast, copy: copy, share: share, bindOrderForm: bindOrderForm
  };
})();
