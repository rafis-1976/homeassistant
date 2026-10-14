/* ============================================================
   CONFIGURACIÓN
   ============================================================ */
const CONFIG = {
  USAR_DATOS_REALES: true,

  SUPABASE: {
    URL: 'https://mwzhyozqmsqmfpgtzeek.supabase.co',   // ← cambia esto
    KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13emh5b3pxbXNxbWZwZ3R6ZWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMjE3ODEsImV4cCI6MjEwNTc5Nzc4MX0.U03Ec0QqhWznmy9_pyyjvp0yS9vzuPy9FY01UvfZDs0',                 // ← cambia esto
    // Tabla y vistas (todas existen ya en tu Supabase)
    TABLA_ESTADO:  'estado_actual',
    TABLA_HIST:    'lecturas',
    VISTA_CURVA:   'curva_horaria',
    VISTA_DT:      'lecturas_dt',
    INTERVALO:     5000,
    // Interpretación de red_w:
    //   false → red_w positivo = IMPORTANDO (lo habitual)
    //   true  → red_w positivo = EXPORTANDO
    RED_POSITIVA_ES_EXPORT: false
  },

  TIENE_BATERIA: false,
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
   LUCES · TERMOSTATO · ESCENAS
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
let tempObj=22;
function temp(d){
  tempObj=cl(tempObj+d,10,30);
  const ts=$('temp-set'); if(ts) ts.textContent=tempObj;
  const fg=document.querySelector('.dial .fg');
  if(fg) fg.style.strokeDashoffset=251.3*(1-(tempObj-10)/20);
}
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
document.querySelectorAll('.nav-item').forEach(i=>i.addEventListener('click',()=>{
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
  i.classList.add('active');
  if(innerWidth<=900)document.querySelector('.sidebar').classList.remove('open');
}));

/* ============================================================
   ESTADO ENERGÉTICO
   ============================================================ */
const E={
  sol:0, casa:0, coche:0, cocheOn:false, cocheDeseada:7.4, cocheModo:'max',
  exp:0, imp:0, bat:65,
  energiaDiaKwh:0,   // viene de estado_actual
  kwhCoche:0
};

/* ============================================================
   SUPABASE · Fetch base
   ============================================================ */
async function supaFetch(path){
  const s=CONFIG.SUPABASE;
  const r=await fetch(s.URL+'/rest/v1/'+path,{
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

/* ============================================================
   LECTURA · estado_actual (fila única, id=1)
   ============================================================ */
async function leerEstadoActual(){
  const s=CONFIG.SUPABASE;
  const data=await supaFetch(
    s.TABLA_ESTADO+'?id=eq.1&select=*'
  );
  return data && data[0] ? data[0] : null;
}

/* ============================================================
   LECTURA · curva_horaria de un día concreto
   ============================================================ */
async function leerCurvaHoy(){
  const s=CONFIG.SUPABASE;
  const hoy=new Date();
  // Fecha en formato YYYY-MM-DD en zona Europe/Madrid
  const fmt=new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});
  const fecha=fmt.format(hoy);  // "2026-10-14"
  const data=await supaFetch(
    s.VISTA_CURVA+'?dia=eq.'+fecha+'&order=hora.asc'
  );
  return data||[];
}

/* ============================================================
   LECTURA · curva_horaria últimos N días
   ============================================================ */
async function leerCurvaSemana(dias){
  const s=CONFIG.SUPABASE;
  const fmt=new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});
  const desde=new Date(); desde.setDate(desde.getDate()-(dias-1));
  const fechaDesde=fmt.format(desde);
  return await supaFetch(
    s.VISTA_CURVA+'?dia=gte.'+fechaDesde+'&order=dia.asc,hora.asc'
  );
}

/* ============================================================
   APLICAR estado_actual al estado E
   ============================================================ */
