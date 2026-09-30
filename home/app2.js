/* ============================================================
   CONFIGURACIÓN — cambia aquí si instalas batería más adelante
   ============================================================ */
const TIENE_BATERIA = false;   // ← ponlo en `true` cuando tengas batería
const BAT_CAP = 10;            // kWh de capacidad
const BAT_MAX_POT = 3;         // kW máx de carga/descarga
const COCHE_MAX = 11;          // kW máx del wallbox
const FRONIUS_MODELO = 'Primo GEN24 6.0';

const $=id=>document.getElementById(id),cl=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- RELOJ ---------- */
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

/* ---------- LUCES ---------- */
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

/* ---------- TERMOSTATO ---------- */
let tempObj=22;
function temp(d){
  tempObj=cl(tempObj+d,10,30);
  $('temp-set').textContent=tempObj;
  document.querySelector('.dial .fg').style.strokeDashoffset=251.3*(1-(tempObj-10)/20);
}

/* ---------- ESCENAS ---------- */
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

/* ---------- NAV ---------- */
document.querySelectorAll('.nav-item').forEach(i=>i.addEventListener('click',()=>{
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
  i.classList.add('active');
  if(innerWidth<=900)document.querySelector('.sidebar').classList.remove('open');
}));

/* ---------- SIMULACIÓN DE SENSORES ---------- */
setInterval(()=>{
  const v=document.querySelectorAll('.sensor-val');
  if(v[0])v[0].textContent=(22+Math.random()*.6).toFixed(1)+' °C';
  if(v[1])v[1].textContent=(20+Math.random()*.6).toFixed(1)+' °C';
  if(v[2])v[2].textContent=(23.5+Math.random()*.6).toFixed(1)+' °C';
},5000);

/* ============================================================
   ENERGÍA SOLAR · FRONIUS · COCHE · BATERÍA OPCIONAL
   ============================================================ */
const E={
  h: 9,
  sol: 3,          // producción solar instantánea (kW)
  casa: 1.5,       // consumo casa (kW)
  cocheOn: false,
  cocheDeseada: 7.4,   // kW que quiere el coche
  coche: 0,            // kW efectivos de carga
  cocheModo: 'max',    // 'max' o 'solar'
  bat: 65,             // % de carga
  auto: true,
  cb:0, db:0, exp:0, imp:0,
  kwhCoche: 0,         // acumulado del coche hoy
  kwhFronius: 0,       // acumulado AC del inversor hoy
  kwhBat: 0            // acumulado batería hoy
};

/* --- Balance energético --- */
function bal(){
  // 1) Potencia efectiva del coche según modo
  let cochePot = 0;
  if(E.cocheOn){
    if(E.cocheModo === 'solar'){
      const excedente = Math.max(0, E.sol - E.casa);
      cochePot = Math.min(E.cocheDeseada, excedente);
    } else {
      cochePot = E.cocheDeseada;
    }
  }
  E.coche = cochePot;

  // 2) Balance neto
  const consTotal = E.casa + E.coche;
  const neto = E.sol - consTotal;

  let cb=0, db=0, ex=0, im=0;
  if(neto > 0){
    if(TIENE_BATERIA){
      const hd = cl((100 - E.bat)/10, 0, 1);
      cb = Math.min(neto, BAT_MAX_POT) * hd;
    }
    ex = neto - cb;
  } else if(neto < 0){
    if(TIENE_BATERIA){
      const dp = cl(E.bat/10, 0, 1);
      db = Math.min(-neto, BAT_MAX_POT) * dp;
    }
    im = -neto - db;
  }
  E.cb=cb; E.db=db; E.exp=ex; E.imp=im;
  if(TIENE_BATERIA) E.bat = cl(E.bat + (cb - db) * 0.6, 0, 100);

  // Acumulados (integrando 1 paso ≈ 1/60 h de simulación)
  const step = 0.1 / 60;  // en horas
  E.kwhFronius += E.sol * step;
  if(E.cocheOn) E.kwhCoche += E.coche * step;
  if(TIENE_BATERIA) E.kwhBat += Math.abs(cb - db) * step;
}

/* --- Pintar slider --- */
function pintaS(el){
  const a=+el.min,b=+el.max,v=+el.value;
  el.style.setProperty('--p',((v-a)/(b-a)*100)+'%');
}

/* --- Animación de flujos --- */
function pFlujo(el,on,col,p){
  if(!el)return;el.classList.toggle('on',on);if(!on)return;
  el.style.stroke=col;
  el.style.filter='drop-shadow(0 0 5px '+col+')';
  el.style.animationDuration=Math.max(.5,1.5-p*.15).toFixed(2)+'s';
}

