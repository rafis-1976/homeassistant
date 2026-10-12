/* ============================================================
   CONFIGURACIÓN
   ============================================================ */
const CONFIG = {
  // true = datos reales desde Supabase · false = simulación
  USAR_DATOS_REALES: true,

  // Supabase → Project Settings → API (usa SOLO la clave "anon / publishable")
  SUPABASE_URL: 'https://mwzhyozqmsqmfpgtzeek.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13emh5b3pxbXNxbWZwZ3R6ZWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMjE3ODEsImV4cCI6MjEwNTc5Nzc4MX0.U03Ec0QqhWznmy9_pyyjvp0yS9vzuPy9FY01UvfZDs0',

  // Si el último dato tiene más de X segundos, se marca "sin conexión"
  STALE_SEG: 90,
 
  // Convención de signos de red tal y como la guarda Home Assistant:
  // Fronius → positivo = importas de la red, negativo = exportas
  RED_POSITIVA_ES_IMPORTACION: true,
 
  // true si el consumo del Fronius (power_load) ya incluye el cargador del coche
  LOAD_INCLUYE_COCHE: true,
 
  // Para el "ahorro estimado" semanal (€/kWh)
  PRECIO_IMPORT: 0.12,      // lo que te ahorras por cada kWh autoconsumido
  PRECIO_EXCEDENTE: 0.06,   // lo que te compensan por kWh exportado
 
  // Hardware
  TIENE_BATERIA: false,
  BAT_CAP: 10,
  BAT_MAX_POT: 3,
  COCHE_MAX: 11,
  FRONIUS_MODELO: 'Primo 4.6'
};
 
const TZ = 'Europe/Madrid';
const $=id=>document.getElementById(id),cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const REAL = CONFIG.USAR_DATOS_REALES && !!window.supabase && !CONFIG.SUPABASE_URL.includes('TU_PROYECTO');
const sb = REAL ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : null;
 
/* ============================================================
   RELOJ
   ============================================================ */
function reloj(){
  const d=new Date(),h=String(d.getHours()).padStart(2,'0'),m=String(d.getMinutes()).padStart(2,'0');
  $('reloj').textContent=h+':'+m;
  const dias=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const mes=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  $('fecha').textContent=dias[d.getDay()]+', '+d.getDate()+' de '+mes[d.getMonth()];
  const hr=d.getHours();
  $('saludo').textContent=hr>=6&&hr<13?'Buenos días 👋':hr>=13&&hr<20?'Buenas tardes 👋':'Buenas noches 👋';
}
reloj();setInterval(reloj,1000);
 
/* ============================================================
   LUCES
   ============================================================ */
function tLuz(el){
  el.classList.toggle('on');
  const c=el.closest('.card');c.classList.toggle('on');
  const b=c.querySelector('.slider').value;
  c.querySelector('.card-sub').textContent=el.classList.contains('on')?'Encendida · '+b+'%':'Apagada';
}
function brillo(s){
  const v=s.value;s.style.setProperty('--p',v+'%');
  const c=s.closest('.card'),t=c.querySelector('.toggle');
  c.querySelector('.brillo-val').textContent=v+'%';
  if(v>0&&!t.classList.contains('on')){t.classList.add('on');c.classList.add('on')}
  if(v==0&&t.classList.contains('on')){t.classList.remove('on');c.classList.remove('on')}
  c.querySelector('.card-sub').textContent=t.classList.contains('on')?'Encendida · '+v+'%':'Apagada';
}
 
/* ============================================================
   TERMOSTATO
   ============================================================ */
let tempObj=22;
function temp(d){
  tempObj=cl(tempObj+d,10,30);
  $('temp-set').textContent=tempObj;
  document.querySelector('.dial .fg').style.strokeDashoffset=251.3*(1-(tempObj-10)/20);
}
 
/* ============================================================
   ESCENAS
   ============================================================ */
