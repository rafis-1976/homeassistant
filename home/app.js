/* ============================================================
   APP.JS · Lógica de la interfaz
   Requiere supabase-config.js cargado antes.
   ============================================================ */

const CONFIG = {
  USAR_DATOS_REALES: true,
  SUPABASE: {
    URL: SUPABASE_URL,
    KEY: SUPABASE_KEY,
    TABLA_ESTADO: 'estado_actual',
    TABLA_HIST:   'lecturas',
    VISTA_CURVA:  'curva_horaria',
    INTERVALO:    5000,
    RED_POSITIVA_ES_EXPORT: false
  },
  TIENE_BATERIA: false,
  COCHE_MAX: 11
};

const $=id=>document.getElementById(id),cl=(v,a,b)=>Math.max(a,Math.min(b,v));

const TZ = 'Europe/Madrid';
const _fmtFecha = new Intl.DateTimeFormat('fr-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'});
const _fmtHora  = new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',hour12:false});
const _fmtMin   = new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false});
const fechaMadrid   = d => _fmtFecha.format(d);
const minutosMadrid = d => { const [h,m]=_fmtMin.format(d).split(':').map(Number); return h*60+m; };

const fmtW = kw => Math.round((kw||0)*1000) + ' W';

/* ============================================================
   SERIES VISIBLES (persistidas en localStorage)
   Solar, Casa, Coche y Excedente vendido son conmutables.
   Las líneas de Red (export/import) han sido eliminadas.
   ============================================================ */
const SERIES_DEFAULT = {
  'solar': true,
  'casa':  true,
  'coche': true,
  'venta': true
};

const Series = (function(){
  let estado = {...SERIES_DEFAULT};
  try{
    const guardado = localStorage.getItem('chart-series');
    if(guardado){
      const obj = JSON.parse(guardado);
      estado = Object.assign({}, SERIES_DEFAULT, obj);
    }
  }catch(e){}
  function guardar(){
    try{ localStorage.setItem('chart-series', JSON.stringify(estado)); }catch(e){}
  }
  return {
    visible: (k) => estado[k] !== false,
    toggle: (k) => { estado[k] = !estado[k]; guardar(); return estado[k]; }
  };
})();

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
   LUCES / TERMOSTATO / ESCENAS
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
const E={sol:0,casa:0,coche:0,cocheOn:false,cocheDeseada:7.4,cocheModo:'max',
  exp:0,imp:0,bat:65,energiaDiaKwh:0,kwhCoche:0};

/* ============================================================
   SUPABASE · fetch base
   ============================================================ */
async function supaFetch(path){
  const s=CONFIG.SUPABASE;
  const r=await fetch(s.URL+'/rest/v1/'+path,{
    headers:{'apikey':s.KEY,'Authorization':'Bearer '+s.KEY,'Content-Type':'application/json'}
  });
  if(!r.ok){const t=await r.text();throw new Error('Supabase '+r.status+': '+t)}
  return r.json();
}

async function leerEstadoActual(){
  const d=await supaFetch(CONFIG.SUPABASE.TABLA_ESTADO+'?id=eq.1&select=*');
  return d&&d[0]?d[0]:null;
}

async function leerLecturasHoras(horas){
  const s=CONFIG.SUPABASE;
  const filas = await supaFetch(
    s.TABLA_HIST+'?select=ts,solar_w,casa_w,red_w,coche_w'+
    '&order=ts.desc&limit=1000'
  );
  return filas.reverse();
}

async function leerCurvaDias(dias){
  const s=CONFIG.SUPABASE;
  const desde=new Date(); desde.setDate(desde.getDate()-(dias-1));
  const desdeStr=fechaMadrid(desde);
  return await supaFetch(
    s.VISTA_CURVA+'?dia=gte.'+desdeStr+'&order=dia.asc,hora.asc'
  );
}

/* ============================================================
   INDICADOR
   ============================================================ */
function marcarIndicador(ok,msg){
  const ind=$('data-indicator')||crearIndicador();
  if(!ind)return;
  ind.textContent=ok?'🟢 Supabase':'🔴 Error';
  ind.style.color=ok?'var(--g)':'var(--r)';
  ind.title=ok?'Datos en directo desde Supabase':('Error: '+(msg||'sin conexión'));
}
function crearIndicador(){
  const head=document.querySelector('.energy-card .card-name');
  if(!head)return null;
  const el=document.createElement('span');
  el.id='data-indicator';
  el.style.cssText='font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;background:rgba(255,255,255,.05);margin-left:8px;cursor:help;letter-spacing:.4px';
  head.appendChild(el);return el;
}