/* --- Render del diagrama y tarjetas --- */
function renderE(){
  const{sol,casa,coche,cb,db,exp,imp,bat}=E;
  const consTotal = casa + coche;

  // Nodos
  $('v-solar').textContent = sol.toFixed(1)+' kW';
  $('v-casa').textContent  = casa.toFixed(1)+' kW';
  $('v-coche').textContent = coche>0.05 ? coche.toFixed(1)+' kW' : 'Apagado';
  $('v-fronius').textContent = sol.toFixed(1)+' kW';
  $('v-red').textContent   = (exp>.05 ? exp : imp).toFixed(1)+' kW';
  if(TIENE_BATERIA) $('v-bat').textContent = Math.round(bat)+' %';

  // Flujos
  pFlujo($('f-solar'), sol>.05, '#ffc107', sol);
  pFlujo($('f-casa'),  casa>.05, '#4fc3f7', casa);
  pFlujo($('f-coche'), coche>.05, '#b388ff', coche);
  pFlujo($('f-export'), exp>.05, '#4caf50', exp);
  pFlujo($('f-import'), imp>.05, '#ef5350', imp);
  if(TIENE_BATERIA){
    pFlujo($('f-bat-out'), db>.05, '#4fc3f7', db);
    pFlujo($('f-bat-in'),  cb>.05, '#7c4dff', cb);
    $('n-bat').classList.toggle('act', cb>.05||db>.05);
  }

  // Estados de nodos
  $('n-solar').classList.toggle('act', sol>.05);
  $('n-fronius').classList.add('act');
  $('n-casa').classList.toggle('act', casa>.05);
  $('n-coche').classList.toggle('act', coche>.05);
  $('n-red').classList.toggle('act', exp>.05||imp>.05);

  // Badge general
  const badge = $('estado-red');
  badge.className = 'badge';
  if(exp>.05){badge.classList.add('green');badge.textContent='⬆️ Exportando '+exp.toFixed(1)+' kW a la red'}
  else if(imp>.05){badge.classList.add('red');badge.textContent='⬇️ Importando '+imp.toFixed(1)+' kW de la red'}
  else if(cb>.05){badge.classList.add('blue');badge.textContent='🔋 Cargando batería'}
  else{badge.classList.add('blue');badge.textContent='♻️ Autoconsumo total'}

  // Labels de sliders
  $('lbl-solar').textContent = sol.toFixed(1)+' kW';
  $('lbl-casa').textContent  = casa.toFixed(1)+' kW';
  $('lbl-coche').textContent = coche.toFixed(1)+' kW';

  // Hora simulada
  const hh=String(Math.floor(E.h)).padStart(2,'0');
  const mm=String(Math.floor((E.h%1)*60)).padStart(2,'0');
  $('sim-hora').textContent = hh+':'+mm;

  /* --- Tarjeta Fronius --- */
  $('fron-prod').textContent = sol.toFixed(1);
  $('fron-hoy').textContent  = E.kwhFronius.toFixed(1)+' kWh';
  $('fron-temp').textContent = (32 + sol*2 + Math.random()*2).toFixed(0)+' °C';
  const bf = $('badge-fronius');
  if(sol>.1){bf.className='badge green';bf.textContent='Produciendo'}
  else{bf.className='badge blue';bf.textContent='Standby'}

  /* --- Tarjeta Coche --- */
  const bc = $('badge-coche');
  bc.className='badge';
  if(E.cocheOn && coche>.05){
    bc.classList.add('purple');
    bc.textContent = (E.cocheModo==='solar' ? '☀️ Solar' : '⚡ Cargando');
  } else if(E.cocheOn && coche<=.05){
    bc.classList.add('blue');
    bc.textContent='⏸ En espera';
  } else {
    bc.classList.add('blue');
    bc.textContent='Desconectado';
  }
  $('coche-pot').textContent  = coche.toFixed(1);
  $('coche-hoy').textContent  = E.kwhCoche.toFixed(1)+' kWh';
  $('coche-sesion').textContent = E.cocheOn ? (coche>.05 ? (Math.min(80, E.kwhCoche*8).toFixed(0)+' %') : '—') : '—';
  $('ico-coche').style.background = E.cocheOn ? 'rgba(179,136,255,.18)' : 'rgba(255,255,255,.05)';
  $('card-coche').classList.toggle('on', E.cocheOn && coche>.05);

  /* --- Tarjeta Batería --- */
  if(TIENE_BATERIA){
    $('bat-nivel').textContent = Math.round(bat);
    $('bar-bat').style.width = bat+'%';
    const bb = $('badge-bat');
    if(cb>.05){bb.className='badge green';bb.textContent='Cargando'}
    else if(db>.05){bb.className='badge blue';bb.textContent='Descargando'}
    else{bb.className='badge blue';bb.textContent='En reposo'}
    $('bat-pot').textContent = (cb-db).toFixed(1)+' kW';
  }
}

