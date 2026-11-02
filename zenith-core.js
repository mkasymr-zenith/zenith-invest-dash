/* ZENITH Invest — общие данные для дашборда и личной страницы.
   Всё подключение к Битриксу живёт только здесь: при переходе на защищённый
   прокси нужно будет поменять только этот файл. */

// Версия файла: страницы проверяют её и подсказывают, если файл на GitHub устарел
var ZENITH_CORE_VERSION=12;

var WH='https://macron.bitrix24.kz/rest/88/ozk5j3nkr24pilf1/';
var PORTAL='https://macron.bitrix24.kz';
var PLAN_KEY='macron_dashboard_plan_v2';
var STAGE_MAP={'C14:NEW':'Новый клиент','C14:PREPARATION':'Взят в работу','C14:EXECUTING':'КП презентовано','C14:UC_TONIVQ':'КЭВ','C14:FINAL_INVOICE':'КП согласовано','C14:UC_O6LFBY':'Счёт выставлен','C14:WON':'Оплата получена','C14:LOSE':'Условный отказ'};
var REFUSE_MAP={'332':'Не прошли по цене','334':'Нет в наличии','336':'Срок поставки','338':'Мы отказали','340':'Отмена закупа','342':'Нет документов','344':'Условия оплаты','346':'Качество','348':'Нет товара','350':'Другое','352':'Не отвечает','354':'Уже купили','356':'На прогрев'};
var ACTIVE=['Новый клиент','Взят в работу','КП презентовано','КЭВ','КП согласовано','Счёт выставлен'];
var ALL_ST=ACTIVE.concat(['Условный отказ','Оплата получена']);
var ST_COLOR={'Новый клиент':'#ff9f0a','Взят в работу':'#0a84ff','КП презентовано':'#40c8e0','КЭВ':'#9b76cc','КП согласовано':'#30d158','Счёт выставлен':'#bf5af2','Оплата получена':'#30d158','Условный отказ':'#ff3b30'};
var AV_BG=['#c0392b','#2471a3','#1e8449','#7d3c98','#b9770e','#148f77'];
// ★ Менеджеры воронки «Первая продажа» — единственное место, где задаётся состав команды.
// uid — ID пользователя в Битриксе (из адреса профиля /company/personal/user/ID/).
// name — запасное имя, если Битрикс не вернул пользователя.
// Пришёл или ушёл менеджер — правь только этот список (и такой же в morning-report/worker.js).
var SALES_MGRS=[
  {uid:'88', name:''},
  {uid:'124',name:''},
  {uid:'200',name:''},
  {uid:'328',name:'Виталий Двойченков'},
  {uid:'376',name:'Рустам Таиров'}
];
var SALES_MGR_IDS={};SALES_MGRS.forEach(function(m){SALES_MGR_IDS[m.uid]=true;});


/* ─ Праздники Казахстана ─
   fixed: [месяц-день, переносится ли]. Если переносимый праздник выпал на субботу или
   воскресенье, выходным становится следующий рабочий день (так считает Трудовой кодекс РК).
   Рождество и Курбан айт не переносятся.
   ★ Раз в год сверяй с производственным календарём:
     religious — первый день Курбан айта (дату объявляет ДУМК),
     extraOff  — дополнительные выходные по постановлению правительства,
     extraWork — рабочие субботы/воскресенья по постановлению. */