function escena(el){
  document.querySelectorAll('.scene').forEach(s=>s.classList.remove('active'));
  el.classList.add('active');
  const n=el.querySelector('.nm').textContent;
  const a={'Buenos días':()=>{setL(true,70);setT(21)},'Cine':()=>setL(true,20),'Noche':()=>{setL(false,0);setT(19)},'Salir':()=>{setL(false,0);setT(18)},'Fiesta':()=>setL(true,90)};
  if(a[n])a[n]();
}
function setL(on,br){
  document.querySelectorAll('[data-light]').forEach(c=>{
    const t=c.querySelector('.toggle'),s=c.querySelector('.slider');
    t.classList.toggle('on',on);c.classList.toggle('on',on);
    s.value=br;s.style.setProperty('--p',br+'%');
    c.querySelector('.brillo-val').textContent=br+'%';
    c.querySelector('.card-sub').textContent=on?'Encendida · '+br+'%':'Apagada';
  });
}
function setT(t){tempObj=t;$('temp-set').textContent=t;document.querySelector('.dial .fg').style.strokeDashoffset=251.3*(1-(t-10)/20)}
 
/* ============================================================
   NAV
   ============================================================ */
document.querySelectorAll('.nav-item').forEach(i=>i.addEventListener('click',()=>{
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
  i.classList.add('active');
  if(innerWidth<=900)document.querySelector('.sidebar').classList.remove('open');
}));
 
/* ============================================================
   SIMULACIÓN DE SENSORES (temperaturas, solo demo)
   ============================================================ */
setInterval(()=>{
  const v=document.querySelectorAll('.sensor-val');
  if(v[0])v[0].textContent=(22+Math.random()*.6).toFixed(1)+' °C';
  if(v[1])v[1].textContent=(20+Math.random()*.6).toFixed(1)+' °C';
  if(v[2])v[2].textContent=(23.5+Math.random()*.6).toFixed(1)+' °C';
},5000);
 
/* ============================================================
   ESTADO ENERGÉTICO
   ============================================================ */
const E={
  h:9,
  sol:0, casa:0,
  cocheOn:false, cocheDeseada:7.4, coche:0, cocheModo:'max',
  bat:65, auto:true,
  cb:0, db:0, exp:0, imp:0,
  kwhCoche:0, kwhFronius:0, kwhBat:0, picoKw:null
};
if(!REAL){E.sol=3;E.casa=1.5}
 
// Estado de la conexión (solo modo real)
const ESTADO={ts:null,reposo:false,offline:false};
 
/* ============================================================
   BALANCE ENERGÉTICO (solo simulación)
   ============================================================ */
function bal(){
  let cochePot=0;
  if(E.cocheOn){
    if(E.cocheModo==='solar'){
      const excedente=Math.max(0,E.sol-E.casa);
      cochePot=Math.min(E.cocheDeseada,excedente);
    } else {
      cochePot=E.cocheDeseada;
    }
  }
  E.coche=cochePot;
 
  const consTotal=E.casa+E.coche;
  const neto=E.sol-consTotal;
  let cb=0,db=0,ex=0,im=0;
 
  if(neto>0){
    if(CONFIG.TIENE_BATERIA){
      const hd=cl((100-E.bat)/10,0,1);
      cb=Math.min(neto,CONFIG.BAT_MAX_POT)*hd;
    }
    ex=neto-cb;
  } else if(neto<0){
    if(CONFIG.TIENE_BATERIA){
      const dp=cl(E.bat/10,0,1);
      db=Math.min(-neto,CONFIG.BAT_MAX_POT)*dp;
    }
    im=-neto-db;
  }
  E.cb=cb;E.db=db;E.exp=ex;E.imp=im;
  if(CONFIG.TIENE_BATERIA) E.bat=cl(E.bat+(cb-db)*.6,0,100);
 
  const step=0.1/60;
  E.kwhFronius+=E.sol*step;
  if(E.cocheOn) E.kwhCoche+=E.coche*step;
  if(CONFIG.TIENE_BATERIA) E.kwhBat+=Math.abs(cb-db)*step;
}
 
/* ============================================================
   SUPABASE · datos reales
   ============================================================ */