/* --- Paso de simulación --- */
function pasoE(){
  if(E.auto){
    E.h = (E.h + 0.1) % 24;
    const h = E.h;
    const cs = Math.max(0, Math.sin((h-6)/12*Math.PI)) * 5.6;
    const cc = 0.55 + 1.7*Math.exp(-Math.pow((h-7.5)/2,2)) + 2.3*Math.exp(-Math.pow((h-20.5)/2.4,2));
    E.sol  = cl(cs*(.85+Math.random()*.3), 0, 7);
    E.casa = cl(cc*(.85+Math.random()*.3), .2, 7);
    const s=$('in-solar'), c=$('in-casa');
    s.value = E.sol.toFixed(1); c.value = E.casa.toFixed(1);
    pintaS(s); pintaS(c);
  }
  bal(); renderE();
}

/* --- Interacción cargador coche --- */
function tCoche(el){
  el.classList.toggle('on');
  E.cocheOn = el.classList.contains('on');
  bal(); renderE();
}
function setModoCoche(modo){
  E.cocheModo = modo;
  $('modo-max').classList.toggle('active', modo==='max');
  $('modo-solar').classList.toggle('active', modo==='solar');
  bal(); renderE();
}

/* ============================================================
   GRÁFICO 24 H
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

/* ============================================================
   KPIs DEL DÍA
   ============================================================ */
function kpis(){
  let p=0,c=0,a=0;
  for(let i=0;i<24;i++){p+=S24[i];c+=C24[i];a+=Math.min(S24[i],C24[i])}
  const cocheKwh = 8.4;                     // estimado diario del coche
  const e = p - a;
  const im = c + cocheKwh - a;
  const m = Math.max(p, c, cocheKwh, e, im);

  $('kpi-prod').innerHTML  = p.toFixed(1)+'<small>kWh</small>';
  $('kpi-cons').innerHTML  = c.toFixed(1)+'<small>kWh</small>';
  $('kpi-coche').innerHTML = cocheKwh.toFixed(1)+'<small>kWh</small>';
  $('kpi-exp').innerHTML   = e.toFixed(1)+'<small>kWh</small>';
  $('kpi-imp').innerHTML   = im.toFixed(1)+'<small>kWh</small>';

  $('bar-prod').style.width  = p/m*100+'%';
  $('bar-cons').style.width  = c/m*100+'%';
  $('bar-coche').style.width = cocheKwh/m*100+'%';
  $('bar-exp').style.width   = e/m*100+'%';
  $('bar-imp').style.width   = im/m*100+'%';

  $('badge-auto').textContent = 'Autoconsumo '+Math.round(a/(c+cocheKwh)*100)+'%';
}

/* ============================================================
   BARRAS 7 DÍAS
   ============================================================ */
const SEM=[['Lun',22.4,29.1,12],['Mar',26.9,31.5,13.5],['Mié',18.2,30.2,11.2],['Jue',28.7,28.4,13.8],['Vie',24.1,33.8,13],['Sáb',30.5,36.2,15.2],['Dom',27.3,31.5,13.4]];
function semana(){
  let p=0,c=0,a=0;
  $('bars-semana').innerHTML = SEM.map(d=>{
    p+=d[1];c+=d[2];a+=d[3];
    return '<div class="bar-group"><div class="bar-pair"><div class="bar solar" style="height:'+(d[1]/40*100).toFixed(1)+'%"></div><div class="bar cons" style="height:'+(d[2]/40*100).toFixed(1)+'%"></div></div><div class="bar-day">'+d[0]+'</div></div>';
  }).join('');
  $('sem-prod').textContent = p.toFixed(1)+' kWh';
  $('sem-cons').textContent = c.toFixed(1)+' kWh';
  $('sem-auto').textContent = Math.round(a/c*100)+' %';
  $('sem-ahorro').textContent = (a*.15).toFixed(2)+' €';
}

/* ============================================================
   INTERACCIÓN SLIDERS PRINCIPALES
   ============================================================ */
['in-solar','in-casa'].forEach(id=>{
  const el=$(id);
  el.addEventListener('input',()=>{
    E.auto=false;$('btn-auto').textContent='▶ Reanudar simulación';
    if(id==='in-solar')E.sol=+el.value;else E.casa=+el.value;
    pintaS(el);bal();renderE();
  });
});
$('in-coche').addEventListener('input',e=>{
  E.cocheDeseada = +e.target.value;
  pintaS(e.target);
  bal();renderE();
});
$('btn-auto').addEventListener('click',()=>{
  E.auto=!E.auto;
  $('btn-auto').textContent = E.auto ? '⏸ Pausar simulación' : '▶ Reanudar simulación';
});

/* ============================================================
   ARRANQUE
   ============================================================ */
function initBateria(){
  if(TIENE_BATERIA){
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
pasoE();setInterval(pasoE,1000);