(function(){
  // burger
  var burger=document.getElementById('burger'),nav=document.getElementById('nav');
  burger.addEventListener('click',function(){var o=nav.classList.toggle('open');burger.setAttribute('aria-expanded',o)});
  nav.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){nav.classList.remove('open');burger.setAttribute('aria-expanded',false)})});

  document.getElementById('year').textContent=new Date().getFullYear();

  // date min = today
  var d=document.getElementById('date'),t=new Date();
  var iso=new Date(t.getTime()-t.getTimezoneOffset()*6e4).toISOString().slice(0,10);
  d.min=iso; d.value=iso;

  // phone mask +7 (XXX) XXX-XX-XX
  function maskPhone(el){
    el.addEventListener('input',function(){
      var v=el.value.replace(/\D/g,'');
      if(v[0]==='8')v='7'+v.slice(1);
      if(v&&v[0]!=='7')v='7'+v;
      v=v.slice(0,11);
      var r='';
      if(v.length>0)r='+7';
      if(v.length>1)r+=' ('+v.slice(1,4);
      if(v.length>=4)r+=')';
      if(v.length>4)r+=' '+v.slice(4,7);
      if(v.length>7)r+='-'+v.slice(7,9);
      if(v.length>9)r+='-'+v.slice(9,11);
      el.value=r;
    });
    el.addEventListener('focus',function(){if(!el.value)el.value='+7 ('});
    el.addEventListener('blur',function(){if(el.value.replace(/\D/g,'').length<=1)el.value=''});
  }
  document.querySelectorAll('input[type=tel]').forEach(maskPhone);

  function setErr(el,msg){
    var f=el.closest('.field'); if(!f)return;
    f.classList.toggle('invalid',!!msg);
    var e=f.querySelector('.err'); if(e)e.textContent=msg||'';
  }
  function phoneOk(v){return v.replace(/\D/g,'').length===11}

  var rules={
    from:function(v){return v.trim().length<3?'Укажите адрес отправления':''},
    to:function(v){return v.trim().length<3?'Укажите адрес доставки':''},
    cargo:function(v){return !v?'Выберите тип груза':''},
    weight:function(v){var n=+v;if(!v)return'Укажите вес';if(n<1)return'Вес должен быть больше 0';if(n>3000)return'Мы возим грузы до 3000 кг';return''},
    date:function(v){if(!v)return'Выберите дату';if(v<iso)return'Дата не может быть в прошлом';return''},
    price:function(v){var n=+v;if(!v)return'Предложите цену';if(n<300)return'Минимальная сумма — 300 ₽';return''},
    phone:function(v){return phoneOk(v)?'':'Введите номер в формате +7 (XXX) XXX-XX-XX'},
    name:function(v){return v.trim().length<2?'Введите имя':''},
    city:function(v){return v.trim().length<2?'Укажите город':''},
    car:function(v){return !v?'Выберите тип машины':''}
  };

  function validate(form){
    var ok=true,first=null;
    form.querySelectorAll('input[name],select[name]').forEach(function(el){
      var r=rules[el.name]; if(!r)return;
      var m=r(el.value); setErr(el,m);
      if(m){ok=false;if(!first)first=el}
    });
    if(first)first.focus();
    return ok;
  }
  document.querySelectorAll('form').forEach(function(form){
    form.querySelectorAll('input[name],select[name]').forEach(function(el){
      var ev=el.tagName==='SELECT'||el.type==='date'?'change':'input';
      el.addEventListener(ev,function(){var f=el.closest('.field');if(f&&f.classList.contains('invalid')&&rules[el.name])setErr(el,rules[el.name](el.value))});
      el.addEventListener('blur',function(){if(el.value&&rules[el.name])setErr(el,rules[el.name](el.value))});
    });
  });

  var modal=document.getElementById('modal'),mBody=document.getElementById('modalBody'),mTitle=document.getElementById('modalTitle');
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function openModal(title,html){mTitle.textContent=title;mBody.innerHTML=html;modal.hidden=false;document.getElementById('modalClose').focus()}
  function closeModal(){modal.hidden=true}
  document.getElementById('modalClose').addEventListener('click',closeModal);
  modal.addEventListener('click',function(e){if(e.target===modal)closeModal()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!modal.hidden)closeModal()});

  document.getElementById('orderForm').addEventListener('submit',function(e){
    e.preventDefault(); if(!validate(this))return;
    var f=new FormData(this),dt=new Date(f.get('date')).toLocaleDateString('ru-RU');
    var price=(+f.get('price')).toLocaleString('ru-RU');
    openModal('Заказ создан!',
      '<p>Ищем водителей рядом. Они увидят вашу цену и откликнутся — мы пришлём SMS на '+esc(f.get('phone'))+'.</p>'+
      '<dl><dt>Откуда</dt><dd>'+esc(f.get('from'))+'</dd><dt>Куда</dt><dd>'+esc(f.get('to'))+'</dd>'+
      '<dt>Груз</dt><dd>'+esc(f.get('cargo'))+', '+esc(f.get('weight'))+' кг</dd><dt>Дата</dt><dd>'+dt+'</dd>'+
      '<dt>Грузчики</dt><dd>'+esc(f.get('loaders'))+'</dd><dt>Ваша цена</dt><dd>'+price+' ₽</dd></dl>'+
      '<p style="margin-top:12px;font-size:.8rem">Демо‑версия: данные не отправлялись.</p>');
    this.reset(); d.value=iso;
  });

  document.getElementById('driverForm').addEventListener('submit',function(e){
    e.preventDefault();
    var ok=validate(this),ag=document.getElementById('dagree'),ae=document.getElementById('dagreeErr');
    ae.textContent=ag.checked?'':'Нужно согласие на обработку данных';
    if(!ok||!ag.checked)return;
    var f=new FormData(this);
    openModal('Заявка принята!','<p>'+esc(f.get('name'))+', спасибо! Мы свяжемся с вами по номеру '+esc(f.get('phone'))+' и расскажем о проверке документов.</p><p style="font-size:.8rem">Демо‑версия: данные не отправлялись.</p>');
    this.reset();
  });
})();