let DIAS=[];           // resumen diario (últimos 7 días)
let S24=[0,0,0,0,0,0,.1,.4,1.1,2,3,3.9,4.3,4,3.3,2.4,1.4,.7,.2,.05,0,0,0,0];
let C24=[.7,.6,.5,.5,.5,.7,1.3,2.2,1.7,1.1,1,1.3,1.7,1.4,1.2,1.3,1.9,2.7,2.5,2,1.6,1.3,1,.8];
let HMAX=23;           // última hora con datos en la gráfica
if(REAL){S24=new Array(24).fill(0);C24=new Array(24).fill(0);HMAX=0}
 
const fechaES=(d)=>d.toLocaleDateString('sv-SE',{timeZone:TZ});            // YYYY-MM-DD
const horaES=()=>parseInt(new Intl.DateTimeFormat('es-ES',{timeZone:TZ,hour:'numeric',hourCycle:'h23'}).format(new Date()),10);
const diaOffset=n=>fechaES(new Date(Date.now()+n*864e5));
 
function aplicarDatos(r){
  if(!r) return;
  ESTADO.ts=new Date(r.ts);
  ESTADO.reposo=(r.solar_w==null && r.casa_w==null);   // inversor dormido
  const kw=v=>v==null?0:Number(v)/1000;
 
  const coche=Math.max(0,kw(r.coche_w));
  E.sol=Math.max(0,kw(r.solar_w));
  E.coche=coche;E.cocheOn=coche>0.05;
  let casa=Math.max(0,kw(r.casa_w));
  if(CONFIG.LOAD_INCLUYE_COCHE) casa=Math.max(0,casa-coche);
  E.casa=casa;
 
  const imp=kw(r.red_w)*(CONFIG.RED_POSITIVA_ES_IMPORTACION?1:-1);
  E.imp=Math.max(0,imp);E.exp=Math.max(0,-imp);
  E.cb=0;E.db=0;
  if(r.energia_dia_kwh!=null) E.kwhFronius=Number(r.energia_dia_kwh);
  frescura();
}
 
function frescura(){
  if(!REAL) return;
  ESTADO.offline=!ESTADO.ts || (Date.now()-ESTADO.ts.getTime())/1000>CONFIG.STALE_SEG;
  if(ESTADO.offline){E.sol=E.casa=E.coche=E.exp=E.imp=0;E.cocheOn=false}
  renderE();
}
 
async function cargarActual(){
  const {data,error}=await sb.from('estado_actual').select('*').eq('id',1).maybeSingle();
  if(error){console.warn('Supabase:',error.message);ESTADO.offline=true;renderE();return}
  aplicarDatos(data);
}
 
async function cargarResumenes(){
  const hoy=diaOffset(0);
  const [d,c]=await Promise.all([
    sb.from('resumen_diario').select('*').gte('dia',diaOffset(-6)).order('dia'),
    sb.from('curva_horaria').select('*').eq('dia',hoy).order('hora')
  ]);
  if(d.error||c.error){console.warn('Supabase:',(d.error||c.error).message);return}
  DIAS=d.data||[];
  S24=new Array(24).fill(0);C24=new Array(24).fill(0);
  (c.data||[]).forEach(r=>{S24[r.hora]=Number(r.solar_kw)||0;C24[r.hora]=Number(r.casa_kw)||0});
  HMAX=horaES();
  const h=DIAS.find(x=>x.dia===hoy);
  if(h){
    E.kwhFronius=Number(h.solar_kwh)||0;
    E.kwhCoche=Number(h.coche_kwh)||0;
    E.picoKw=h.pico_kw==null?null:Number(h.pico_kw);
  }
  graf24();kpis();semana();renderE();
}
 
function suscribir(){
  sb.channel('estado-actual')
    .on('postgres_changes',{event:'*',schema:'public',table:'estado_actual'},p=>aplicarDatos(p.new))
    .subscribe();
}
 
