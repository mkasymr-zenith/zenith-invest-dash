/* ZENITH Invest — общие данные для дашборда и личной страницы.
   Всё подключение к Битриксу живёт только здесь: при переходе на защищённый
   прокси нужно будет поменять только этот файл. */

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

/* ─ Загрузка ─ */
async function fetchDeals(){
  var all=[],start=0,total=null;
  while(true){
    var b=new URLSearchParams();
    b.append('FILTER[CATEGORY_ID]','14');
    ['ID','TITLE','STAGE_ID','OPPORTUNITY','ASSIGNED_BY_ID','COMMENTS',
     'UF_CRM_1703075382408','UF_CRM_1705997334698','UF_CRM_1781668890853',
     'DATE_CREATE','CLOSEDATE','LAST_COMMUNICATION_TIME','DATE_MODIFY'].forEach(function(f){b.append('SELECT[]',f);});
    b.append('ORDER[ID]','DESC');
    b.append('start',String(start));
    var r=await fetch(WH+'crm.deal.list.json',{method:'POST',body:b});
    var d=await r.json();
    if(d.error)throw new Error(d.error_description||d.error);
    all=all.concat(d.result||[]);
    if(total===null)total=d.total||0;
    if(!d.next||all.length>=total)break;
    start=d.next;
  }
  return all;
}
async function fetchUsers(){
  var r=await fetch(WH+'user.get.json',{method:'POST',body:new URLSearchParams({'FILTER[ACTIVE]':'Y'})});
  var d=await r.json();var m={};
  (d.result||[]).forEach(function(u){m[u.ID]=((u.NAME||'')+' '+(u.LAST_NAME||'')).trim();});
  return m;
}
async function fetchActivities(){
  // Только звонки (TYPE_ID=2) за последние 14 дней
  var cutoff=new Date();
  cutoff.setDate(cutoff.getDate()-14);
  var cutoffStr=String(cutoff.getDate()).padStart(2,'0')+'.'+String(cutoff.getMonth()+1).padStart(2,'0')+'.'+cutoff.getFullYear();
  var all=[],start=0;
  try{
    while(all.length<3000){
      var b=new URLSearchParams();
      b.append('FILTER[TYPE_ID]','2');
      b.append('FILTER[>=CREATED]',cutoffStr);
      b.append('select[]','ID');b.append('select[]','CREATED');b.append('select[]','AUTHOR_ID');
      b.append('start',String(start));
      var r=await fetch(WH+'crm.activity.list.json',{method:'POST',body:b});
      var d=await r.json();
      if(d.error||!d.result)break;
      all=all.concat(Array.isArray(d.result)?d.result:[]);
      if(!d.next||all.length>=(d.total||0))break;
      start=d.next;
    }
  }catch(e){console.warn('calls fetch failed',e);}
  return all;
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