/* ============================================================
   HELPERS
   ============================================================ */
function pintaS(el){
  if(!el)return;
  const a=+el.min,b=+el.max,v=+el.value;
  el.style.setProperty('--p',((v-a)/(b-a)*100)+'%');
}
function pFlujo(el,on,col,p){
  if(!el)return;el.classList.toggle('on',on);if(!on)return;
  el.style.stroke=col;el.style.filter='drop-shadow(0 0 5px '+col+')';
  el.style.animationDuration=Math.max(.5,1.5-p*.15).toFixed(2)+'s';
}
function setTxt(id,t){const e=$(id);if(e)e.textContent=t}
function setHTML(id,h){const e=$(id);if(e)e.innerHTML=h}
function setWidth(id,w){const e=$(id);if(e)e.style.width=w}
function addClass(id,c){const e=$(id);if(e)e.classList.add(c)}
function toggleClass(id,c,v){const e=$(id);if(e)e.classList.toggle(c,v)}

/* ============================================================
   RENDER · flujo en W
   ============================================================ */
function renderE(){
  const{sol,casa,coche,exp,imp}=E;

  setTxt('v-solar',  fmtW(sol));
  setTxt('v-casa',   fmtW(casa));
  setTxt('v-coche',  coche>0.005 ? fmtW(coche) : 'Apagado');
  setTxt('v-fronius',fmtW(sol));
  setTxt('v-red',    fmtW(exp>0.005 ? exp : imp));

  pFlujo($('f-solar'),sol>.005,'#ffc107',sol);
  pFlujo($('f-casa'),casa>.005,'#4fc3f7',casa);
  pFlujo($('f-coche'),coche>.005,'#b388ff',coche);
  pFlujo($('f-export'),exp>.005,'#4caf50',exp);
  pFlujo($('f-import'),imp>.005,'#ef5350',imp);

  toggleClass('n-solar','act',sol>.005);
  addClass('n-fronius','act');
  toggleClass('n-casa','act',casa>.005);
  toggleClass('n-coche','act',coche>.005);
  toggleClass('n-red','act',exp>.005||imp>.005);

  const b=$('estado-red');
  if(b){
    b.className='badge';
    if(exp>.005){b.classList.add('green');b.textContent='⬆️ Exportando '+fmtW(exp)+' a la red'}
    else if(imp>.005){b.classList.add('red');b.textContent='⬇️ Importando '+fmtW(imp)+' de la red'}
    else{b.classList.add('blue');b.textContent='♻️ Autoconsumo total'}
  }

  setTxt('lbl-solar', fmtW(sol));
  setTxt('lbl-casa',  fmtW(casa));
  setTxt('lbl-coche', fmtW(coche));

  setTxt('fron-prod', Math.round(sol*1000));
  setTxt('fron-hoy',  E.energiaDiaKwh.toFixed(2)+' kWh');
  setTxt('fron-temp', (32+sol*2).toFixed(0)+' °C');
  const bf=$('badge-fronius');
  if(bf){
    if(sol>.005){bf.className='badge green';bf.textContent='Produciendo'}
    else{bf.className='badge blue';bf.textContent='Standby'}
  }

  const bc=$('badge-coche');
  if(bc){
    bc.className='badge';
    if(E.cocheOn&&coche>.005){bc.classList.add('purple');bc.textContent=(E.cocheModo==='solar'?'☀️ Solar':'⚡ Cargando')}
    else if(E.cocheOn&&coche<=.005){bc.classList.add('blue');bc.textContent='⏸ En espera'}
    else{bc.classList.add('blue');bc.textContent='Desconectado'}
  }
  setTxt('coche-pot', Math.round(coche*1000));
  const ic=$('ico-coche'); if(ic) ic.style.background=E.cocheOn?'rgba(179,136,255,.18)':'rgba(255,255,255,.05)';
  toggleClass('card-coche','on',E.cocheOn&&coche>.005);
}

/* ============================================================
   APLICAR estado_actual
   ============================================================ */
