/* ============================================================
   CONFIGURACIÓN
   ============================================================ */
const CONFIG = {
  // ← Activa los datos reales
  USAR_DATOS_REALES: true,

  SUPABASE: {
    URL: 'https://mwzhyozqmsqmfpgtzeek.supabase.co',   // ← cambia esto
    KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13emh5b3pxbXNxbWZwZ3R6ZWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMjE3ODEsImV4cCI6MjEwNTc5Nzc4MX0.U03Ec0QqhWznmy9_pyyjvp0yS9vzuPy9FY01UvfZDs0',                 // ← cambia esto
    TABLA: 'lecturas',
    COLUMNAS: {
      solar:     'solar_w',      // W
      casa:      'casa_w',       // W
      coche:     'coche_w',      // W
      red:       'red_w',        // W
      bat:       null,           // no hay batería
      timestamp: 'ts'
    },
    INTERVALO: 5000,
    // true si red_w > 0 significa que ESTÁS EXPORTANDO
    // false si red_w > 0 significa que ESTÁS IMPORTANDO (lo habitual)
    RED_POSITIVA_ES_EXPORT: false
  },

  TIENE_BATERIA: false,
  BAT_CAP: 10,
  BAT_MAX_POT: 3,
  COCHE_MAX: 11,
  FRONIUS_MODELO: 'Primo GEN24 6.0'
};

const $=id=>document.getElementById(id),cl=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ============================================================
   RELOJ
   ============================================================ */
