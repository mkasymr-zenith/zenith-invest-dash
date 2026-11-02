/* ZENITH Invest — празднование оплат.
   Celebrate.check(items, ctx, opts) — сравнивает оплаты с уже виденными и празднует новые.
   items: [{id, title, amt, gp, mgr, uid, date}]
   ctx:   {planGp, gpM, avgM, wonM}  — цифры команды ПОСЛЕ новых оплат
   opts:  {storageKey, mode(item) -> 'full' | 'toast' | null}
*/
(function(){
  var reduceMotion=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SHOW_MS=9000, FRESH_MS=3*24*3600*1000;

  /* ─ стили ─ */
  var css=
  '.zc-ov{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;overflow:hidden;'+
    'background:radial-gradient(circle at 50% 42%,#ff6a55 0%,#e8382c 42%,#9e1a12 100%);color:#fff;'+
    'font-family:Montserrat,Inter,system-ui,sans-serif;opacity:0;visibility:hidden;transition:opacity .35s,visibility 0s .35s;cursor:pointer}'+
  '.zc-ov.on{opacity:1;visibility:visible;transition:opacity .35s}'+
  '.zc-rays{position:absolute;left:50%;top:42%;width:240vmax;height:240vmax;margin:-120vmax 0 0 -120vmax;'+
    'background:repeating-conic-gradient(rgba(255,255,255,.07) 0 6deg,transparent 6deg 18deg);animation:zc-spin 60s linear infinite}'+
  '@keyframes zc-spin{to{transform:rotate(360deg)}}'+
  '.zc-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}'+
  '.zc-ov.on .zc-flash{animation:zc-flash .6s ease-out}'+
  '@keyframes zc-flash{0%{opacity:.85}100%{opacity:0}}'+
  '.zc-card{position:relative;text-align:center;display:flex;flex-direction:column;align-items:center;gap:1.6vh;padding:4vh 4vw;max-width:94vw}'+
  '.zc-kick{font-size:clamp(16px,2.4vw,34px);font-weight:700;letter-spacing:.01em;opacity:.95}'+
  '.zc-big{display:none;background:#ffd166;color:#5a3a00;font-weight:800;border-radius:999px;padding:.35em 1em;font-size:clamp(14px,1.8vw,26px)}'+
  '.zc-ov.big .zc-big{display:inline-block}'+
  '.zc-who{display:flex;align-items:center;gap:2vw}'+
  '.zc-av{width:clamp(56px,11vh,140px);height:clamp(56px,11vh,140px);border-radius:50%;background:#fff;color:#e8382c;'+
    'display:flex;align-items:center;justify-content:center;font-weight:900;font-size:clamp(22px,4.4vh,56px);box-shadow:0 10px 40px rgba(0,0,0,.25)}'+
  '.zc-name{font-size:clamp(30px,6vw,96px);font-weight:900;line-height:1;letter-spacing:-.01em}'+
  '.zc-amt{font-size:clamp(60px,13.5vw,240px);font-weight:900;line-height:.95;letter-spacing:-.03em;font-variant-numeric:tabular-nums;'+
    'text-shadow:0 8px 40px rgba(0,0,0,.25);white-space:nowrap}'+
  '.zc-title{font-family:Inter,system-ui,sans-serif;font-size:clamp(15px,2vw,30px);opacity:.9;max-width:80vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
  '.zc-gp{font-family:Inter,system-ui,sans-serif;font-size:clamp(14px,1.7vw,24px);font-weight:600;background:rgba(0,0,0,.18);border-radius:999px;padding:.3em 1em}'+
  '.zc-plan{width:min(720px,80vw);margin-top:2vh;font-family:Inter,system-ui,sans-serif}'+
  '.zc-plan-l{display:flex;justify-content:space-between;font-size:clamp(13px,1.6vw,22px);font-weight:600;margin-bottom:.6vh}'+
  '.zc-bar{height:clamp(10px,1.6vh,18px);background:rgba(255,255,255,.25);border-radius:999px;overflow:hidden}'+
  '.zc-fill{height:100%;background:#fff;border-radius:999px;transition:width 1.6s cubic-bezier(.2,.8,.2,1) .9s}'+
  '.zc-hint{position:absolute;bottom:3vh;left:0;right:0;text-align:center;font-family:Inter,system-ui,sans-serif;font-size:12px;opacity:.6}'+
  '.zc-cv{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}'+
  /* поочерёдное появление */
  '.zc-ov.on .zc-kick{animation:zc-up .5s .15s both}'+
  '.zc-ov.on .zc-who{animation:zc-pop .6s .3s both cubic-bezier(.2,1.4,.4,1)}'+
  '.zc-ov.on .zc-amt{animation:zc-pop .7s .45s both cubic-bezier(.2,1.4,.4,1)}'+
  '.zc-ov.on .zc-title,.zc-ov.on .zc-gp{animation:zc-up .5s .7s both}'+
  '.zc-ov.on .zc-plan{animation:zc-up .5s .85s both}'+
  '@keyframes zc-up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}'+
  '@keyframes zc-pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}'+
  /* тост */
  '.zc-toasts{position:fixed;right:20px;bottom:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none}'+
  '.zc-toast{background:#28282c;color:#ededee;border-left:4px solid #e8382c;border-radius:12px;padding:12px 16px;min-width:260px;max-width:360px;'+
    'box-shadow:0 10px 30px rgba(0,0,0,.35);font-family:Inter,system-ui,sans-serif;animation:zc-in .4s both}'+
  '.zc-toast b{font-family:Montserrat,system-ui,sans-serif;font-size:18px;color:#2ecc78;display:block;margin:2px 0}'+
  '.zc-toast small{color:#909096;font-size:12px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
  '@keyframes zc-in{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}'+
  '@media (prefers-reduced-motion: reduce){.zc-rays{animation:none}.zc-ov.on *{animation:none!important}.zc-fill{transition:none}}';

  var ov,els={},toasts,queue=[],busy=false,hideT=null;

  function build(){
    if(ov)return;
    var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
    ov=document.createElement('div');ov.className='zc-ov';ov.setAttribute('role','dialog');ov.setAttribute('aria-live','assertive');
    ov.innerHTML=
      '<div class="zc-rays"></div><div class="zc-flash"></div>'+
      '<div class="zc-card">'+
        '<div class="zc-kick">Оплата получена 🎉</div>'+
        '<div class="zc-big">Крупная сделка</div>'+
        '<div class="zc-who"><div class="zc-av"></div><div class="zc-name"></div></div>'+
        '<div class="zc-amt"></div>'+
        '<div class="zc-title"></div>'+
        '<div class="zc-gp"></div>'+
        '<div class="zc-plan"><div class="zc-plan-l"><span class="zc-plan-t"></span><span class="zc-plan-v"></span></div>'+
          '<div class="zc-bar"><div class="zc-fill"></div></div></div>'+
      '</div>'+
      '<canvas class="zc-cv"></canvas>'+
      '<div class="zc-hint">Нажмите, чтобы закрыть</div>';
    document.body.appendChild(ov);
    ['kick','av','name','amt','title','gp','plan','plan-t','plan-v','fill','cv'].forEach(function(k){els[k]=ov.querySelector('.zc-'+k);});
    ov.addEventListener('click',hide);
    document.addEventListener('keydown',function(e){if(e.key==='Escape')hide();});
    toasts=document.createElement('div');toasts.className='zc-toasts';document.body.appendChild(toasts);
  }

  function initials(s){var p=String(s||'').trim().split(/\s+/);return((p[0]||'')[0]||'')+((p[1]||'')[0]||'');}
  function money(n){return Math.round(n).toLocaleString('ru-RU')+' ₸';}
  function short(n){n=+n||0;if(n>=1e6)return(n/1e6).toFixed(1).replace('.0','')+' млн';if(n>=1e3)return Math.round(n/1e3)+' тыс';return String(Math.round(n));}

  /* ─ показ ─ */
  function show(it,ctx){
    build();busy=true;ctx=ctx||{};
    var big=ctx.avgM>0&&it.amt>=ctx.avgM*2;
    ov.classList.toggle('big',big);
    els.av.textContent=it.avatar||initials(it.mgr).toUpperCase();
    els.kick.textContent=it.demo?'Тестовый показ: так будет выглядеть новая оплата':'Оплата получена 🎉';
    els.name.textContent=it.mgr||'Команда';
    els.title.textContent=it.title||'';
    els.gp.textContent=it.gp>0?'Валовая прибыль '+short(it.gp)+' ₸':'';
    els.gp.style.display=it.gp>0?'':'none';

    if(ctx.planGp>0){
      var after=Math.min(100,Math.round((ctx.gpM||0)/ctx.planGp*100));
      var before=Math.min(100,Math.max(0,Math.round(((ctx.gpM||0)-(it.gp||0))/ctx.planGp*100)));
      els['plan-t'].textContent=ctx.planLabel||'План команды по валовой прибыли';
      els['plan-v'].textContent=before+'% → '+after+'%';
      els.fill.style.transition='none';els.fill.style.width=before+'%';
      els.plan.style.display='';
      requestAnimationFrame(function(){requestAnimationFrame(function(){els.fill.style.transition='';els.fill.style.width=after+'%';});});
    }else if(ctx.wonM){
      els['plan-t'].textContent='Оплат в этом месяце';els['plan-v'].textContent=String(ctx.wonM);
      els.fill.style.width='100%';els.plan.style.display='';
    }else els.plan.style.display='none';

    ov.classList.remove('on');void ov.offsetWidth;ov.classList.add('on');
    var countMs=big?2600:1600;
    countUp(els.amt,it.amt||0,reduceMotion?0:countMs);
    if(!reduceMotion)confetti(els.cv,big);
    if(soundOn())playMoney(big,countMs);
    clearTimeout(hideT);hideT=setTimeout(hide,SHOW_MS+(big?3000:0));
  }
  function hide(){
    if(!ov||!ov.classList.contains('on'))return;
    clearTimeout(hideT);ov.classList.remove('on');stopConfetti();
    setTimeout(function(){busy=false;next();},500);
  }
  function next(){if(busy||!queue.length)return;var q=queue.shift();q.mode==='toast'?(toast(q.it),next()):show(q.it,q.ctx);}

  function countUp(el,to,ms){
    if(!ms){el.textContent=money(to);return;}
    var t0=null;
    function step(t){if(!t0)t0=t;var p=Math.min(1,(t-t0)/ms),e=1-Math.pow(1-p,3);el.textContent=money(to*e);if(p<1)requestAnimationFrame(step);}
    el.textContent=money(0);setTimeout(function(){requestAnimationFrame(step);},450);
  }

  function toast(it){
    build();
    var t=document.createElement('div');t.className='zc-toast';
    t.innerHTML='<div>🎉 '+'<span class="n"></span></div><b></b><small></small>';
    t.querySelector('.n').textContent=(it.mgr||'').split(' ')[0]+' закрыл(а) оплату';
    t.querySelector('b').textContent=money(it.amt||0);
    t.querySelector('small').textContent=it.title||'';
    toasts.appendChild(t);
    if(soundOn())ding();
    setTimeout(function(){t.style.transition='opacity .4s';t.style.opacity='0';setTimeout(function(){t.remove();},450);},7000);
  }

  /* ─ конфетти ─ */
  var raf=null;
  function confetti(cv,big){
    var dpr=window.devicePixelRatio||1,W=cv.width=innerWidth*dpr,H=cv.height=innerHeight*dpr,c=cv.getContext('2d');
    var colors=['#ffffff','#ffd166','#ffe9a8','#1c1c1e','#ffb4a8'],P=[],n=big?320:200;
    function burst(x,y,ang,spread,count,speed){
      for(var i=0;i<count;i++){
        var a=ang+(Math.random()-.5)*spread,v=(speed*(.55+Math.random()*.6))*dpr;
        P.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,r:Math.random()*6.28,vr:(Math.random()-.5)*.3,
          w:(6+Math.random()*8)*dpr,h:(4+Math.random()*6)*dpr,col:colors[i%colors.length],ph:Math.random()*6.28});
      }
    }
    burst(0,H,-Math.PI/3,.7,n/2,22);burst(W,H,-Math.PI*2/3,.7,n/2,22);
    setTimeout(function(){burst(W/2,H*.35,-Math.PI/2,Math.PI*2,big?160:90,14);},500);
    if(big)setTimeout(function(){burst(W*.2,H,-Math.PI/2.6,.6,120,24);burst(W*.8,H,-Math.PI/1.6,.6,120,24);},1400);
    var t0=performance.now();
    cancelAnimationFrame(raf);
    (function loop(t){
      c.clearRect(0,0,W,H);
      for(var i=0;i<P.length;i++){
        var p=P[i];p.vy+=.32*dpr;p.vx*=.99;p.vy*=.99;p.x+=p.vx+Math.sin(p.ph+t/300)*.6*dpr;p.y+=p.vy;p.r+=p.vr;
        c.save();c.translate(p.x,p.y);c.rotate(p.r);c.scale(1,Math.cos(t/200+p.ph));c.fillStyle=p.col;c.fillRect(-p.w/2,-p.h/2,p.w,p.h);c.restore();
      }
      P=P.filter(function(p){return p.y<H+50*dpr;});
      if(P.length||t-t0<2000)raf=requestAnimationFrame(loop);else c.clearRect(0,0,W,H);
    })(t0);
  }
  function stopConfetti(){cancelAnimationFrame(raf);if(els.cv){var c=els.cv.getContext('2d');c.clearRect(0,0,els.cv.width,els.cv.height);}}

  /* ─ звук (синтез, без файлов) ─ */
  var actx=null;
  function audio(){
    if(!actx){try{actx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return null;}}
    if(actx.state==='suspended')actx.resume();
    return actx;
  }
  // Браузеры разрешают звук только после первого клика/нажатия на странице
  ['pointerdown','keydown','touchstart'].forEach(function(ev){document.addEventListener(ev,function(){audio();},{once:true,passive:true});});
  /* Звук «машинка считает деньги»: шелест купюр с мотором, пока сумма набегает,
     затем «ка-чинг» кассы, звон монет и короткий аккорд. Всё синтезируется на лету. */
  function out(a){
    if(a._zcOut)return a._zcOut;
    var c=a.createDynamicsCompressor();c.threshold.value=-16;c.ratio.value=4;
    var g=a.createGain();g.gain.value=1.6;c.connect(g);g.connect(a.destination);
    return a._zcOut=c;
  }
  function noiseBuf(a){
    if(a._zcNoise)return a._zcNoise;
    var b=a.createBuffer(1,a.sampleRate,a.sampleRate),d=b.getChannelData(0);
    for(var i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    return a._zcNoise=b;
  }
  function burst(a,t,dur,type,freq,q,vol){
    var s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();
    s.buffer=noiseBuf(a);f.type=type;f.frequency.value=freq;f.Q.value=q;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.002);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(f);f.connect(g);g.connect(out(a));s.start(t,Math.random()*.8,dur+.03);
  }
  function osc(a,f,t,dur,type,vol,att){
    var o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=f;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+(att||.004));g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g);g.connect(out(a));o.start(t);o.stop(t+dur+.05);
  }
  function billCounter(a,t,ms){
    var dur=ms/1000;
    // гул мотора
    var o=a.createOscillator(),lp=a.createBiquadFilter(),g=a.createGain();
    o.type='sawtooth';o.frequency.setValueAtTime(60,t);o.frequency.linearRampToValueAtTime(92,t+.3);
    lp.type='lowpass';lp.frequency.value=380;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.06,t+.15);g.gain.setValueAtTime(.06,t+dur-.08);g.gain.linearRampToValueAtTime(0,t+dur+.06);
    o.connect(lp);lp.connect(g);g.connect(out(a));o.start(t);o.stop(t+dur+.1);
    // шелест купюр: разгоняется до ~30 щелчков в секунду
    for(var x=t;x<t+dur;){
      var p=(x-t)/dur,rate=14+16*Math.min(1,p*3);
      burst(a,x,.022,'bandpass',2600+Math.random()*2000,1.1,.32+Math.random()*.12);
      burst(a,x,.03,'lowpass',520,.7,.14);
      x+=(1/rate)*(.85+Math.random()*.3);
    }
  }
  function kaching(a,t,vol){
    vol=vol||1;
    burst(a,t,.09,'lowpass',850,.8,.55*vol);          // «ка» — удар ящика кассы
    burst(a,t+.01,.05,'bandpass',3200,2,.22*vol);
    [[1568,1.5],[2349,1.2],[3136,.9],[4699,.6]].forEach(function(n,i){  // «чинг» — колокольчик
      osc(a,n[0],t+.06,n[1],'sine',.2*vol/(i+1));osc(a,n[0]*1.004,t+.06,n[1],'sine',.05*vol);
    });
    [2093,2793,4186].forEach(function(f,i){osc(a,f,t+.18,1.3-i*.25,'sine',.1*vol);});
  }
  function coins(a,t,n){
    for(var i=0;i<n;i++){var s=t+Math.random()*.75,f=3000+Math.random()*3800;
      osc(a,f,s,.1+Math.random()*.18,'sine',.05);osc(a,f*1.51,s,.07,'sine',.02);}
  }
  function chord(a,t,big){
    [523.25,659.25,783.99,1046.5].forEach(function(f){osc(a,f,t,big?2.4:1.5,'triangle',.06,.03);});
    if(big)[[783.99,0],[1046.5,.13],[1318.5,.26]].forEach(function(n){osc(a,n[0],t+.55+n[1],n[1]===.26?1.2:.4,'triangle',.13);});
  }
  // t — когда открылся экран; сумма начинает набегать через 0,45 с и идёт countMs
  function moneySound(a,t,countMs,big){
    billCounter(a,t+.45,countMs);
    var end=t+.45+countMs/1000;
    kaching(a,end,1);coins(a,end+.12,big?30:16);chord(a,end+.4,big);
    if(big){kaching(a,end+1,.8);coins(a,end+1.1,24);}
  }
  function playMoney(big,countMs){var a=audio();if(a)moneySound(a,a.currentTime+.02,countMs,big);}
  function ding(){var a=audio();if(!a)return;var t=a.currentTime+.03;kaching(a,t,.6);coins(a,t+.1,6);}

  function soundOn(){try{return localStorage.getItem('zi_sound')!=='off';}catch(e){return true;}}

  /* ─ публичное API ─ */
  window.Celebrate={
    check:function(items,ctx,opts){
      opts=opts||{};var key=opts.storageKey||'zi_seen_paid',seen=null;
      try{seen=JSON.parse(localStorage.getItem(key)||'null');}catch(e){}
      var ids=items.map(function(i){return String(i.id);});
      if(!Array.isArray(seen)){ // первый запуск: запоминаем всё, ничего не празднуем
        try{localStorage.setItem(key,JSON.stringify(ids.slice(0,800)));}catch(e){}
        return [];
      }
      var set={};seen.forEach(function(id){set[id]=1;});
      var fresh=items.filter(function(i){return !set[String(i.id)]&&(!i.date||Date.now()-i.date<FRESH_MS);});
      try{localStorage.setItem(key,JSON.stringify(ids.concat(seen).filter(function(v,i,a){return a.indexOf(v)===i;}).slice(0,800)));}catch(e){}
      fresh.sort(function(a,b){return (a.date||0)-(b.date||0);}).forEach(function(it){
        var mode=opts.mode?opts.mode(it):'full';
        if(mode)queue.push({it:it,ctx:ctx,mode:mode});
      });
      next();
      return fresh;
    },
    demo:function(it,ctx){queue.push({it:it,ctx:ctx,mode:'full'});next();},
    toast:toast,
    _render:function(big){var ms=big?2600:1600,sec=.5+ms/1000+3.6,oc=new OfflineAudioContext(2,Math.ceil(44100*sec),44100);moneySound(oc,.05,ms,big);return oc.startRendering();},
    soundOn:soundOn,
    toggleSound:function(){var on=!soundOn();try{localStorage.setItem('zi_sound',on?'on':'off');}catch(e){}if(on)ding();return on;}
  };
})();