function aplicarEstado(fila){
  if(!fila) return;
  const w=k=>{const v=parseFloat(fila[k]);return isNaN(v)?null:v/1000};
  const solar=w('solar_w'),casa=w('casa_w'),coche=w('coche_w'),red=w('red_w');

  if(solar!==null) E.sol=solar;
  if(casa!==null) E.casa=casa;
  if(coche!==null){
    E.coche=coche; E.cocheOn=coche>0.005;
    const t=$('t-coche'); if(t) t.classList.toggle('on',E.cocheOn);
  }
  if(red!==null){
    if(CONFIG.SUPABASE.RED_POSITIVA_ES_EXPORT){
      if(red>=0){E.exp=red;E.imp=0} else {E.exp=0;E.imp=-red}
    } else {
      if(red>=0){E.imp=red;E.exp=0} else {E.imp=0;E.exp=-red}
    }
  }
  if(fila.energia_dia_kwh!=null) E.energiaDiaKwh=parseFloat(fila.energia_dia_kwh)||0;

  const s=$('in-solar'),cc=$('in-casa'),cch=$('in-coche');
  if(s){s.value=E.sol.toFixed(2);pintaS(s)}
  if(cc){cc.value=E.casa.toFixed(2);pintaS(cc)}
  if(cch&&E.cocheOn){cch.value=E.coche.toFixed(2);pintaS(cch)}
  renderE();
}
async function pollEstado(){
  try{
    const f=await leerEstadoActual();
    if(f){aplicarEstado(f);marcarIndicador(true)}
    else marcarIndicador(false,'sin fila id=1');
  }catch(e){marcarIndicador(false,e.message);console.warn('Supabase:',e.message)}
}

/* ============================================================
   GRÁFICA DETALLADA
   ============================================================ */
const ChartDet={rango:'24h',crudo:[],puntos:null,escala:null,modo:null};

function prepararPuntos24h(filas){
  const hoyStr = fechaMadrid(new Date());
  const pts = [];
  filas.forEach(f=>{
    const t = new Date(f.ts);
    if(fechaMadrid(t) !== hoyStr) return;
    const min = minutosMadrid(t);
    pts.push({
      min: min,
      label: String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0'),
      solar: (+f.solar_w||0)/1000,
      casa:  (+f.casa_w ||0)/1000,
      coche: (+f.coche_w||0)/1000,
      red:   (+f.red_w  ||0)/1000
    });
  });
  pts.sort((a,b)=>a.min-b.min);
  return pts;
}

function prepararPuntos7d(filas){
  const porDia = {};
  filas.forEach(f=>{
    const k = f.dia;
    if(!porDia[k]) porDia[k] = {solar:0, casa:0};
    porDia[k].solar += (+f.solar_kw||0);
    porDia[k].casa  += (+f.casa_kw ||0);
  });
  const nombres=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const arr = [];
  for(let i=6;i>=0;i--){
    const d = new Date();
    d.setDate(d.getDate()-i);
    const key = fechaMadrid(d);
    const datos = porDia[key] || {solar:0, casa:0};
    arr.push({
      dia: key,
      label: nombres[d.getDay()],
      labelFull: nombres[d.getDay()]+' '+String(d.getDate()).padStart(2,'0'),
      solar: datos.solar,
      casa: datos.casa,
      esHoy: key === fechaMadrid(new Date())
    });
  }
  return arr;
}

function curve(p){
  if(p.length<2)return'';
  let d='M'+p[0][0]+','+p[0][1];
  for(let i=0;i<p.length-1;i++){
    const a=p[i-1]||p[i],b=p[i],c=p[i+1],e=p[i+2]||c;
    d+=' C'+(b[0]+(c[0]-a[0])/6)+','+(b[1]+(c[1]-a[1])/6)+
       ' '+(c[0]-(e[0]-b[0])/6)+','+(c[1]-(e[1]-b[1])/6)+
       ' '+c[0]+','+c[1];
  }
  return d;
}

function dibujarChartDet(){
  const svg=$('chart-det');
  if(!svg) return;
  let gBars = svg.querySelector('#chart-det-bars');
  if(!gBars){
    gBars = document.createElementNS('http://www.w3.org/2000/svg','g');
    gBars.id = 'chart-det-bars';
    svg.appendChild(gBars);
  }
  gBars.innerHTML='';

  if(ChartDet.rango==='24h'){
    ChartDet.modo='line';
    dibujar24hLineas(gBars);
  } else {
    ChartDet.modo='bars';
    dibujar7dBarras(gBars);
  }
}