function aplicarEstado(fila){
  if(!fila) return;
  const w=k=>{
    const v=parseFloat(fila[k]);
    return isNaN(v)?null:v/1000;   // W → kW
  };
  const solar=w('solar_w'), casa=w('casa_w'), coche=w('coche_w'), red=w('red_w');

  if(solar!==null) E.sol=solar;
  if(casa !==null) E.casa=casa;
  if(coche!==null){
    E.coche=coche;
    E.cocheOn=coche>0.05;
    const t=$('t-coche');
    if(t) t.classList.toggle('on',E.cocheOn);
  }

  if(red!==null){
    if(CONFIG.SUPABASE.RED_POSITIVA_ES_EXPORT){
      if(red>=0){E.exp=red;E.imp=0}
      else{E.exp=0;E.imp=-red}
    } else {
      if(red>=0){E.imp=red;E.exp=0}
      else{E.imp=0;E.exp=-red}
    }
  }

  if(fila.energia_dia_kwh!==undefined && fila.energia_dia_kwh!==null){
    E.energiaDiaKwh=parseFloat(fila.energia_dia_kwh)||0;
  }

  // Sincronizar sliders
  const s=$('in-solar'),cc=$('in-casa'),cch=$('in-coche');
  if(s)   {s.value=E.sol.toFixed(2);  pintaS(s);}
  if(cc)  {cc.value=E.casa.toFixed(2);pintaS(cc);}
  if(cch && E.cocheOn){cch.value=E.coche.toFixed(2);pintaS(cch);}

  renderE();
}

/* ============================================================
   POLLING estado_actual
   ============================================================ */