function iniciarSupabase(){
  const btn=$('btn-auto');
  btn.textContent='🟢 Datos reales';btn.style.opacity='.7';
  document.querySelector('.flow-controls').style.display='none';
  document.querySelectorAll('.mode-btns').forEach(x=>x.style.display='none');
  cargarActual();cargarResumenes();suscribir();
  setInterval(cargarActual,30000);      // respaldo por si cae el websocket
  setInterval(cargarResumenes,60000);   // gráficas, KPIs y semana
  setInterval(frescura,10000);
}
 
function marcarIndicador(){
  let el=$('db-indicator');
  if(!el){
    el=document.createElement('span');el.id='db-indicator';
    el.style.cssText='font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;background:rgba(255,255,255,.05);margin-left:8px;letter-spacing:.4px';
    const head=document.querySelector('.energy-card .card-name');if(head)head.appendChild(el);
  }
  if(!REAL){el.textContent='🟡 Simulación';el.style.color='var(--on)';return}
  if(ESTADO.offline){el.textContent='🟡 Sin conexión';el.style.color='var(--on)'}
  else if(ESTADO.reposo){el.textContent='😴 Inversor en reposo';el.style.color='var(--td)'}
  else{el.textContent='🟢 En directo';el.style.color='var(--g)'}
}
 
/* ============================================================
   RENDERIZADO
   ============================================================ */
function pintaS(el){const a=+el.min,b=+el.max,v=+el.value;el.style.setProperty('--p',((v-a)/(b-a)*100)+'%')}
 
function pFlujo(el,on,col,p){
  if(!el)return;el.classList.toggle('on',on);if(!on)return;
  el.style.stroke=col;
  el.style.filter='drop-shadow(0 0 5px '+col+')';
  el.style.animationDuration=Math.max(.5,1.5-p*.15).toFixed(2)+'s';
}
 