function dibujar24hLineas(gBars){
  const puntos = prepararPuntos24h(ChartDet.crudo);
  const W=900,H=340,pL=50,pR=20,pT=20,pB=40;
  const innerW=W-pL-pR, innerH=H-pT-pB;
  gBars.innerHTML='';

  const valsFlat = puntos.flatMap(p=>[p.solar,p.casa,p.coche,p.red]);
  if(valsFlat.length===0){
    $('chart-det-grid').innerHTML='<text x="'+W/2+'" y="'+(H/2)+'" text-anchor="middle" fill="#9aa0a6" font-size="14">Sin datos hoy</text>';
    ['det-area-solar','det-area-venta','det-line-solar','det-line-casa','det-line-coche']
      .forEach(id=>{const e=$(id); if(e) e.setAttribute('d','')});
    const st=$('chart-det-stats'); if(st) st.innerHTML='';
    return;
  }

  const maxV=Math.max(1,...valsFlat);
  const minV=Math.min(0,...puntos.map(p=>p.red));
  const spanV=Math.max(0.5,maxV-minV);
  const px=min=>pL+innerW*min/1440;
  const py=v=>pT+innerH*(1-(v-minV)/spanV);

  let g='';
  const pasos=5;
  for(let i=0;i<=pasos;i++){
    const v=minV+spanV*i/pasos;
    const y=py(v);
    g+='<line class="grid-line" x1="'+pL+'" y1="'+y+'" x2="'+(W-pR)+'" y2="'+y+'"/>';
    g+='<text class="ax-lbl" x="'+(pL-8)+'" y="'+(y+4)+'" text-anchor="end">'+v.toFixed(1)+'</text>';
  }
  for(let h=0;h<=24;h+=2){
    const x=px(h*60);
    g+='<line class="grid-line" x1="'+x+'" y1="'+pT+'" x2="'+x+'" y2="'+(H-pB)+'" opacity=".4"/>';
    g+='<text class="ax-lbl" x="'+x+'" y="'+(H-12)+'" text-anchor="middle">'+String(h).padStart(2,'0')+'h</text>';
  }
  g+='<text class="ax-lbl" x="'+(pL-8)+'" y="'+(pT-4)+'" text-anchor="end">kW</text>';

  if(minV<0){
    g+='<line x1="'+pL+'" y1="'+py(0)+'" x2="'+(W-pR)+'" y2="'+py(0)+'" stroke="#4fc3f7" stroke-width="1" stroke-dasharray="2 4" opacity=".5"/>';
  }
  $('chart-det-grid').innerHTML=g;

  const linea=(getter,filtro)=>{
    const pts=[];
    puntos.forEach(p=>{
      const v=getter(p);
      if(v===null||v===undefined) return;
      if(filtro&&!filtro(v)) return;
      pts.push([px(p.min),py(v)]);
    });
    return pts.length>1?curve(pts):'';
  };

  const dSolar = Series.visible('solar') ? linea(p=>p.solar) : '';
  const dCasa  = Series.visible('casa')  ? linea(p=>p.casa)  : '';
  const dCoche = Series.visible('coche') ? linea(p=>p.coche,v=>v>0.01) : '';

  $('det-line-solar').setAttribute('d',dSolar);
  $('det-line-casa').setAttribute('d',dCasa);
  $('det-line-coche').setAttribute('d',dCoche);

  // Área amarilla de excedente vendido (conmutable)
  if(Series.visible('venta')){
    const y0 = py(0);
    const ptsVenta = puntos.map(p=>{
      const esVenta = (p.red !== null && p.red !== undefined && p.red < -0.01);
      return [px(p.min), esVenta ? py(p.red) : y0];
    });
    let dVenta = '';
    if(ptsVenta.length > 1){
      dVenta = 'M ' + ptsVenta[0][0] + ',' + y0 + ' ' +
               ptsVenta.map(pt => 'L ' + pt[0] + ',' + pt[1]).join(' ') +
               ' L ' + ptsVenta[ptsVenta.length-1][0] + ',' + y0 + ' Z';
    }
    $('det-area-venta').setAttribute('d', dVenta);
  } else {
    $('det-area-venta').setAttribute('d','');
  }

  let dots='';
  puntos.forEach(p=>{
    if(Series.visible('solar') && p.solar>0)
      dots+='<circle cx="'+px(p.min)+'" cy="'+py(p.solar)+'" r="2" fill="#ffc107" opacity=".8"/>';
    if(Series.visible('casa') && p.casa>0)
      dots+='<circle cx="'+px(p.min)+'" cy="'+py(p.casa )+'" r="2" fill="#4fc3f7" opacity=".7"/>';
  });
  gBars.innerHTML=dots;

  if(dSolar){
    const base=' L'+px(1440)+','+py(0)+' L'+px(0)+','+py(0)+' Z';
    $('det-area-solar').setAttribute('d',dSolar+base);
  } else $('det-area-solar').setAttribute('d','');

  ChartDet.puntos=puntos;
  ChartDet.escala={px,py,pL,pR,pT,pB,W,H};
  dibujarStats24h(puntos);
}