async function pollEstado(){
  try{
    const fila=await leerEstadoActual();
    if(fila){
      aplicarEstado(fila);
      marcarIndicador(true);
    } else {
      marcarIndicador(false,'sin fila id=1');
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
  const{sol,casa,coche,exp,imp}=E;

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

  setTxt('fron-prod',sol.toFixed(2));
  setTxt('fron-hoy',E.energiaDiaKwh.toFixed(2)+' kWh');
  setTxt('fron-temp',(32+sol*2).toFixed(0)+' °C');
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
  const ic=$('ico-coche'); if(ic) ic.style.background=E.cocheOn?'rgba(179,136,255,.18)':'rgba(255,255,255,.05)';
  toggleClass('card-coche','on',E.cocheOn&&coche>.05);

  // KPI "Producción solar hoy" en vivo con el valor de estado_actual
  if(E.energiaDiaKwh>0){
    setHTML('kpi-prod',E.energiaDiaKwh.toFixed(1)+'<small>kWh</small>');
  }
}

/* ============================================================
   GRÁFICO 24H · con datos reales de curva_horaria
   ============================================================ */
function curve(p){
  if(p.length<2)return'';let d='M'+p[0][0]+','+p[0][1];
  for(let i=0;i<p.length-1;i++){
    const a=p[i-1]||p[i],b=p[i],c=p[i+1],e=p[i+2]||c;
    d+=' C'+(b[0]+(c[0]-a[0])/6)+','+(b[1]+(c[1]-a[1])/6)+' '+(c[0]-(e[0]-b[0])/6)+','+(c[1]-(e[1]-b[1])/6)+' '+c[0]+','+c[1];
  }
  return d;
}

function dibujarGrid(mY){
  const W=660,H=230,pL=40,pR=16,pT=16,pB=30;
  const py=v=>H-pB-(H-pT-pB)*v/mY;
  const px=i=>pL+(W-pL-pR)*i/23;
  let g='';
  for(let v=0;v<=mY;v++){
    const y=py(v);
    g+='<line class="grid-line" x1="'+pL+'" y1="'+y+'" x2="'+(W-pR)+'" y2="'+y+'"/>';
    g+='<text class="ax-lbl" x="'+(pL-8)+'" y="'+(y+4)+'" text-anchor="end">'+v+'</text>';
  }
  [0,4,8,12,16,20,23].forEach(i=>{
    g+='<text class="ax-lbl" x="'+px(i)+'" y="'+(H-8)+'" text-anchor="middle">'+String(i).padStart(2,'0')+'h</text>';
  });
  g+='<text class="ax-lbl" x="'+(pL-8)+'" y="'+(pT-4)+'" text-anchor="end">kW</text>';
  $('chart-grid').innerHTML=g;
}

function dibujarCurva24h(datos){
  if(!$('line-solar')) return;

  // Rellenar arrays por hora (0-23)
  const solarH=Array(24).fill(null);
  const casaH =Array(24).fill(null);
  datos.forEach(r=>{
    const h=r.hora;
    if(h>=0&&h<24){
      solarH[h]=+r.solar_kw||0;
      casaH[h] =+r.casa_kw||0;
    }
  });

  // Si no hay datos, ocultar la curva
  if(datos.length===0){
    $('line-solar').setAttribute('d','');
    $('line-cons').setAttribute('d','');
    $('area-solar').setAttribute('d','');
    $('area-cons').setAttribute('d','');
    dibujarGrid(5);
    return;
  }

  // Máximo para escalar
  const maxY=Math.max(5,Math.ceil(Math.max(...solarH.filter(v=>v!==null),...casaH.filter(v=>v!==null))));
  const W=660,H=230,pL=40,pR=16,pT=16,pB=30,n=24;
  const px=i=>pL+(W-pL-pR)*i/(n-1),py=v=>H-pB-(H-pT-pB)*v/maxY;

  // Puntos (saltamos huecos con null)
  const puntosS=[],puntosC=[];
  for(let i=0;i<24;i++){
    if(solarH[i]!==null) puntosS.push([px(i),py(solarH[i])]);
    if(casaH[i] !==null) puntosC.push([px(i),py(casaH[i])]);
  }

  const dS=puntosS.length>1?curve(puntosS):'';
  const dC=puntosC.length>1?curve(puntosC):'';
  const base=' L'+px(23)+','+py(0)+' L'+px(0)+','+py(0)+' Z';

  $('line-solar').setAttribute('d',dS);
  $('line-cons').setAttribute('d',dC);
  $('area-solar').setAttribute('d',dS?dS+base:'');
  $('area-cons').setAttribute('d',dC?dC+base:'');

  dibujarGrid(maxY);
}

/* ============================================================
   KPIs DEL DÍA · a partir de curva_horaria de hoy
   ============================================================ */
function kpisDesdeCurva(datos){
  if(!$('kpi-prod')) return;

  // Sumar kWh (1 punto = 1 hora, así que kWh = suma de los kW)
  let solarKwh=0, casaKwh=0, autoconsumoKwh=0;
  datos.forEach(r=>{
    const s=+r.solar_kw||0, c=+r.casa_kw||0;
    solarKwh+=s;
    casaKwh+=c;
    autoconsumoKwh+=Math.min(s,c);
  });

  const exportado=Math.max(0,solarKwh-autoconsumoKwh);
  const importado=Math.max(0,casaKwh-autoconsumoKwh);
  const m=Math.max(solarKwh,casaKwh,exportado,importado,1);

  // Si tenemos el valor oficial de estado_actual, lo usamos
  const solarMostrar=E.energiaDiaKwh>0?E.energiaDiaKwh:solarKwh;

  setHTML('kpi-prod',solarMostrar.toFixed(1)+'<small>kWh</small>');
  setHTML('kpi-cons',casaKwh.toFixed(1)+'<small>kWh</small>');
  setHTML('kpi-coche',E.kwhCoche.toFixed(1)+'<small>kWh</small>');
  setHTML('kpi-exp',exportado.toFixed(1)+'<small>kWh</small>');
  setHTML('kpi-imp',importado.toFixed(1)+'<small>kWh</small>');

  setWidth('bar-prod',solarMostrar/m*100+'%');
  setWidth('bar-cons',casaKwh/m*100+'%');
  setWidth('bar-coche',E.kwhCoche/m*100+'%');
  setWidth('bar-exp',exportado/m*100+'%');
  setWidth('bar-imp',importado/m*100+'%');

  const auto=casaKwh>0?Math.round(autoconsumoKwh/casaKwh*100):0;
  setTxt('badge-auto','Autoconsumo '+auto+'%');
}

/* ============================================================
   BARRAS SEMANALES · agrupando curva_horaria por día
   ============================================================ */
function semanaDesdeCurva(datos){
  if(!$('bars-semana')) return;

  // Agrupar por día
  const porDia={};
  datos.forEach(r=>{
    const k=r.dia;
    if(!porDia[k]) porDia[k]={dia:k,solar:0,casa:0};
    porDia[k].solar+=+r.solar_kw||0;
    porDia[k].casa +=+r.casa_kw||0;
  });

  // Ordenar por fecha y coger los últimos 7
  const arr=Object.values(porDia).sort((a,b)=>a.dia.localeCompare(b.dia)).slice(-7);

  // Máximo para escalar
  const maxV=Math.max(1,...arr.map(d=>Math.max(d.solar,d.casa)));

  const nombres=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  let prod=0,cons=0,auto=0;
  $('bars-semana').innerHTML=arr.map(d=>{
    prod+=d.solar; cons+=d.casa; auto+=Math.min(d.solar,d.casa);
    const fecha=new Date(d.dia+'T12:00:00');
    const nm=nombres[fecha.getDay()];
    return '<div class="bar-group">'+
      '<div class="bar-pair">'+
        '<div class="bar solar" style="height:'+(d.solar/maxV*100).toFixed(1)+'%"></div>'+
        '<div class="bar cons" style="height:'+(d.casa/maxV*100).toFixed(1)+'%"></div>'+
      '</div>'+
      '<div class="bar-day">'+nm+'</div>'+
    '</div>';
  }).join('');

  setTxt('sem-prod',prod.toFixed(1)+' kWh');
  setTxt('sem-cons',cons.toFixed(1)+' kWh');
  setTxt('sem-auto',(cons>0?Math.round(auto/cons*100):0)+' %');
  setTxt('sem-ahorro',(auto*.15).toFixed(2)+' €');
}

/* ============================================================
   CARGA INICIAL + REFRESCO PERIÓDICO de gráficas
   ============================================================ */
async function cargarGraficas(){
  try{
    const curvaHoy=await leerCurvaHoy();
    dibujarCurva24h(curvaHoy);
    kpisDesdeCurva(curvaHoy);
  }catch(e){
    console.warn('Error curva hoy:',e.message);
  }
  try{
    const curvaSem=await leerCurvaSemana(7);
    semanaDesdeCurva(curvaSem);
  }catch(e){
    console.warn('Error semana:',e.message);
  }
}

/* ============================================================
   SLIDERS (solo activos si desactivas datos reales)
   ============================================================ */
['in-solar','in-casa'].forEach(id=>{
  const el=$(id);
  if(!el) return;
  el.addEventListener('input',()=>{
    if(CONFIG.USAR_DATOS_REALES) return;
    if(id==='in-solar')E.sol=+el.value;else E.casa=+el.value;
    pintaS(el);renderE();
  });
});
const cocheSlider=$('in-coche');
if(cocheSlider){
  cocheSlider.addEventListener('input',e=>{
    E.cocheDeseada=+e.target.value;
    pintaS(e.target);
  });
}
const btnAuto=$('btn-auto');
if(btnAuto){
  btnAuto.addEventListener('click',()=>{
    if(CONFIG.USAR_DATOS_REALES){
      alert('Estás en modo datos reales.');
      return;
    }
  });
}

function tCoche(el){
  el.classList.toggle('on');
  E.cocheOn=el.classList.contains('on');
  renderE();
}
function setModoCoche(modo){
  E.cocheModo=modo;
  toggleClass('modo-max','active',modo==='max');
  toggleClass('modo-solar','active',modo==='solar');
  renderE();
}

/* ============================================================
   ARRANQUE
   ============================================================ */
function iniciarSupabase(){
  if(!CONFIG.USAR_DATOS_REALES) return;
  const btn=$('btn-auto');
  if(btn){btn.textContent='🔄 Modo datos reales';btn.style.opacity='.7'}

  // Estado en vivo cada 5 s
  pollEstado();
  setInterval(pollEstado, CONFIG.SUPABASE.INTERVALO);

  // Gráficas cada 60 s (son datos que cambian despacio)
  cargarGraficas();
  setInterval(cargarGraficas, 60000);
}

// Arranque
pintaS($('in-solar'));
pintaS($('in-casa'));
pintaS($('in-coche'));

if(CONFIG.USAR_DATOS_REALES){
  iniciarSupabase();
} else {
  renderE();
}