var KZ_HOLIDAYS={
  fixed:[['01-01',1],['01-02',1],['01-07',0],['03-08',1],['03-21',1],['03-22',1],['03-23',1],
         ['05-01',1],['05-07',1],['05-09',1],['07-06',1],['08-30',1],['10-25',1],['12-16',1]],
  religious:{'2026':['05-27'],'2027':['05-16']},
  extraOff:{},
  extraWork:{}
};
var _kzOff={};
function kzOffDays(y){
  if(_kzOff[y])return _kzOff[y];
  var off={},moves=[];
  function key(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function at(md){var p=md.split('-');return new Date(y,+p[0]-1,+p[1]);}
  KZ_HOLIDAYS.fixed.forEach(function(h){var d=at(h[0]);off[key(d)]=1;if(h[1]&&(d.getDay()===0||d.getDay()===6))moves.push(d);});
  (KZ_HOLIDAYS.religious[y]||[]).forEach(function(md){off[key(at(md))]=1;});
  moves.sort(function(a,b){return a-b;}).forEach(function(d){
    var n=new Date(d);
    do{n.setDate(n.getDate()+1);}while(n.getDay()===0||n.getDay()===6||off[key(n)]);
    off[key(n)]=1;
  });
  (KZ_HOLIDAYS.extraOff[y]||[]).forEach(function(md){off[key(at(md))]=1;});
  var work={};(KZ_HOLIDAYS.extraWork[y]||[]).forEach(function(md){work[key(at(md))]=1;});
  return _kzOff[y]={off:off,work:work};
}

/* ─ Планы ─
   Общие планы лежат в файле plans.json рядом со страницами. Все экраны читают его
   при каждом обновлении. Руководитель меняет планы в окне «Планы» → скачивается
   новый plans.json → его загружают на GitHub. Пока файл не загружен, новые планы
   видны только на этом компьютере (они помечены как «не опубликованы»). */
var PENDING_KEY='zi_plan_pending';
function normPlan(p){
  p=p||{};var m={};
  Object.keys(p.mgrs||{}).sort().forEach(function(k){if(+p.mgrs[k])m[k]=+p.mgrs[k];});
  return {month:p.month||'',total:+p.total||0,planConv:+p.planConv||0,planAvg:+p.planAvg||0,mgrs:m};
}
function samePlan(a,b){return JSON.stringify(normPlan(a))===JSON.stringify(normPlan(b));}
var PLANS_STATE={published:false,pending:false,month:''};
async function fetchPlans(){
  var remote=null,pending=null;
  try{var r=await fetch('plans.json?t='+Date.now(),{cache:'no-store'});if(r.ok)remote=await r.json();}catch(e){}
  try{pending=JSON.parse(localStorage.getItem(PENDING_KEY)||'null');}catch(e){}
  if(pending&&remote&&samePlan(pending,remote)){try{localStorage.removeItem(PENDING_KEY);}catch(e){}pending=null;}
  var use=pending||remote;
  if(use){try{localStorage.setItem(PLAN_KEY,JSON.stringify(normPlan(use)));}catch(e){}}
  PLANS_STATE={published:!!remote,pending:!!pending,month:(use&&use.month)||''};
  return PLANS_STATE;
}

/* ─ Загрузка ─
   Быстрая схема: первая страница обычным запросом, остальные — одним запросом batch
   (до 50 страниц = 2500 записей за раз). Сделки берём только нужные: в работе
   (любой давности) и изменённые с начала прошлого месяца. */
var DEAL_FIELDS=['ID','TITLE','STAGE_ID','OPPORTUNITY','ASSIGNED_BY_ID',
  'UF_CRM_1703075382408','UF_CRM_1705997334698','UF_CRM_1781668890853',
  'DATE_CREATE','CLOSEDATE','LAST_COMMUNICATION_TIME','DATE_MODIFY'];
var ACTIVE_STAGE_IDS=Object.keys(STAGE_MAP).filter(function(k){return ACTIVE.indexOf(STAGE_MAP[k])!==-1;});

// объект → строка в формате Битрикса: filter[CATEGORY_ID]=14&select[]=ID
function bxQs(obj,prefix){
  var parts=[];
  Object.keys(obj).forEach(function(k){
    var v=obj[k],key=prefix?prefix+'['+k+']':k;
    if(Array.isArray(v))v.forEach(function(x){parts.push(encodeURIComponent(key+'[]')+'='+encodeURIComponent(x));});
    else if(v!==null&&typeof v==='object'){var n=bxQs(v,key);if(n)parts.push(n);}
    else if(v!==undefined)parts.push(encodeURIComponent(key)+'='+encodeURIComponent(v));
  });
  return parts.join('&');
}
async function bxCall(method,params){
  var r=await fetch(WH+method+'.json',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:bxQs(params)});
  var d=await r.json();
  if(d.error)throw new Error(d.error_description||d.error);
  return d;
}
async function bxAll(method,params,max){
  max=max||20000;
  var first=await bxCall(method,Object.assign({},params,{start:0}));
  var items=Array.isArray(first.result)?first.result:[];
  if(!first.next)return items;
  var total=Math.min(first.total||0,max),starts=[];
  for(var s=first.next;s<total;s+=50)starts.push(s);
  for(var i=0;i<starts.length;i+=50){
    var chunk=starts.slice(i,i+50),cmd={};
    chunk.forEach(function(st){cmd['p'+st]=method+'?'+bxQs(Object.assign({},params,{start:st}));});
    var d=await bxCall('batch',{halt:0,cmd:cmd});
    var res=(d.result&&d.result.result)||{};
    chunk.forEach(function(st){if(Array.isArray(res['p'+st]))items=items.concat(res['p'+st]);});
  }
  return items.slice(0,max);
}
function bxDate(d){return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear();}