function dibujar7dBarras(gBars){
  const datos = prepararPuntos7d(ChartDet.crudo);
  const W=900,H=340,pL=50,pR=20,pT=20,pB=60;
  const innerW=W-pL-pR, innerH=H-pT-pB;

  ['det-area-solar','det-area-venta','det-line-solar','det-line-casa','det-line-coche']
    .forEach(id=>{const e=$(id); if(e) e.setAttribute('d','')});

  const maxV = Math.max(1, ...datos.flatMap(d=>[d.solar,d.casa]));
  const yMax = Math.ceil(maxV*1.1);

  let g='';
  const pasos=5;
  for(let i=0;i<=pasos;i++){
    const v=yMax*i/pasos;
    const y=pT+innerH*(1-i/pasos);
    g+='<line class="grid-line" x1="'+pL+'" y1="'+y+'" x2="'+(W-pR)+'" y2="'+y+'"/>';
    g+='<text class="ax-lbl" x="'+(pL-8)+'" y="'+(y+4)+'" text-anchor="end">'+v.toFixed(1)+'</text>';
  }
  g+='<text class="ax-lbl" x="'+(pL-8)+'" y="'+(pT-4)+'" text-anchor="end">kWh</text>';
  $('chart-det-grid').innerHTML=g;

  const nDias = datos.length;
  const anchoGrupo = innerW / nDias;
  const anchoBarra = Math.min(38, anchoGrupo * 0.32);
  const gap = 6;

  const verSolar = Series.visible('solar');
  const verCasa  = Series.visible('casa');

  let bars='';
  let etiquetas='';
  const pyBar = v => pT + innerH * (1 - v/yMax);

  datos.forEach((d,i)=>{
    const cx = pL + anchoGrupo*(i + 0.5);
    const yS = pyBar(d.solar);
    const yC = pyBar(d.casa);
    const hS = pT + innerH - yS;
    const hC = pT + innerH - yC;

    if(verSolar && verCasa){
      const xS = cx - gap/2 - anchoBarra;
      const xC = cx + gap/2;
      bars+='<rect x="'+xS.toFixed(1)+'" y="'+yS.toFixed(1)+'" width="'+anchoBarra.toFixed(1)+'" height="'+Math.max(0,hS).toFixed(1)+'" rx="4" fill="#ffc107" opacity=".9"/>';
      bars+='<rect x="'+xC.toFixed(1)+'" y="'+yC.toFixed(1)+'" width="'+anchoBarra.toFixed(1)+'" height="'+Math.max(0,hC).toFixed(1)+'" rx="4" fill="#4fc3f7" opacity=".85"/>';
    } else if(verSolar){
      const x = cx - anchoBarra;
      bars+='<rect x="'+x.toFixed(1)+'" y="'+yS.toFixed(1)+'" width="'+(anchoBarra*2).toFixed(1)+'" height="'+Math.max(0,hS).toFixed(1)+'" rx="4" fill="#ffc107" opacity=".9"/>';
    } else if(verCasa){
      const x = cx - anchoBarra;
      bars+='<rect x="'+x.toFixed(1)+'" y="'+yC.toFixed(1)+'" width="'+(anchoBarra*2).toFixed(1)+'" height="'+Math.max(0,hC).toFixed(1)+'" rx="4" fill="#4fc3f7" opacity=".85"/>';
    }

    const colorEt = d.esHoy ? '#4fc3f7' : '#9aa0a6';
    const pesoEt  = d.esHoy ? '700' : '400';
    etiquetas+='<text x="'+cx.toFixed(1)+'" y="'+(H-30)+'" text-anchor="middle" fill="'+colorEt+'" font-size="12" font-weight="'+pesoEt+'" font-family="inherit">'+d.label+'</text>';
    etiquetas+='<text x="'+cx.toFixed(1)+'" y="'+(H-14)+'" text-anchor="middle" fill="#6b7280" font-size="10" font-family="inherit">'+d.labelFull.split(' ')[1]+'</text>';

    bars+='<rect x="'+(cx-anchoGrupo/2).toFixed(1)+'" y="'+pT+'" width="'+anchoGrupo.toFixed(1)+'" height="'+innerH+'" fill="transparent" class="bar-hit" data-idx="'+i+'"/>';
  });

  gBars.innerHTML = bars + etiquetas;

  ChartDet.puntos = datos;
  ChartDet.escala = {px:null,py:pyBar,pL,pR,pT,pB,W,H,anchoGrupo,nDias};
  dibujarStats7d(datos);
}

