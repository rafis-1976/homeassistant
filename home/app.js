/* ============================================================
   CONFIGURACIÓN
   ============================================================ */
const CONFIG = {
  USAR_DATOS_REALES: true,
  SUPABASE: {
    URL: SUPABASE_URL,   // ← viene de supabase-config.js
    KEY: SUPABASE_KEY,   // ← viene de supabase-config.js
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

// Zona horaria local (Madrid)
const TZ = 'Europe/Madrid';
const fmtFecha = new Intl.DateTimeFormat('fr-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'});
const fechaMadrid = d => fmtFecha.format(d);         // "2026-10-14"
const horaMadrid  = d => parseInt(new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',hour12:false}).format(d),10);

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

/* ============================================================
   ESTADO ACTUAL
   ============================================================ */
async function leerEstadoActual(){
  const d=await supaFetch(CONFIG.SUPABASE.TABLA_ESTADO+'?id=eq.1&select=*');
  return d&&d[0]?d[0]:null;
}

function aplicarEstado(fila){
  if(!fila) return;
  const w=k=>{const v=parseFloat(fila[k]);return isNaN(v)?null:v/1000};
  const solar=w('solar_w'),casa=w('casa_w'),coche=w('coche_w'),red=w('red_w');
  if(solar!==null) E.sol=solar;
  if(casa!==null) E.casa=casa;
  if(coche!==null){
    E.coche=coche; E.cocheOn=coche>0.05;
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
   HELPERS de render
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
   RENDER · estado en vivo
   ============================================================ */
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

  const b=$('estado-red');
  if(b){
    b.className='badge';
    if(exp>.05){b.classList.add('green');b.textContent='⬆️ Exportando '+exp.toFixed(2)+' kW a la red'}
    else if(imp>.05){b.classList.add('red');b.textContent='⬇️ Importando '+imp.toFixed(2)+' kW de la red'}
    else{b.classList.add('blue');b.textContent='♻️ Autoconsumo total'}
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
}

/* ============================================================
   GRÁFICA DETALLADA
   ============================================================ */
const ChartDet={rango:'24h',crudo:[],puntos:null,escala:null};

/* --- Lectura cruda de lecturas (para 24h) --- */
async function leerLecturasHoras(horas){
  const s=CONFIG.SUPABASE;
  const desde=new Date(Date.now()-horas*3600*1000).toISOString();
  return await supaFetch(
    s.TABLA_HIST+'?ts=gte.'+desde+
    '&select=ts,solar_w,casa_w,red_w,coche_w&order=ts.asc'
  );
}

/* --- 24h: agrupar por hora (usando hora local Madrid) --- */
function agrupar24h(filas){
  const buckets=Array.from({length:24},(_,i)=>({hora:i,solar:[],casa:[],coche:[],red:[]}));
  const hoyStr = fechaMadrid(new Date());
  filas.forEach(f=>{
    const t=new Date(f.ts);
    if(fechaMadrid(t)!==hoyStr) return;
    const h=horaMadrid(t);
    buckets[h].solar.push((+f.solar_w||0)/1000);
    buckets[h].casa .push((+f.casa_w ||0)/1000);
    buckets[h].coche.push((+f.coche_w||0)/1000);
    buckets[h].red  .push((+f.red_w  ||0)/1000);
  });
  const prom=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  return buckets.map(b=>({
    x:b.hora,
    label:String(b.hora).padStart(2,'0')+':00',
    solar:prom(b.solar), casa:prom(b.casa), coche:prom(b.coche), red:prom(b.red)
  }));
}

/* --- 7d: agrupar por día (usando fecha local Madrid) --- */
function agrupar7d(filas){
  const porDia={};
  filas.forEach(f=>{
    const t=new Date(f.ts);
    const k=fechaMadrid(t);
    if(!porDia[k]) porDia[k]={solar:[],casa:[],coche:[],red:[]};
    porDia[k].solar.push((+f.solar_w||0)/1000);
    porDia[k].casa .push((+f.casa_w ||0)/1000);
    porDia[k].coche.push((+f.coche_w||0)/1000);
    porDia[k].red  .push((+f.red_w  ||0)/1000);
  });
  const prom=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  const nombres=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  // Rellenar SIEMPRE los últimos 7 días, aunque no haya datos
  const arr=[];
  for(let i=6;i>=0;i--){
    const d=new Date();
    d.setDate(d.getDate()-i);
    const key=fechaMadrid(d);
    const x=porDia[key];
    arr.push({
      x:key,
      label:nombres[d.getDay()]+' '+String(d.getDate()).padStart(2,'0'),
      solar:x?prom(x.solar):0,
      casa: x?prom(x.casa):0,
      coche:x?prom(x.coche):0,
      red:  x?prom(x.red):0
    });
  }
  return arr;
}

/* --- Curva suave --- */
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

/* --- Dibujar la gráfica detallada --- */
function dibujarChartDet(){
  const svg=$('chart-det');
  if(!svg) return;

  const puntos = ChartDet.rango==='24h'
    ? agrupar24h(ChartDet.crudo)
    : agrupar7d(ChartDet.crudo);

  const W=900,H=340,pL=50,pR=20,pT=20,pB=40;
  const innerW=W-pL-pR, innerH=H-pT-pB;
  const N=puntos.length;

  const valsFlat = puntos.flatMap(p=>[p.solar,p.casa,p.coche,p.red]).filter(v=>v!==null&&v!==undefined);
  if(valsFlat.length===0){
    $('chart-det-grid').innerHTML='<text x="'+W/2+'" y="'+(H/2)+'" text-anchor="middle" fill="#9aa0a6" font-size="14">Sin datos en este rango</text>';
    ['det-area-solar','det-line-solar','det-line-casa','det-line-coche','det-line-red-exp','det-line-red-imp']
      .forEach(id=>{const e=$(id); if(e) e.setAttribute('d','')});
    const st=$('chart-det-stats'); if(st) st.innerHTML='';
    return;
  }

  const maxV=Math.max(1,...valsFlat);
  const minV=Math.min(0,...puntos.map(p=>p.red===null||p.red===undefined?0:p.red));
  const spanV=Math.max(0.5,maxV-minV);

  const px=i=>pL+(N===1?innerW/2:innerW*i/(N-1));
  const py=v=>pT+innerH*(1-(v-minV)/spanV);

  let g='';
  const pasos=5;
  for(let i=0;i<=pasos;i++){
    const v=minV+spanV*i/pasos;
    const y=py(v);
    g+='<line class="grid-line" x1="'+pL+'" y1="'+y+'" x2="'+(W-pR)+'" y2="'+y+'"/>';
    g+='<text class="ax-lbl" x="'+(pL-8)+'" y="'+(y+4)+'" text-anchor="end">'+v.toFixed(1)+'</text>';
  }
  let marcasX;
  if(N<=12) marcasX=puntos.map((_,i)=>i);
  else marcasX=[0,Math.floor(N/4),Math.floor(N/2),Math.floor(3*N/4),N-1];
  marcasX.forEach(i=>{
    g+='<text class="ax-lbl" x="'+px(i)+'" y="'+(H-12)+'" text-anchor="middle">'+puntos[i].label+'</text>';
  });
  g+='<text class="ax-lbl" x="'+(pL-8)+'" y="'+(pT-4)+'" text-anchor="end">kW</text>';

  if(minV<0){
    g+='<line x1="'+pL+'" y1="'+py(0)+'" x2="'+(W-pR)+'" y2="'+py(0)+'" stroke="#4fc3f7" stroke-width="1" stroke-dasharray="2 4" opacity=".5"/>';
  }
  $('chart-det-grid').innerHTML=g;

  const linea=(getter,filtro)=>{
    const pts=[];
    puntos.forEach((p,i)=>{
      const v=getter(p);
      if(v===null||v===undefined) return;
      if(filtro&&!filtro(v)) return;
      pts.push([px(i),py(v)]);
    });
    return pts.length>1?curve(pts):'';
  };
  const dSolar=linea(p=>p.solar);
  const dCasa =linea(p=>p.casa);
  const dCoche=linea(p=>p.coche,v=>v>0.01);
  const dExp  =linea(p=>p.red,v=>v>0.01);
  const dImp  =linea(p=>p.red,v=>v<-0.01);

  $('det-line-solar').setAttribute('d',dSolar);
  $('det-line-casa').setAttribute('d',dCasa);
  $('det-line-coche').setAttribute('d',dCoche);
  $('det-line-red-exp').setAttribute('d',dExp);
  $('det-line-red-imp').setAttribute('d',dImp);

  if(dSolar){
    const base=' L'+px(N-1)+','+py(0)+' L'+px(0)+','+py(0)+' Z';
    $('det-area-solar').setAttribute('d',dSolar+base);
  } else $('det-area-solar').setAttribute('d','');

  ChartDet.puntos=puntos;
  ChartDet.escala={px,py,N,pL,pR,pT,pB,W,H};
  dibujarStatsDet(puntos);
}

/* --- Estadísticas debajo de la gráfica --- */
function dibujarStatsDet(puntos){
  const el=$('chart-det-stats'); if(!el) return;
  const val=k=>puntos.map(p=>p[k]).filter(v=>v!==null&&v!==undefined);
  const prom=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
  const max =a=>a.length?Math.max(...a):0;

  const sV=val('solar'),cV=val('casa'),chV=val('coche'),rV=val('red');
  const u=' kW';
  const es24h = ChartDet.rango==='24h';
  const lblMedia = es24h?'media':'media día';

  const bloque=(color,valor,texto)=>`
    <div class="stat">
      <span class="dot" style="background:${color}"></span>
      <div><b>${valor}</b><small>${texto}</small></div>
    </div>`;

  el.innerHTML =
    bloque('#ffc107', prom(sV).toFixed(2)+u, '☀️ Solar · '+lblMedia) +
    bloque('#ffc107', max(sV).toFixed(2)+u,  '☀️ Solar · pico') +
    bloque('#4fc3f7', prom(cV).toFixed(2)+u, '🏠 Casa · '+lblMedia) +
    bloque('#4fc3f7', max(cV).toFixed(2)+u,  '🏠 Casa · pico') +
    bloque('#b388ff', prom(chV).toFixed(2)+u,'🚗 Coche · '+lblMedia) +
    bloque('#4caf50', (rV.length?Math.max(0,...rV):0).toFixed(2)+u, '⬆️ Red · máx export') +
    bloque('#ef5350', (rV.length?Math.abs(Math.min(0,...rV)):0).toFixed(2)+u, '⬇️ Red · máx import');
}

/* --- Hover / tooltip --- */
function initHoverChartDet(){
  const svg=$('chart-det'); if(!svg) return;
  const tooltip=$('chart-det-tooltip');
  svg.addEventListener('mousemove',e=>{
    if(!ChartDet.puntos||!ChartDet.escala) return;
    const rect=svg.getBoundingClientRect();
    const xVB=(e.clientX-rect.left)/rect.width*900;
    const{px,N}=ChartDet.escala;
    let idx=0,dist=Infinity;
    for(let i=0;i<N;i++){
      const d=Math.abs(px(i)-xVB);
      if(d<dist){dist=d;idx=i}
    }
    mostrarHoverChartDet(idx,e,rect);
  });
  svg.addEventListener('mouseleave',()=>{
    const h=$('chart-det-hover'); if(h) h.style.display='none';
    if(tooltip) tooltip.classList.remove('show');
  });
}
function mostrarHoverChartDet(idx,evt,rect){
  const{px,py}=ChartDet.escala;
  const p=ChartDet.puntos[idx];
  if(!p) return;
  const hov=$('chart-det-hover'); hov.style.display='';
  const x=px(idx);
  const cr=$('det-cross');
  cr.setAttribute('x1',x); cr.setAttribute('x2',x);
  cr.setAttribute('y1',20); cr.setAttribute('y2',300);
  const setDot=(id,v)=>{
    const el=$(id);
    if(v===null||v===undefined){el.style.display='none';return}
    el.style.display='';
    el.setAttribute('cx',x);
    el.setAttribute('cy',py(v));
  };
  setDot('det-dot-solar',p.solar);
  setDot('det-dot-casa', p.casa);
  setDot('det-dot-coche',p.coche);
  setDot('det-dot-red',  p.red);

  const tt=$('chart-det-tooltip'); if(!tt) return;
  const redColor=(p.red||0)>=0?'#4caf50':'#ef5350';
  const fmt=v=>(v===null||v===undefined)?'—':v.toFixed(2)+' kW';
  tt.innerHTML=
    '<div style="font-weight:600;color:#4fc3f7;margin-bottom:4px">'+p.label+'</div>'+
    '<div><span class="dot" style="background:#ffc107"></span>Solar<b>'+fmt(p.solar)+'</b></div>'+
    '<div><span class="dot" style="background:#4fc3f7"></span>Casa<b>'+fmt(p.casa)+'</b></div>'+
    '<div><span class="dot" style="background:#b388ff"></span>Coche<b>'+fmt(p.coche)+'</b></div>'+
    '<div><span class="dot" style="background:'+redColor+'"></span>Red<b>'+fmt(p.red)+'</b></div>';
  tt.classList.add('show');

  const wrap=tt.parentElement.getBoundingClientRect();
  let left=(evt.clientX-wrap.left)+16;
  let top =(evt.clientY-wrap.top)-30;
  const ttW=180, ttH=110;
  if(left+ttW>wrap.width) left=left-ttW-30;
  if(left<0) left=10;
  if(top<0) top=10;
  if(top+ttH>wrap.height) top=wrap.height-ttH-10;
  tt.style.left=left+'px';
  tt.style.top =top+'px';
}

/* --- Cargar la gráfica detallada --- */
async function cargarChartDet(){
  try{
    // 24h → últimas 26 horas de lecturas crudas
    // 7d  → 8 días (por si hoy está a medias) de lecturas crudas
    const horas = ChartDet.rango==='24h' ? 26 : 8*24;
    const filas = await leerLecturasHoras(horas);
    ChartDet.crudo=filas;
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
   BARRAS SEMANALES · con datos reales de curva_horaria
   ============================================================ */
async function cargarSemana(){
  const s=CONFIG.SUPABASE;
  if(!$('bars-semana')) return;

  try{
    // Pedir los últimos 7 días de la vista curva_horaria
    const hoy=new Date();
    const desde=new Date(); desde.setDate(desde.getDate()-6);
    const desdeStr=fechaMadrid(desde);

    const filas=await supaFetch(
      s.VISTA_CURVA+'?dia=gte.'+desdeStr+'&order=dia.asc,hora.asc'
    );

    // Agrupar kWh por día (suma de kW/hora = kWh del día)
    const porDia={};
    filas.forEach(f=>{
      const k=f.dia;
      if(!porDia[k]) porDia[k]={solar:0,casa:0};
      porDia[k].solar += (+f.solar_kw||0);
      porDia[k].casa  += (+f.casa_kw ||0);
    });

    // Generar SIEMPRE los últimos 7 días, aunque no haya datos
    const arr=[];
    const nombres=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    for(let i=6;i>=0;i--){
      const d=new Date();
      d.setDate(d.getDate()-i);
      const key=fechaMadrid(d);
      const datos=porDia[key]||{solar:0,casa:0};
      arr.push({
        fecha:key,
        dia:d,
        solar:datos.solar,
        casa:datos.casa
      });
    }
    dibujarSemana(arr);
  }catch(e){
    console.warn('Error semana:',e.message);
  }
}

function dibujarSemana(arr){
  const el=$('bars-semana'); if(!el) return;
  const nombres=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  // Escala común
  const maxV=Math.max(1,...arr.map(d=>Math.max(d.solar,d.casa)));

  let totalProd=0,totalCons=0;
  el.innerHTML=arr.map(d=>{
    totalProd+=d.solar;
    totalCons+=d.casa;
    const hS=maxV>0?(d.solar/maxV*100):0;
    const hC=maxV>0?(d.casa /maxV*100):0;
    const esHoy=fechaMadrid(d.dia)===fechaMadrid(new Date());
    return `<div class="bar-group" title="${d.fecha}">
      <div class="bar-pair">
        <div class="bar solar" style="height:${hS.toFixed(1)}%"></div>
        <div class="bar cons"  style="height:${hC.toFixed(1)}%"></div>
      </div>
      <div class="bar-day" ${esHoy?'style="color:var(--a);font-weight:700"':''}>${nombres[d.dia.getDay()]}</div>
    </div>`;
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

  // Estado en vivo cada 5 s
  pollEstado();
  setInterval(pollEstado, CONFIG.SUPABASE.INTERVALO);

  // Gráfica detallada cada 60 s
  cargarChartDet();
  setInterval(cargarChartDet, 60000);

  // Barras semanales cada 5 min (los datos del día apenas cambian)
  cargarSemana();
  setInterval(cargarSemana, 300000);

  // Inicializar hover
  initHoverChartDet();
}

// Init
pintaS($('in-solar'));
pintaS($('in-casa'));
pintaS($('in-coche'));
renderE();

if(CONFIG.USAR_DATOS_REALES) iniciarSupabase();