function renderE(){
  const{sol,casa,coche,cb,db,exp,imp,bat}=E;
 
  $('v-solar').textContent=sol.toFixed(1)+' kW';
  $('v-casa').textContent=casa.toFixed(1)+' kW';
  $('v-coche').textContent=coche>0.05?coche.toFixed(1)+' kW':'Apagado';
  $('v-fronius').textContent=sol.toFixed(1)+' kW';
  $('v-red').textContent=(exp>.05?exp:imp).toFixed(1)+' kW';
  if(CONFIG.TIENE_BATERIA) $('v-bat').textContent=Math.round(bat)+' %';
 
  pFlujo($('f-solar'),sol>.05,'#ffc107',sol);
  pFlujo($('f-casa'),casa>.05,'#4fc3f7',casa);
  pFlujo($('f-coche'),coche>.05,'#b388ff',coche);
  pFlujo($('f-export'),exp>.05,'#4caf50',exp);
  pFlujo($('f-import'),imp>.05,'#ef5350',imp);
  if(CONFIG.TIENE_BATERIA){
    pFlujo($('f-bat-out'),db>.05,'#4fc3f7',db);
    pFlujo($('f-bat-in'),cb>.05,'#7c4dff',cb);
    $('n-bat').classList.toggle('act',cb>.05||db>.05);
  }
 
  $('n-solar').classList.toggle('act',sol>.05);
  $('n-fronius').classList.add('act');
  $('n-casa').classList.toggle('act',casa>.05);
  $('n-coche').classList.toggle('act',coche>.05);
  $('n-red').classList.toggle('act',exp>.05||imp>.05);
 
  const badge=$('estado-red');badge.className='badge';
  if(REAL&&ESTADO.offline){badge.classList.add('blue');badge.textContent='Sin datos recientes'}
  else if(REAL&&ESTADO.reposo){badge.classList.add('blue');badge.textContent='😴 Inversor en reposo'}
  else if(exp>.05){badge.classList.add('green');badge.textContent='⬆️ Exportando '+exp.toFixed(1)+' kW a la red'}
  else if(imp>.05){badge.classList.add('red');badge.textContent='⬇️ Importando '+imp.toFixed(1)+' kW de la red'}
  else if(cb>.05){badge.classList.add('blue');badge.textContent='🔋 Cargando batería'}
  else{badge.classList.add('blue');badge.textContent='♻️ Autoconsumo total'}
 
  $('lbl-solar').textContent=sol.toFixed(1)+' kW';
  $('lbl-casa').textContent=casa.toFixed(1)+' kW';
  $('lbl-coche').textContent=coche.toFixed(1)+' kW';
 
  if(REAL){
    $('sim-hora').parentElement.innerHTML='🕐 Última lectura: <b id="sim-hora" style="color:var(--t)">'+(ESTADO.ts?ESTADO.ts.toLocaleTimeString('es-ES'):'—')+'</b>';
  } else {
    const hh=String(Math.floor(E.h)).padStart(2,'0');
    const mm=String(Math.floor((E.h%1)*60)).padStart(2,'0');
    $('sim-hora').textContent=hh+':'+mm;
  }
 
  /* Fronius */
  $('fron-prod').textContent=sol.toFixed(1);
  $('fron-hoy').textContent=E.kwhFronius.toFixed(1)+' kWh';
  if(REAL){
    $('fron-temp').textContent='—';
    $('fron-pico').textContent=E.picoKw==null?'—':E.picoKw.toFixed(1)+' kW';
  } else {
    $('fron-temp').textContent=(32+sol*2+Math.random()*2).toFixed(0)+' °C';
    $('fron-pico').textContent='—';
  }
  const bf=$('badge-fronius');
  if(sol>.1){bf.className='badge green';bf.textContent='Produciendo'}
  else{bf.className='badge blue';bf.textContent='Standby'}
 
  /* Coche */
  const bc=$('badge-coche');bc.className='badge';
  if(E.cocheOn&&coche>.05){bc.classList.add('purple');bc.textContent=(E.cocheModo==='solar'?'☀️ Solar':'⚡ Cargando')}
  else if(E.cocheOn&&coche<=.05){bc.classList.add('blue');bc.textContent='⏸ En espera'}
  else{bc.classList.add('blue');bc.textContent='Desconectado'}
  $('coche-pot').textContent=coche.toFixed(1);
  $('coche-hoy').textContent=E.kwhCoche.toFixed(1)+' kWh';
  $('coche-sesion').textContent=REAL?'—':(E.cocheOn?(coche>.05?(Math.min(80,E.kwhCoche*8).toFixed(0)+' %'):'—'):'—');
  $('ico-coche').style.background=E.cocheOn?'rgba(179,136,255,.18)':'rgba(255,255,255,.05)';
  $('card-coche').classList.toggle('on',E.cocheOn&&coche>.05);
 
  /* Batería */
  if(CONFIG.TIENE_BATERIA){
    $('bat-nivel').textContent=Math.round(bat);
    $('bar-bat').style.width=bat+'%';
    const bb=$('badge-bat');
    if(cb>.05){bb.className='badge green';bb.textContent='Cargando'}
    else if(db>.05){bb.className='badge blue';bb.textContent='Descargando'}
    else{bb.className='badge blue';bb.textContent='En reposo'}
    $('bat-pot').textContent=(cb-db).toFixed(1)+' kW';
  }
  marcarIndicador();
}
 
/* ============================================================
   PASO DE SIMULACIÓN
   ============================================================ */
function pasoE(){
  if(E.auto){
    E.h=(E.h+.1)%24;
    const h=E.h;
    const cs=Math.max(0,Math.sin((h-6)/12*Math.PI))*5.6;
    const cc=.55+1.7*Math.exp(-Math.pow((h-7.5)/2,2))+2.3*Math.exp(-Math.pow((h-20.5)/2.4,2));
    E.sol=cl(cs*(.85+Math.random()*.3),0,7);
    E.casa=cl(cc*(.85+Math.random()*.3),.2,7);
    const s=$('in-solar'),c=$('in-casa');
    s.value=E.sol.toFixed(1);c.value=E.casa.toFixed(1);
    pintaS(s);pintaS(c);
  }
  bal();
  renderE();
}
 
/* ============================================================
   INTERACCIÓN COCHE (solo simulación)
   ============================================================ */