function dibujarStats24h(puntos){
  const el=$('chart-det-stats'); if(!el) return;
  const val=k=>puntos.map(p=>p[k]).filter(v=>v!==null&&v!==undefined);
  const prom=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
  const max =a=>a.length?Math.max(...a):0;

  const sV=val('solar'),cV=val('casa'),chV=val('coche'),rV=val('red');
  const u=' kW';
  const nPuntos=puntos.length;
  const bloque=(color,valor,texto)=>`
    <div class="stat">
      <span class="dot" style="background:${color}"></span>
      <div><b>${valor}</b><small>${texto}</small></div>
    </div>`;

  let html = '';
  if(Series.visible('solar')){
    html += bloque('#ffc107', prom(sV).toFixed(2)+u, '☀️ Solar · media ('+nPuntos+' lecturas)');
    html += bloque('#ffc107', max(sV).toFixed(2)+u,  '☀️ Solar · pico');
  }
  if(Series.visible('casa')){
    html += bloque('#4fc3f7', prom(cV).toFixed(2)+u, '🏠 Casa · media');
    html += bloque('#4fc3f7', max(cV).toFixed(2)+u,  '🏠 Casa · pico');
  }
  if(Series.visible('coche')){
    html += bloque('#b388ff', prom(chV).toFixed(2)+u,'🚗 Coche · media');
  }
  if(Series.visible('venta')){
    const excV = (rV.length?Math.abs(Math.min(0,...rV)):0);
    html += bloque('#ffeb3b', excV.toFixed(2)+u, '💰 Excedente vendido · pico');
  }

  el.innerHTML = html || '<div style="color:var(--td);font-size:12px;padding:8px">Todas las series están ocultas.</div>';
}

function dibujarStats7d(datos){
  const el=$('chart-det-stats'); if(!el) return;
  const totalS = datos.reduce((s,d)=>s+d.solar,0);
  const totalC = datos.reduce((s,d)=>s+d.casa,0);
  const auto   = datos.reduce((s,d)=>s+Math.min(d.solar,d.casa),0);
  const bloque=(color,valor,texto)=>`
    <div class="stat">
      <span class="dot" style="background:${color}"></span>
      <div><b>${valor}</b><small>${texto}</small></div>
    </div>`;

  let html = '';
  if(Series.visible('solar')){
    html += bloque('#ffc107', totalS.toFixed(1)+' kWh', '☀️ Solar · total semana');
  }
  if(Series.visible('casa')){
    html += bloque('#4fc3f7', totalC.toFixed(1)+' kWh', '🏠 Casa · total semana');
  }
  if(Series.visible('solar') && Series.visible('casa')){
    html += bloque('#b388ff', (totalC>0?Math.round(auto/totalC*100):0)+' %', '♻️ Autoconsumo');
    html += bloque('#8bc34a', (auto*0.15).toFixed(2)+' €', '💶 Ahorro estimado');
  }

  el.innerHTML = html || '<div style="color:var(--td);font-size:12px;padding:8px">Todas las series están ocultas.</div>';
}

/* ============================================================
   HOVER
   ============================================================ */