async function fetchDeals(){
  var now=new Date(),pms=new Date(now.getFullYear(),now.getMonth()-1,1);
  var lists=await Promise.all([
    bxAll('crm.deal.list',{filter:{CATEGORY_ID:'14',STAGE_ID:ACTIVE_STAGE_IDS},select:DEAL_FIELDS,order:{ID:'DESC'}}),
    bxAll('crm.deal.list',{filter:{CATEGORY_ID:'14','>=DATE_MODIFY':bxDate(pms)},select:DEAL_FIELDS,order:{ID:'DESC'}})
  ]);
  var seen={},all=[];
  lists[0].concat(lists[1]).forEach(function(d){if(!seen[d.ID]){seen[d.ID]=1;all.push(d);}});
  return all;
}
async function fetchUsers(){
  var list=await bxAll('user.get',{FILTER:{ACTIVE:'Y'}},500);
  var m={};list.forEach(function(u){m[u.ID]=((u.NAME||'')+' '+(u.LAST_NAME||'')).trim();});
  return m;
}
async function fetchActivities(){
  // Только звонки (TYPE_ID=2) за последние 14 дней
  var cutoff=new Date();cutoff.setDate(cutoff.getDate()-14);
  try{
    return await bxAll('crm.activity.list',{filter:{TYPE_ID:'2','>=CREATED':bxDate(cutoff)},select:['ID','CREATED','AUTHOR_ID']},5000);
  }catch(e){console.warn('calls fetch failed',e);return [];}
}

/* Всё сразу + запоминаем последний успешный результат, чтобы при следующем
   открытии показать его мгновенно, пока грузятся свежие данные. */
var CACHE_KEY='zi_cache_v1';
async function loadAll(){
  var t0=performance.now();
  var r=await Promise.all([fetchDeals(),fetchUsers(),fetchActivities(),fetchPlans()]);
  var data={at:Date.now(),deals:r[0],users:r[1],acts:r[2]};
  console.info('ZENITH: загружено за '+Math.round(performance.now()-t0)+' мс — сделок '+data.deals.length+', звонков '+data.acts.length);
  try{localStorage.setItem(CACHE_KEY,JSON.stringify(data));}catch(e){}
  return data;
}
function cachedAll(){
  try{var c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
    // старше суток — не показываем, чтобы не вводить в заблуждение
    if(c&&c.deals&&Date.now()-c.at<864e5)return c;}catch(e){}
  return null;
}

/* ─ Разбор полей сделки ─ */
var Z={
  stage:function(d){
    var raw=d.STAGE_ID||'';
    return STAGE_MAP[raw]||(raw.indexOf('WON')!==-1?'Оплата получена':raw.indexOf('LOSE')!==-1?'Условный отказ':'Новый клиент');
  },
  gp:function(d){return d.UF_CRM_1781668890853?parseFloat(String(d.UF_CRM_1781668890853).split('|')[0])||0:0;},
  opp:function(d){return parseFloat(d.OPPORTUNITY)||0;},
  payDate:function(d){
    if(d.UF_CRM_1705997334698)return new Date(d.UF_CRM_1705997334698);
    return d.CLOSEDATE?new Date(d.CLOSEDATE):null;
  },
  lastTouch:function(d){
    if(d.LAST_COMMUNICATION_TIME){
      var p=d.LAST_COMMUNICATION_TIME.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
      if(p)return new Date(p[3]+'-'+p[2]+'-'+p[1]+'T'+p[4]+':'+p[5]+':'+p[6]);
    }
    return d.DATE_MODIFY?new Date(d.DATE_MODIFY):null;
  },
  dealUrl:function(id){return PORTAL+'/crm/deal/details/'+id+'/';},
  dayKey:function(dt){return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');},
  // Рабочий ли день с учётом праздников и переносов Казахстана
  isWorkday:function(d){
    var c=kzOffDays(d.getFullYear()),k=Z.dayKey(d);
    if(c.work[k])return true;
    if(c.off[k])return false;
    return d.getDay()!==0&&d.getDay()!==6;
  },
  // Рабочие дни месяца: всего, прошло (до сегодня), осталось (включая сегодня)
  workdays:function(now){
    var y=now.getFullYear(),m=now.getMonth(),last=new Date(y,m+1,0).getDate(),total=0,passed=0,left=0;
    for(var i=1;i<=last;i++){
      if(!Z.isWorkday(new Date(y,m,i)))continue;
      total++; if(i<now.getDate())passed++; else left++;
    }
    return {total:total,passed:passed,left:left};
  },
  esc:function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
};