function tCoche(el){
  if(REAL) return;
  el.classList.toggle('on');
  E.cocheOn=el.classList.contains('on');
  bal();renderE();
}
function setModoCoche(modo){
  if(REAL) return;
  E.cocheModo=modo;
  $('modo-max').classList.toggle('active',modo==='max');
  $('modo-solar').classList.toggle('active',modo==='solar');
  bal();renderE();
}
 
/* ============================================================
   GRÁFICO 24 H
   ============================================================ */
function curve(p){
  if(p.length<2)return'';let d='M'+p[0][0]+','+p[0][1];
  for(let i=0;i<p.length-1;i++){
    const a=p[i-1]||p[i],b=p[i],c=p[i+1],e=p[i+2]||c;
    d+=' C'+(b[0]+(c[0]-a[0])/6)+','+(b[1]+(c[1]-a[1])/6)+' '+(c[0]-(e[0]-b[0])/6)+','+(c[1]-(e[1]-b[1])/6)+' '+c[0]+','+c[1];
  }
  return d;
}
function graf24(){
  const W=660,H=230,pL=40,pR=16,pT=16,pB=30,n=24;
  const mY=Math.max(5,Math.ceil(Math.max(...S24,...C24)));
  const px=i=>pL+(W-pL-pR)*i/(n-1),py=v=>H-pB-(H-pT-pB)*v/mY;
  const last=REAL?Math.min(HMAX,23):23;
  const dS=curve(S24.slice(0,last+1).map((v,i)=>[px(i),py(v)]));
  const dC=curve(C24.slice(0,last+1).map((v,i)=>[px(i),py(v)]));
  const base=' L'+px(last)+','+py(0)+' L'+px(0)+','+py(0)+' Z';
  $('line-solar').setAttribute('d',dS);
  $('line-cons').setAttribute('d',dC);
  $('area-solar').setAttribute('d',dS?dS+base:'');
  $('area-cons').setAttribute('d',dC?dC+base:'');
  let g='';
  for(let v=0;v<=mY;v++){const y=py(v);g+='<line class="grid-line" x1="'+pL+'" y1="'+y+'" x2="'+(W-pR)+'" y2="'+y+'"/><text class="ax-lbl" x="'+(pL-8)+'" y="'+(y+4)+'" text-anchor="end">'+v+'</text>'}
  [0,4,8,12,16,20,23].forEach(i=>{g+='<text class="ax-lbl" x="'+px(i)+'" y="'+(H-8)+'" text-anchor="middle">'+String(i).padStart(2,'0')+'h</text>'});
  g+='<text class="ax-lbl" x="'+(pL-8)+'" y="'+(pT-4)+'" text-anchor="end">kW</text>';
  $('chart-grid').innerHTML=g;
}
 
/* ============================================================
   KPIs DEL DÍA
   ============================================================ */
function kpis(){
  let p,c,coche,e,im;
  if(REAL){
    const h=DIAS.find(x=>x.dia===diaOffset(0))||{};
    p=Number(h.solar_kwh)||0;
    coche=Number(h.coche_kwh)||0;
    c=Number(h.casa_kwh)||0;                       // consumo total medido
    if(CONFIG.LOAD_INCLUYE_COCHE) c=Math.max(0,c-coche);   // casa sin coche
    e=Number(h.export_kwh)||0;
    im=Number(h.import_kwh)||0;
  } else {
    let a=0;p=0;c=0;
    for(let i=0;i<24;i++){p+=S24[i];c+=C24[i];a+=Math.min(S24[i],C24[i])}
    coche=8.4;e=p-a;im=c+coche-a;
  }
  const m=Math.max(p,c,coche,e,im,.1);
  $('kpi-prod').innerHTML=p.toFixed(1)+'<small>kWh</small>';
  $('kpi-cons').innerHTML=c.toFixed(1)+'<small>kWh</small>';
  $('kpi-coche').innerHTML=coche.toFixed(1)+'<small>kWh</small>';
  $('kpi-exp').innerHTML=e.toFixed(1)+'<small>kWh</small>';
  $('kpi-imp').innerHTML=im.toFixed(1)+'<small>kWh</small>';
  $('bar-prod').style.width=p/m*100+'%';
  $('bar-cons').style.width=c/m*100+'%';
  $('bar-coche').style.width=coche/m*100+'%';
  $('bar-exp').style.width=e/m*100+'%';
  $('bar-imp').style.width=im/m*100+'%';
  const total=c+coche, auto=Math.max(0,p-e);
  $('badge-auto').textContent='Autoconsumo '+(total>0?Math.min(100,Math.round(auto/total*100)):0)+'%';
}
 