function initHoverChartDet(){
  const svg=$('chart-det'); if(!svg) return;
  const tooltip=$('chart-det-tooltip');
  svg.addEventListener('mousemove',e=>{
    if(!ChartDet.puntos||!ChartDet.escala) return;
    const rect=svg.getBoundingClientRect();
    const xVB=(e.clientX-rect.left)/rect.width*900;
    if(ChartDet.modo==='line') hover24h(xVB,e,rect);
    else hover7d(xVB,e,rect);
  });
  svg.addEventListener('mouseleave',()=>{
    const h=$('chart-det-hover'); if(h) h.style.display='none';
    if(tooltip) tooltip.classList.remove('show');
  });
}
function hover24h(xVB,evt,rect){
  const{px}=ChartDet.escala;
  let idx=0,dist=Infinity;
  ChartDet.puntos.forEach((p,i)=>{
    const d=Math.abs(px(p.min)-xVB);
    if(d<dist){dist=d;idx=i}
  });
  const p=ChartDet.puntos[idx];
  if(!p) return;
  const x=px(p.min);
  const hov=$('chart-det-hover'); hov.style.display='';
  const cr=$('det-cross');
  cr.setAttribute('x1',x); cr.setAttribute('x2',x);
  cr.setAttribute('y1',20); cr.setAttribute('y2',300);

  const{py}=ChartDet.escala;
  const setDot=(id,v,visible)=>{
    const el=$(id);
    if(!visible||v===null||v===undefined||v===0){el.style.display='none';return}
    el.style.display='';
    el.setAttribute('cx',x);
    el.setAttribute('cy',py(v));
  };
  setDot('det-dot-solar',p.solar, Series.visible('solar'));
  setDot('det-dot-casa', p.casa,  Series.visible('casa'));
  setDot('det-dot-coche',p.coche, Series.visible('coche'));

  const tt=$('chart-det-tooltip'); if(!tt) return;
  const fmt=v=>(v===null||v===undefined)?'—':v.toFixed(2)+' kW';

  let html = '<div style="font-weight:600;color:#4fc3f7;margin-bottom:4px">'+p.label+'</div>';
  if(Series.visible('solar')) html += '<div><span class="dot" style="background:#ffc107"></span>Solar<b>'+fmt(p.solar)+'</b></div>';
  if(Series.visible('casa'))  html += '<div><span class="dot" style="background:#4fc3f7"></span>Casa<b>'+fmt(p.casa)+'</b></div>';
  if(Series.visible('coche')) html += '<div><span class="dot" style="background:#b388ff"></span>Coche<b>'+fmt(p.coche)+'</b></div>';
  if(Series.visible('venta') && p.red < -0.01){
    html += '<div><span class="dot" style="background:#ffeb3b"></span>Excedente<b>'+fmt(-p.red)+'</b></div>';
  }
  tt.innerHTML = html;
  tt.classList.add('show');
  posicionarTooltip(tt,evt,rect);
}
function hover7d(xVB,evt,rect){
  const{pL,pR,W,anchoGrupo,nDias}=ChartDet.escala;
  const rel = xVB - pL;
  let idx = Math.floor(rel/anchoGrupo);
  if(idx<0) idx=0; if(idx>=nDias) idx=nDias-1;
  const d=ChartDet.puntos[idx];
  if(!d) return;

  const cx = pL + anchoGrupo*(idx+0.5);
  const hov=$('chart-det-hover'); hov.style.display='';
  const cr=$('det-cross');
  cr.setAttribute('x1',cx); cr.setAttribute('x2',cx);
  cr.setAttribute('y1',20); cr.setAttribute('y2',280);

  ['det-dot-solar','det-dot-casa','det-dot-coche'].forEach(id=>{
    const e=$(id); if(e) e.style.display='none';
  });

  const tt=$('chart-det-tooltip'); if(!tt) return;
  const auto = Math.min(d.solar,d.casa);
  let html = '<div style="font-weight:600;color:#4fc3f7;margin-bottom:4px">'+d.labelFull+'</div>';
  if(Series.visible('solar')) html += '<div><span class="dot" style="background:#ffc107"></span>Solar<b>'+d.solar.toFixed(2)+' kWh</b></div>';
  if(Series.visible('casa'))  html += '<div><span class="dot" style="background:#4fc3f7"></span>Casa<b>'+d.casa.toFixed(2)+' kWh</b></div>';
  if(Series.visible('solar') && Series.visible('casa'))
    html += '<div style="border-top:1px solid #2a2f3a;margin-top:4px;padding-top:4px"><span class="dot" style="background:#b388ff"></span>Autoconsumo<b>'+auto.toFixed(2)+' kWh</b></div>';
  tt.innerHTML = html;
  tt.classList.add('show');
  posicionarTooltip(tt,evt,rect);
}
function posicionarTooltip(tt,evt,rect){
  const wrap=tt.parentElement.getBoundingClientRect();
  let left=(evt.clientX-wrap.left)+16;
  let top =(evt.clientY-wrap.top)-30;
  const ttW=200, ttH=130;
  if(left+ttW>wrap.width) left=left-ttW-30;
  if(left<0) left=10;
  if(top<0) top=10;
  if(top+ttH>wrap.height) top=wrap.height-ttH-10;
  tt.style.left=left+'px';
  tt.style.top =top+'px';
}

async function cargarChartDet(){
  try{
    if(ChartDet.rango==='24h'){
      const filas = await leerLecturasHoras(26);
      ChartDet.crudo = filas;
    } else {
      const filas = await leerCurvaDias(7);
      ChartDet.crudo = filas;
    }
    dibujarChartDet();
  }catch(e){
    console.warn('Error chart det:',e.message);
  }
}
function setRango(r){
  ChartDet.rango=r;
  document.querySelectorAll('.range-btn').forEach(b=>{
    b.classList.toggle('active',b.dataset.rango===r);
  });
  cargarChartDet();
}