function reloj(){
  const d=new Date();
  const h=String(d.getHours()).padStart(2,'0');
  const m=String(d.getMinutes()).padStart(2,'0');
  const rl=$('reloj'); if(rl) rl.textContent=h+':'+m;
  const dias=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const mes=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const fc=$('fecha'); if(fc) fc.textContent=dias[d.getDay()]+', '+d.getDate()+' de '+mes[d.getMonth()];
  const hr=d.getHours();
  const txt=hr>=6&&hr<13?'Buenos días 👋':hr>=13&&hr<20?'Buenas tardes 👋':'Buenas noches 👋';
  const sg=$('saludo'); if(sg) sg.textContent=txt;
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
  const ts=$('temp-set'); if(ts) ts.textContent=tempObj;
  const fg=document.querySelector('.dial .fg');
  if(fg) fg.style.strokeDashoffset=251.3*(1-(tempObj-10)/20);
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
function setT(t){
  tempObj=t;
  const ts=$('temp-set'); if(ts) ts.textContent=t;
  const fg=document.querySelector('.dial .fg');
  if(fg) fg.style.strokeDashoffset=251.3*(1-(t-10)/20);
}

/* ============================================================
   NAV
   ============================================================ */
document.querySelectorAll('.nav-item').forEach(i=>i.addEventListener('click',()=>{
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
  i.classList.add('active');
  if(innerWidth<=900)document.querySelector('.sidebar').classList.remove('open');
}));

/* ============================================================
   FLUCTUACIÓN DE TEMPERATURA
   ============================================================ */
setInterval(()=>{
  const v=document.querySelectorAll('.sensor-val');
  const esTemp=t=>t&&t.includes('°C');
  if(v[0]&&esTemp(v[0].textContent)) v[0].textContent=(22+Math.random()*.6).toFixed(1)+' °C';
  if(v[1]&&esTemp(v[1].textContent)) v[1].textContent=(20+Math.random()*.6).toFixed(1)+' °C';
  if(v[2]&&esTemp(v[2].textContent)) v[2].textContent=(23.5+Math.random()*.6).toFixed(1)+' °C';
},5000);

/* ============================================================
   ESTADO ENERGÉTICO
   ============================================================ */
const E={
  h:9,
  sol:0, casa:0, coche:0, cocheOn:false, cocheDeseada:7.4, cocheModo:'max',
  bat:65, auto:false,
  cb:0, db:0, exp:0, imp:0,
  kwhCoche:0, kwhFronius:0, kwhBat:0
};

/* ============================================================
   BALANCE (simulación)
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
  if(neto>0){ex=neto}
  else if(neto<0){im=-neto}
  E.cb=cb;E.db=db;E.exp=ex;E.imp=im;
  const step=0.1/60;
  E.kwhFronius+=E.sol*step;
  if(E.cocheOn) E.kwhCoche+=E.coche*step;
}

/* ============================================================
   SUPABASE
   ============================================================ */
async function supaFetch(path){
  const s=CONFIG.SUPABASE;
  const url=s.URL+'/rest/v1/'+path;
  const r=await fetch(url,{
    headers:{
      'apikey': s.KEY,
      'Authorization': 'Bearer '+s.KEY,
      'Content-Type': 'application/json'
    }
  });
  if(!r.ok){
    const txt=await r.text();
    throw new Error('Supabase '+r.status+': '+txt);
  }
  return r.json();
}

async function supaUltimaFila(){
  const s=CONFIG.SUPABASE;
  const sel='ts,solar_w,casa_w,red_w,coche_w';
  const data=await supaFetch(
    s.TABLA+'?select='+sel+'&order='+s.COLUMNAS.timestamp+'.desc&limit=1'
  );
  return data && data[0] ? data[0] : null;
}

async function supaHoy(){
  const s=CONFIG.SUPABASE;
  const sel='ts,solar_w,casa_w,red_w,coche_w';
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  const iso=hoy.toISOString();
  return await supaFetch(
    s.TABLA+'?select='+sel+'&'+s.COLUMNAS.timestamp+'=gte.'+iso+
    '&order='+s.COLUMNAS.timestamp+'.asc'
  );
}

function aplicarSupabase(fila){
  if(!fila) return;
  const c=CONFIG.SUPABASE.COLUMNAS;

  const numW=k=>{
    const v=parseFloat(fila[k]);
    return isNaN(v)?null:v/1000;   // W → kW
  };

  const solar=numW(c.solar);
  const casa =numW(c.casa);
  const coche=numW(c.coche);
  const red  =numW(c.red);

  if(solar!==null) E.sol=solar;
  if(casa !==null) E.casa=casa;
  if(coche!==null){
    E.coche=coche;
    E.cocheOn=coche>0.05;
    const t=$('t-coche');
    if(t) t.classList.toggle('on',E.cocheOn);
  }

  // Interpretación de red_w
  if(red!==null){
    if(CONFIG.SUPABASE.RED_POSITIVA_ES_EXPORT){
      if(red>=0){E.exp=red;E.imp=0}
      else{E.imp=-red;E.exp=0}
    } else {
      if(red>=0){E.imp=red;E.exp=0}
      else{E.exp=-red;E.imp=0}
    }
  }

  const s=$('in-solar'),cc=$('in-casa'),cch=$('in-coche');
  if(s)   {s.value=E.sol.toFixed(1);  pintaS(s);}
  if(cc)  {cc.value=E.casa.toFixed(1);pintaS(cc);}
  if(cch && E.cocheOn){cch.value=E.coche.toFixed(1);pintaS(cch);}

  renderE();
}

async function pollSupabase(){
  try{
    const fila=await supaUltimaFila();
    if(fila){
      aplicarSupabase(fila);
      marcarIndicador(true);
    } else {
      marcarIndicador(false,'sin filas');
    }
  }catch(e){
    marcarIndicador(false,e.message);
    console.warn('Supabase:',e.message);
  }
}

/* ============================================================
   INDICADOR
   ============================================================ */
function marcarIndicador(ok,msg){
  const ind=$('data-indicator')||crearIndicador();
  if(!ind) return;
  ind.textContent = ok?'🟢 Supabase':'🔴 Error';
  ind.style.color = ok?'var(--g)':'var(--r)';
  ind.title = ok?'Datos en directo desde Supabase':('Error: '+(msg||'sin conexión'));
}
function crearIndicador(){
  const head=document.querySelector('.energy-card .card-name');
  if(!head) return null;
  const el=document.createElement('span');
  el.id='data-indicator';
  el.style.cssText='font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;background:rgba(255,255,255,.05);margin-left:8px;cursor:help;letter-spacing:.4px';
  head.appendChild(el);
  return el;
}

/* ============================================================
   RENDER
   ============================================================ */
function pintaS(el){
  if(!el) return;
  const a=+el.min,b=+el.max,v=+el.value;
  el.style.setProperty('--p',((v-a)/(b-a)*100)+'%');
}
function pFlujo(el,on,col,p){
  if(!el)return;el.classList.toggle('on',on);if(!on)return;
  el.style.stroke=col;
  el.style.filter='drop-shadow(0 0 5px '+col+')';
  el.style.animationDuration=Math.max(.5,1.5-p*.15).toFixed(2)+'s';
}
function setTxt(id,txt){const el=$(id);if(el)el.textContent=txt;}
function setHTML(id,html){const el=$(id);if(el)el.innerHTML=html;}
function setWidth(id,w){const el=$(id);if(el)el.style.width=w;}
function addClass(id,c){const el=$(id);if(el)el.classList.add(c);}
function toggleClass(id,c,v){const el=$(id);if(el)el.classList.toggle(c,v);}

function renderE(){
  const{sol,casa,coche,cb,db,exp,imp,bat}=E;

  setTxt('v-solar',sol.toFixed(2)+' kW');
  setTxt('v-casa',casa.toFixed(2)+' kW');
  setTxt('v-coche',coche>0.05?coche.toFixed(2)+' kW':'Apagado');
  setTxt('v-fronius',sol.toFixed(2)+' kW');
  setTxt('v-red',(exp>.05?exp:imp).toFixed(2)+' kW');

  pFlujo($('f-solar'),sol>.05,'#ffc107',sol);
  pFlujo($('f-casa'),casa>.05,'#4fc3f7',casa);
  pFlujo($('f-coche'),coche>.05,'#b388ff',coche);
  pFlujo($('f-export'),exp>.05,'#4caf50',exp);
  pFlujo($('f-import'),imp>.05,'#ef5350',imp);

  toggleClass('n-solar','act',sol>.05);
  addClass('n-fronius','act');
  toggleClass('n-casa','act',casa>.05);
  toggleClass('n-coche','act',coche>.05);
  toggleClass('n-red','act',exp>.05||imp>.05);

  const badge=$('estado-red');
  if(badge){
    badge.className='badge';
    if(exp>.05){badge.classList.add('green');badge.textContent='⬆️ Exportando '+exp.toFixed(2)+' kW a la red'}
    else if(imp>.05){badge.classList.add('red');badge.textContent='⬇️ Importando '+imp.toFixed(2)+' kW de la red'}
    else{badge.classList.add('blue');badge.textContent='♻️ Autoconsumo total'}
  }

  setTxt('lbl-solar',sol.toFixed(2)+' kW');
  setTxt('lbl-casa',casa.toFixed(2)+' kW');
  setTxt('lbl-coche',coche.toFixed(2)+' kW');

  const hh=String(Math.floor(E.h)).padStart(2,'0');
  const mm=String(Math.floor((E.h%1)*60)).padStart(2,'0');
  setTxt('sim-hora',hh+':'+mm);

  setTxt('fron-prod',sol.toFixed(2));
  setTxt('fron-hoy',E.kwhFronius.toFixed(2)+' kWh');
  setTxt('fron-temp',(32+sol*2+Math.random()*2).toFixed(0)+' °C');
  const bf=$('badge-fronius');
  if(bf){
    if(sol>.05){bf.className='badge green';bf.textContent='Produciendo'}
    else{bf.className='badge blue';bf.textContent='Standby'}
  }

  const bc=$('badge-coche');
  if(bc){
    bc.className='badge';
    if(E.cocheOn&&coche>.05){bc.classList.add('purple');bc.textContent=(E.cocheModo==='solar'?'☀️ Solar':'⚡ Cargando')}
    else if(E.cocheOn&&coche<=.05){bc.classList.add('blue');bc.textContent='⏸ En espera'}
    else{bc.classList.add('blue');bc.textContent='Desconectado'}
  }
  setTxt('coche-pot',coche.toFixed(2));
  setTxt('coche-hoy',E.kwhCoche.toFixed(2)+' kWh');
  setTxt('coche-sesion',E.cocheOn?(coche>.05?(Math.min(80,E.kwhCoche*8).toFixed(0)+' %'):'—'):'—');
  const ic=$('ico-coche'); if(ic) ic.style.background=E.cocheOn?'rgba(179,136,255,.18)':'rgba(255,255,255,.05)';
  toggleClass('card-coche','on',E.cocheOn&&coche>.05);
}

/* ============================================================
   SIMULACIÓN (por si desactivas datos reales)
   ============================================================ */
function pasoE(){
  if(E.auto && !CONFIG.USAR_DATOS_REALES){
    E.h=(E.h+.1)%24;
    const h=E.h;
    const cs=Math.max(0,Math.sin((h-6)/12*Math.PI))*5.6;
    const cc=.55+1.7*Math.exp(-Math.pow((h-7.5)/2,2))+2.3*Math.exp(-Math.pow((h-20.5)/2.4,2));
    E.sol=cl(cs*(.85+Math.random()*.3),0,7);
    E.casa=cl(cc*(.85+Math.random()*.3),.2,7);
    const s=$('in-solar'),c=$('in-casa');
    if(s){s.value=E.sol.toFixed(1);pintaS(s)}
    if(c){c.value=E.casa.toFixed(1);pintaS(c)}
    bal();
  }
  if(!CONFIG.USAR_DATOS_REALES) renderE();
}

function tCoche(el){
  el.classList.toggle('on');
  E.cocheOn=el.classList.contains('on');
  bal();renderE();
}
function setModoCoche(modo){
  E.cocheModo=modo;
  toggleClass('modo-max','active',modo==='max');
  toggleClass('modo-solar','active',modo==='solar');
  bal();renderE();
}

/* ============================================================
   GRÁFICO 24H · KPIs · SEMANA (estáticos)
   ============================================================ */
const S24=[0,0,0,0,0,0,.1,.4,1.1,2,3,3.9,4.3,4,3.3,2.4,1.4,.7,.2,.05,0,0,0,0];
const C24=[.7,.6,.5,.5,.5,.7,1.3,2.2,1.7,1.1,1,1.3,1.7,1.4,1.2,1.3,1.9,2.7,2.5,2,1.6,1.3,1,.8];
function curve(p){
  if(p.length<2)return'';let d='M'+p[0][0]+','+p[0][1];
  for(let i=0;i<p.length-1;i++){
    const a=p[i-1]||p[i],b=p[i],c=p[i+1],e=p[i+2]||c;
    d+=' C'+(b[0]+(c[0]-a[0])/6)+','+(b[1]+(c[1]-a[1])/6)+' '+(c[0]-(e[0]-b[0])/6)+','+(c[1]-(e[1]-b[1])/6)+' '+c[0]+','+c[1];
  }
  return d;
}
function graf24(){
  if(!$('line-solar')) return;
  const W=660,H=230,pL=40,pR=16,pT=16,pB=30,mY=5,n=24;
  const px=i=>pL+(W-pL-pR)*i/(n-1),py=v=>H-pB-(H-pT-pB)*v/mY;
  const dS=curve(S24.map((v,i)=>[px(i),py(v)]));
  const dC=curve(C24.map((v,i)=>[px(i),py(v)]));
  const base=' L'+px(23)+','+py(0)+' L'+px(0)+','+py(0)+' Z';
  $('line-solar').setAttribute('d',dS);
  $('line-cons').setAttribute('d',dC);
  $('area-solar').setAttribute('d',dS+base);
  $('area-cons').setAttribute('d',dC+base);
  let g='';
  for(let v=0;v<=mY;v++){const y=py(v);g+='<line class="grid-line" x1="'+pL+'" y1="'+y+'" x2="'+(W-pR)+'" y2="'+y+'"/><text class="ax-lbl" x="'+(pL-8)+'" y="'+(y+4)+'" text-anchor="end">'+v+'</text>'}
  [0,4,8,12,16,20,23].forEach(i=>{g+='<text class="ax-lbl" x="'+px(i)+'" y="'+(H-8)+'" text-anchor="middle">'+String(i).padStart(2,'0')+'h</text>'});
  g+='<text class="ax-lbl" x="'+(pL-8)+'" y="'+(pT-4)+'" text-anchor="end">kW</text>';
  $('chart-grid').innerHTML=g;
}
function kpis(){
  if(!$('kpi-prod')) return;
  let p=0,c=0,a=0;
  for(let i=0;i<24;i++){p+=S24[i];c+=C24[i];a+=Math.min(S24[i],C24[i])}
  const cocheKwh=8.4;
  const e=p-a;
  const im=c+cocheKwh-a;
  const m=Math.max(p,c,cocheKwh,e,im);
  setHTML('kpi-prod',p.toFixed(1)+'<small>kWh</small>');
  setHTML('kpi-cons',c.toFixed(1)+'<small>kWh</small>');
  setHTML('kpi-coche',cocheKwh.toFixed(1)+'<small>kWh</small>');
  setHTML('kpi-exp',e.toFixed(1)+'<small>kWh</small>');
  setHTML('kpi-imp',im.toFixed(1)+'<small>kWh</small>');
  setWidth('bar-prod',p/m*100+'%');
  setWidth('bar-cons',c/m*100+'%');
  setWidth('bar-coche',cocheKwh/m*100+'%');
  setWidth('bar-exp',e/m*100+'%');
  setWidth('bar-imp',im/m*100+'%');
  setTxt('badge-auto','Autoconsumo '+Math.round(a/(c+cocheKwh)*100)+'%');
}
const SEM=[['Lun',22.4,29.1,12],['Mar',26.9,31.5,13.5],['Mié',18.2,30.2,11.2],['Jue',28.7,28.4,13.8],['Vie',24.1,33.8,13],['Sáb',30.5,36.2,15.2],['Dom',27.3,31.5,13.4]];
function semana(){
  if(!$('bars-semana')) return;
  let p=0,c=0,a=0;
  $('bars-semana').innerHTML=SEM.map(d=>{
    p+=d[1];c+=d[2];a+=d[3];
    return '<div class="bar-group"><div class="bar-pair"><div class="bar solar" style="height:'+(d[1]/40*100).toFixed(1)+'%"></div><div class="bar cons" style="height:'+(d[2]/40*100).toFixed(1)+'%"></div></div><div class="bar-day">'+d[0]+'</div></div>';
  }).join('');
  setTxt('sem-prod',p.toFixed(1)+' kWh');
  setTxt('sem-cons',c.toFixed(1)+' kWh');
  setTxt('sem-auto',Math.round(a/c*100)+' %');
  setTxt('sem-ahorro',(a*.15).toFixed(2)+' €');
}

/* ============================================================
   SLIDERS
   ============================================================ */
['in-solar','in-casa'].forEach(id=>{
  const el=$(id);
  if(!el) return;
  el.addEventListener('input',()=>{
    if(CONFIG.USAR_DATOS_REALES) return;
    E.auto=false; setTxt('btn-auto','▶ Reanudar simulación');
    if(id==='in-solar')E.sol=+el.value;else E.casa=+el.value;
    pintaS(el);bal();renderE();
  });
});
const cocheSlider=$('in-coche');
if(cocheSlider){
  cocheSlider.addEventListener('input',e=>{
    E.cocheDeseada=+e.target.value;
    pintaS(e.target);
    if(!CONFIG.USAR_DATOS_REALES){bal();renderE()}
  });
}
const btnAuto=$('btn-auto');
if(btnAuto){
  btnAuto.addEventListener('click',()=>{
    if(CONFIG.USAR_DATOS_REALES){
      alert('Estás en modo datos reales.');
      return;
    }
    E.auto=!E.auto;
    btnAuto.textContent=E.auto?'⏸ Pausar simulación':'▶ Reanudar simulación';
  });
}

/* ============================================================
   ARRANQUE
   ============================================================ */
function iniciarSupabase(){
  if(!CONFIG.USAR_DATOS_REALES) return;
  const btn=$('btn-auto');
  if(btn){btn.textContent='🔄 Modo datos reales';btn.style.opacity='.7'}
  pollSupabase();
  setInterval(pollSupabase, CONFIG.SUPABASE.INTERVALO);
}

graf24();
kpis();
semana();
pintaS($('in-solar'));
pintaS($('in-casa'));
pintaS($('in-coche'));

if(!CONFIG.USAR_DATOS_REALES){
  pasoE();
  setInterval(pasoE,1000);
} else {
  iniciarSupabase();
}