/* ============================================================
   SEMANA
   ============================================================ */
const SEM_DEMO=[['Lun',22.4,29.1,12,10],['Mar',26.9,31.5,13.5,13],['Mié',18.2,30.2,11.2,7],['Jue',28.7,28.4,13.8,15],['Vie',24.1,33.8,13,11],['Sáb',30.5,36.2,15.2,15],['Dom',27.3,31.5,13.4,14]];
function datosSemana(){
  if(!REAL) return SEM_DEMO;
  const nom=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const out=[];
  for(let i=-6;i<=0;i++){
    const dia=diaOffset(i),r=DIAS.find(x=>x.dia===dia)||{};
    const p=Number(r.solar_kwh)||0,c=Number(r.casa_kwh)||0,ex=Number(r.export_kwh)||0;
    out.push([nom[new Date(dia+'T12:00:00').getDay()],p,c,Math.max(0,p-ex),ex]);
  }
  return out;
}
function semana(){
  const SEM=datosSemana();
  const max=Math.max(10,...SEM.flatMap(d=>[d[1],d[2]]));
  let p=0,c=0,a=0,ex=0;
  $('bars-semana').innerHTML=SEM.map(d=>{
    p+=d[1];c+=d[2];a+=d[3];ex+=d[4]||0;
    return '<div class="bar-group"><div class="bar-pair"><div class="bar solar" style="height:'+(d[1]/max*100).toFixed(1)+'%"></div><div class="bar cons" style="height:'+(d[2]/max*100).toFixed(1)+'%"></div></div><div class="bar-day">'+d[0]+'</div></div>';
  }).join('');
  $('sem-prod').textContent=p.toFixed(1)+' kWh';
  $('sem-cons').textContent=c.toFixed(1)+' kWh';
  $('sem-auto').textContent=(c>0?Math.min(100,Math.round(a/c*100)):0)+' %';
  $('sem-ahorro').textContent=(a*CONFIG.PRECIO_IMPORT+ex*CONFIG.PRECIO_EXCEDENTE).toFixed(2)+' €';
}
 
/* ============================================================
   INTERACCIÓN SLIDERS (solo simulación)
   ============================================================ */
['in-solar','in-casa'].forEach(id=>{
  const el=$(id);
  el.addEventListener('input',()=>{
    if(REAL) return;
    E.auto=false;$('btn-auto').textContent='▶ Reanudar simulación';
    if(id==='in-solar')E.sol=+el.value;else E.casa=+el.value;
    pintaS(el);bal();renderE();
  });
});
$('in-coche').addEventListener('input',e=>{
  E.cocheDeseada=+e.target.value;
  pintaS(e.target);
  if(!REAL){bal();renderE()}
});
$('btn-auto').addEventListener('click',()=>{
  if(REAL) return;
  E.auto=!E.auto;
  $('btn-auto').textContent=E.auto?'⏸ Pausar simulación':'▶ Reanudar simulación';
});
 
/* ============================================================
   ARRANQUE
   ============================================================ */
function initBateria(){
  if(CONFIG.TIENE_BATERIA){
    $('n-bat').style.display='';
    $('lbl-bat').style.display='';
    $('w-bat').style.display='';
    $('f-bat-out').style.display='';
    $('f-bat-in').style.display='';
    $('card-bat').style.display='';
  }
}
 
initBateria();
graf24();kpis();semana();
pintaS($('in-solar'));pintaS($('in-casa'));pintaS($('in-coche'));
 
if(REAL){
  renderE();
  iniciarSupabase();
} else {
  pasoE();
  setInterval(pasoE,1000);
}
 