/* ============================================================
   BOTONES DE SERIES
   ============================================================ */
function initSerieBotones(){
  const cont = $('serie-btns');
  if(!cont) return;

  cont.querySelectorAll('.serie-btn').forEach(btn=>{
    const k = btn.dataset.serie;
    btn.classList.toggle('active', Series.visible(k));
    btn.addEventListener('click', ()=>{
      const activo = Series.toggle(k);
      btn.classList.toggle('active', activo);
      dibujarChartDet();
    });
  });
}

/* ============================================================
   BARRAS SEMANALES
   ============================================================ */
async function cargarSemana(){
  if(!$('bars-semana')) return;
  try{
    const filas=await leerCurvaDias(7);
    const porDia={};
    filas.forEach(f=>{
      const k=f.dia;
      if(!porDia[k]) porDia[k]={solar:0,casa:0};
      porDia[k].solar += (+f.solar_kw||0);
      porDia[k].casa  += (+f.casa_kw ||0);
    });
    const arr=[];
    for(let i=6;i>=0;i--){
      const d=new Date();
      d.setDate(d.getDate()-i);
      const key=fechaMadrid(d);
      const datos=porDia[key]||{solar:0,casa:0};
      arr.push({fecha:key,dia:d,solar:datos.solar,casa:datos.casa});
    }
    dibujarSemana(arr);
  }catch(e){
    console.warn('Error semana:',e.message);
  }
}
function dibujarSemana(arr){
  const el=$('bars-semana'); if(!el) return;
  const nombres=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const maxV=Math.max(1,...arr.map(d=>Math.max(d.solar,d.casa)));
  let totalProd=0,totalCons=0;
  el.innerHTML=arr.map(d=>{
    totalProd+=d.solar; totalCons+=d.casa;
    const hS=maxV>0?(d.solar/maxV*100):0;
    const hC=maxV>0?(d.casa /maxV*100):0;
    const esHoy=fechaMadrid(d.dia)===fechaMadrid(new Date());
    return '<div class="bar-group" title="'+d.fecha+'">' +
      '<div class="bar-pair">' +
        '<div class="bar solar" style="height:'+hS.toFixed(1)+'%"></div>' +
        '<div class="bar cons"  style="height:'+hC.toFixed(1)+'%"></div>' +
      '</div>' +
      '<div class="bar-day" '+(esHoy?'style="color:var(--a);font-weight:700"':'')+'>'+nombres[d.dia.getDay()]+'</div>' +
    '</div>';
  }).join('');
  setTxt('sem-prod',totalProd.toFixed(1)+' kWh');
  setTxt('sem-cons',totalCons.toFixed(1)+' kWh');
  const auto=totalCons>0?Math.round(Math.min(totalProd,totalCons)/totalCons*100):0;
  setTxt('sem-auto',auto+' %');
  setTxt('sem-ahorro',(Math.min(totalProd,totalCons)*0.15).toFixed(2)+' €');
}

/* ============================================================
   SLIDERS / COCHE
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
const cs=$('in-coche'); if(cs) cs.addEventListener('input',e=>{E.cocheDeseada=+e.target.value;pintaS(e.target)});
const btnAuto=$('btn-auto');
if(btnAuto) btnAuto.addEventListener('click',()=>{
  if(CONFIG.USAR_DATOS_REALES){alert('Estás en modo datos reales.');return}
});
function tCoche(el){
  el.classList.toggle('on');
  E.cocheOn=el.classList.contains('on');
  renderE();
}
function setModoCoche(m){
  E.cocheModo=m;
  toggleClass('modo-max','active',m==='max');
  toggleClass('modo-solar','active',m==='solar');
  renderE();
}

/* ============================================================
   ARRANQUE
   ============================================================ */
function iniciarSupabase(){
  if(!CONFIG.USAR_DATOS_REALES) return;
  const b=$('btn-auto');
  if(b){b.textContent='🔄 Modo datos reales';b.style.opacity='.7'}

  pollEstado();
  setInterval(pollEstado, CONFIG.SUPABASE.INTERVALO);

  cargarChartDet();
  setInterval(cargarChartDet, 60000);

  cargarSemana();
  setInterval(cargarSemana, 300000);

  initHoverChartDet();
  initSerieBotones();
}

pintaS($('in-solar'));
pintaS($('in-casa'));
pintaS($('in-coche'));
renderE();

if(CONFIG.USAR_DATOS_REALES) iniciarSupabase();