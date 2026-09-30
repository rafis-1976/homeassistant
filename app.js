/* ============ CONFIG ============ */
const CFG = window.MIGARAJE_CONFIG || {};
if(!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY || CFG.SUPABASE_URL.includes('TU-PROYECTO') || CFG.SUPABASE_ANON_KEY.includes('TU-ANON')){
  document.body.innerHTML='<div style="max-width:640px;margin:60px auto;padding:24px;font-family:system-ui"><h1>⚠️ Falta configurar Supabase</h1><p>Rellena <code>config.js</code>.</p></div>';
  throw new Error('Falta config.js');
}
const { createClient } = window.supabase;
const sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth:{ persistSession:true, autoRefreshToken:true } });
const BUCKET = 'documentos';

/* ============ HELPERS ============ */
const eur = new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:2});
const num = new Intl.NumberFormat('es-ES');
const money = n => eur.format(Number(n)||0);
const kmFmt = n => num.format(Number(n)||0) + ' km';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = iso => { if(!iso) return '—'; const [y,m,d] = iso.split('-'); if(!y||!m||!d) return '—'; return `${d}/${m}/${y}`; };
const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
const daysUntil = iso => { if(!iso) return null; const t = new Date(); t.setHours(0,0,0,0); const f = new Date(iso+'T00:00:00'); if(isNaN(f)) return null; return Math.round((f-t)/86400000); };
const pluralDias = n => n === 1 ? '1 día' : n + ' días';
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const normTipo = t => String(t||'').toLowerCase().trim();
function toast(m,t='info'){ const e=document.createElement('div'); e.className='toast '+t; e.textContent=m; document.body.appendChild(e); setTimeout(()=>e.remove(),3600); }

function tipoRepostajePorDefecto(combustible){
  const c = normTipo(combustible);
  if(!c) return 'Otro';
  if(c.includes('eléctric') || c.includes('electric')) return 'Recarga eléctrica';
  if(c.includes('diésel') || c.includes('diesel')) return 'Diésel';
  if(c.includes('gasolina')) return 'Gasolina 95';
  if(c.includes('híbrido') || c.includes('hibrido')) return 'Gasolina 95';
  if(c === 'glp') return 'GLP';
  if(c === 'gnc') return 'GNC';
  return 'Otro';
}
function esTipoElectrico(t){
  const n = normTipo(t);
  return n.includes('eléctric') || n.includes('electric') || n.includes('recarga');
}

function parseIntervaloKm(intervalo){
  if(!intervalo) return {kmMin:null,kmMax:null};
  const soloKm = String(intervalo).split('/')[0];
  const matches = soloKm.match(/\d[\d.,\s]*/g);
  if(!matches) return {kmMin:null,kmMax:null};
  const nums = matches.map(s => Number(String(s).replace(/[.,\s]/g,''))).filter(n => isFinite(n) && n > 0);
  if(!nums.length) return {kmMin:null,kmMax:null};
  if(nums.length === 1) return {kmMin:nums[0],kmMax:null};
  return {kmMin:Math.min(nums[0],nums[1]),kmMax:Math.max(nums[0],nums[1])};
}

function estadoMantProg(intervalo,kmActual){
  const {kmMin,kmMax} = parseIntervaloKm(intervalo);
  if(kmMin == null) return {nivel:'muted',orden:5,detalle:''};
  const kMax = kmMax != null ? kmMax : kmMin + 10000;
  if(kmActual > kMax) return {nivel:'danger',orden:0,detalle:`Superado por ${num.format(kmActual-kMax)} km`};
  if(kmActual >= kmMin) return {nivel:'warn',orden:1,detalle:`En rango (${num.format(kmMin)}${kmMax?' - '+num.format(kmMax):''} km)`};
  if(kmMin - kmActual <= 3000) return {nivel:'accent',orden:2,detalle:`Faltan ${num.format(kmMin-kmActual)} km`};
  return {nivel:'ok',orden:3,detalle:`Faltan ${num.format(kmMin-kmActual)} km`};
}

function parseMantProgXML(xmlText){
  const NS='urn:schemas-microsoft-com:office:spreadsheet';
  if(xmlText.charCodeAt(0) === 0xFEFF) xmlText = xmlText.slice(1);
  const doc = new DOMParser().parseFromString(xmlText,'application/xml');
  if(doc.querySelector('parsererror')) throw new Error('XML no válido.');
  const find=(p,t)=>{let e=p.getElementsByTagNameNS(NS,t); if(!e.length) e=p.getElementsByTagName(t); return e;};
  const getA=(e,n)=>{let v=e.getAttributeNS(NS,n); if(v==null) v=e.getAttribute('ss:'+n)||e.getAttribute(n); return v;};
  const sh = find(doc,'Worksheet'); if(!sh.length) throw new Error('XML sin hoja.');
  const rows = find(sh[0],'Row'); if(!rows.length) return [];
  const getV=rowEl=>{const out=[];const cells=find(rowEl,'Cell');let col=0;for(const c of cells){const i=getA(c,'Index');if(i)col=Number(i)-1;const d=find(c,'Data');out[col]=d.length?String(d[0].textContent||'').trim():'';col++;}return out;};
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const headers = getV(rows[0]).map(norm);
  const idx = {
    operacion: headers.findIndex(h=>['revision','operacion','tarea','mantenimiento','nombre','descripcion'].includes(h)),
    intervalo: headers.findIndex(h=>['intervalo','periodicidad','cada','frecuencia'].includes(h)),
    notas: headers.findIndex(h=>['notas','nota','observaciones','comentarios'].includes(h)),
    kilometros: headers.findIndex(h=>['kilometros','kilometraje','km'].includes(h)),
    meses: headers.findIndex(h=>['meses','mes','periodo'].includes(h))
  };
  const out = [];
  for(let r=1;r<rows.length;r++){
    const row = getV(rows[r]);
    const operacion = idx.operacion>=0 ? String(row[idx.operacion]||'').trim() : '';
    if(!operacion) continue;
    let intervalo = idx.intervalo>=0 ? String(row[idx.intervalo]||'').trim() : '';
    if(!intervalo && (idx.kilometros>=0||idx.meses>=0)){
      const km = idx.kilometros>=0 ? String(row[idx.kilometros]||'').trim() : '';
      const me = idx.meses>=0 ? String(row[idx.meses]||'').trim() : '';
      const partes=[]; if(km)partes.push(km+' km'); if(me)partes.push(me+(me==='1'?' mes':' meses'));
      intervalo = partes.join(' / ');
    }
    out.push({operacion,intervalo,notas: idx.notas>=0 ? String(row[idx.notas]||'').trim() : ''});
  }
  return out;
}

/* ============ CATÁLOGOS ============ */
const COMBUSTIBLES = ['Gasolina','Diésel','Híbrido','Híbrido enchufable','Eléctrico','GLP','GNC','Otro'];
const TIPOS_MANT = ['Cambio de aceite y filtros','Filtro de aire','Filtro de combustible','Filtro de habitáculo','Frenos (pastillas/discos)','Neumáticos','Batería','Correa de distribución','Bujías','Líquido de frenos','Refrigerante','Aire acondicionado','Revisión oficial','ITV','Escobillas limpiaparabrisas','Suspensión','Embrague','Diagnosis / electrónica','Otros'];
const TIPOS_SEGURO = ['Terceros','Terceros ampliado','Terceros con lunas','Todo riesgo con franquicia','Todo riesgo sin franquicia','Otro'];
const PLAZOS_SEGURO = ['Anual','Semestral','Cuatrimestral','Trimestral','Mensual','Otro'];
const TIPOS_HIST_LABEL = {itv:'ITV',seguro:'Seguro',ivtm:'Impuesto (IVTM)'};
const TIPOS_REPOSTAJE = ['Gasolina 95','Gasolina 98','Diésel','Diésel+','GLP','GNC','Recarga eléctrica','Otro'];

/* ============ MAPEO ============ */
function mantFromDB(row){
  return {id:row.id,tipo:row.tipo||'',fecha:row.fecha||'',km:row.km??'',coste:row.coste??0,taller:row.taller||'',proximaFecha:row.proxima_fecha||'',proximoKm:row.proximo_km??'',notas:row.notas||'',materiales:Array.isArray(row.materiales)?row.materiales:[]};
}
function mantToDB(m,vehicleId){
  return {
    vehicle_id: vehicleId, tipo: m.tipo||null, fecha: m.fecha||null,
    km: m.km===''||m.km==null?null:Number(m.km),
    coste: Number(m.coste)||0, taller: m.taller||null,
    proxima_fecha: m.proximaFecha||null,
    proximo_km: m.proximoKm===''||m.proximoKm==null?null:Number(m.proximoKm),
    notas: m.notas||null,
    materiales: Array.isArray(m.materiales) ? m.materiales.map(x=>({
      nombre:String(x.nombre||'').trim(),
      cantidad:x.cantidad===''||x.cantidad==null?null:Number(x.cantidad),
      precio:x.precio===''||x.precio==null?null:Number(x.precio),
      tienda:String(x.tienda||'').trim(),
      imagen:String(x.imagen||'')
    })) : []
  };
}

/* ============ ESTADO ============ */
let currentUser=null, vehicles=[], selected=null;
let allHistorialRaw=[], allMantProg=[], allRecambios=[], allRepostajes=[];
let mostrarMantProg=false;
let mostrarDocs=true;
let mostrarDocOficial=true;
let mostrarRepostajes=true;
let mostrarRecambios=true;
let mostrarHistorial=true;
let repVista='mensual';
let repPagina=1;
const appView=document.getElementById('app-view');
const modalRoot=document.getElementById('modal');

/* Cache de signed URLs para imágenes del bucket */
const signedUrlCache = new Map();
const SIGNED_TTL = 3600;

function getCachedUrl(path){
  if(!path) return null;
  const e = signedUrlCache.get(path);
  if(!e) return null;
  if(e.expiresAt < Date.now()){ signedUrlCache.delete(path); return null; }
  return e.url;
}

async function precargarImagenesRecambios(items){
  const pendientes = [...new Set(
    items.map(x => typeof x === 'string' ? x : x?.imagen).filter(p => p && !getCachedUrl(p))
  )];
  if(!pendientes.length){ pintarMiniaturas(); return; }
  try {
    const {data,error} = await sb.storage.from(BUCKET).createSignedUrls(pendientes, SIGNED_TTL);
    if(error || !data) return;
    data.forEach(item=>{
      if(!item.error && item.signedUrl){
        signedUrlCache.set(item.path, {url:item.signedUrl, expiresAt:Date.now() + (SIGNED_TTL-60)*1000});
      }
    });
  } catch(e){
    console.warn('No se pudieron firmar las imágenes:', e);
  }
  pintarMiniaturas();
}

function pintarMiniaturas(){
  document.querySelectorAll('[data-img-path]').forEach(el=>{
    const url = getCachedUrl(el.dataset.imgPath);
    if(!url) return;
    el.classList.remove('rec-thumb-loading');
    el.style.backgroundImage = `url("${url}")`;
  });
}

document.getElementById('btn-logout').addEventListener('click', async ()=>{
  if(!confirm('¿Cerrar sesión?')) return;
  await sb.auth.signOut();
  window.location.replace('login.html');
});

(async ()=>{
  const {data:{session}} = await sb.auth.getSession();
  if(!session){ window.location.replace('login.html'); return; }
  currentUser = session.user;
  await entrar();
})();
sb.auth.onAuthStateChange(e => { if(e === 'SIGNED_OUT') window.location.replace('login.html'); });

async function entrar(){
  appView.hidden = false;
  document.getElementById('user-email').textContent = currentUser?.email || '';
  try { await loadData(); }
  catch(err){ console.error(err); vehicles=[]; selected=null; setTimeout(()=>toast('Error: '+(err?.message||'Error'),'error'),200); }
  render();
}

async function loadData(){
  const [vRes,mRes,hRes,pRes,rRes,fRes] = await Promise.all([
    sb.from('vehicles').select('*').order('created_at',{ascending:true}),
    sb.from('mantenimientos').select('*').order('created_at',{ascending:true}),
    sb.from('historial_obligaciones').select('*').order('fecha',{ascending:false}),
    sb.from('mantenimiento_programado').select('*').order('orden',{ascending:true}),
    sb.from('recambios').select('*').order('orden',{ascending:true}),
    sb.from('repostajes').select('*').order('fecha',{ascending:false})
  ]);
  if(vRes.error) throw vRes.error;
  if(mRes.error) throw mRes.error;
  allHistorialRaw = hRes.error ? [] : (hRes.data||[]);
  allMantProg = pRes.error ? [] : (pRes.data||[]);
  allRecambios = rRes.error ? [] : (rRes.data||[]);
  allRepostajes = fRes.error ? [] : (fRes.data||[]);
  if(fRes.error) console.error('Error repostajes:',fRes.error);
  const mByV = new Map();
  mRes.data.forEach(m=>{ if(!mByV.has(m.vehicle_id)) mByV.set(m.vehicle_id,[]); mByV.get(m.vehicle_id).push(mantFromDB(m)); });
  vehicles = vRes.data.map(v=>({...v,km:Number(v.km)||0,mantenimientos:mByV.get(v.id)||[]}));
  if(!selected||!vehicles.find(v=>v.id===selected)) selected = vehicles[0]?.id||null;
}

const registrosHist = (vid,t)=>{ const tt=normTipo(t); return allHistorialRaw.filter(h=>String(h.vehicle_id)===String(vid)&&normTipo(h.tipo)===tt); };
const registrosMantProg = vid => allMantProg.filter(p=>String(p.vehicle_id)===String(vid));
const registrosRecambios = vid => allRecambios.filter(r=>String(r.vehicle_id)===String(vid));
const registrosRepostajes = vid => allRepostajes.filter(r=>String(r.vehicle_id)===String(vid));

const getCurrentObl = (vid,tipo) => {
  const regs = registrosHist(vid,tipo);
  if(!regs.length) return null;
  return regs.slice().sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''))[0];
};

/* ============ STORAGE ============ */
async function subirDocumento(file,vid,tipo){
  if(!file||file.size===0) return null;
  const ext=(file.name.split('.').pop()||'bin').toLowerCase();
  const path=`${currentUser.id}/${vid}/${tipo}.${ext}`;
  const {error}=await sb.storage.from(BUCKET).upload(path,file,{upsert:true,cacheControl:'3600',contentType:file.type||'application/octet-stream'});
  if(error) throw error; return path;
}
async function subirMaterialImagen(file,vid,mid){
  if(!file||file.size===0) return null;
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
  const path=`${currentUser.id}/${vid}/material_${mid}.${ext}`;
  const {error}=await sb.storage.from(BUCKET).upload(path,file,{upsert:true,cacheControl:'3600',contentType:file.type||'image/jpeg'});
  if(error) throw error; return path;
}
async function subirRecambioImagen(file,vid,rid){
  if(!file||file.size===0) return null;
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
  const path=`${currentUser.id}/${vid}/recambio_${rid}.${ext}`;
  const {error}=await sb.storage.from(BUCKET).upload(path,file,{upsert:true,cacheControl:'3600',contentType:file.type||'image/jpeg'});
  if(error) throw error; return path;
}
async function verDocumento(path){
  if(!path) return;
  const cached = getCachedUrl(path);
  if(cached){ window.open(cached,'_blank','noopener'); return; }
  const {data,error}=await sb.storage.from(BUCKET).createSignedUrl(path,3600);
  if(error) return toast('No se pudo abrir: '+error.message,'error');
  signedUrlCache.set(path, {url:data.signedUrl, expiresAt:Date.now()+(3600-60)*1000});
  window.open(data.signedUrl,'_blank','noopener');
}
async function borrarDocumento(path){
  if(!path) return;
  signedUrlCache.delete(path);
  const {error}=await sb.storage.from(BUCKET).remove([path]);
  if(error) console.warn('No se pudo borrar:',error.message);
}
async function borrarCarpetaVehiculo(vid){
  const prefix=`${currentUser.id}/${vid}`;
  const {data:files,error}=await sb.storage.from(BUCKET).list(prefix);
  if(error||!files?.length) return;
  await sb.storage.from(BUCKET).remove(files.map(f=>`${prefix}/${f.name}`));
}

/* ============ RENDER ============ */
function render(){ renderTabs(); renderContent(); }

function renderTabs(){
  const el = document.getElementById('tabs');
  if(!vehicles.length){ el.innerHTML=''; return; }
  el.innerHTML = vehicles.map(v=>`
    <button class="tab ${v.id===selected?'active':''}" data-id="${v.id}">
      <span class="tab-name">${esc(v.nombre||(v.marca+' '+v.modelo))}</span>
      <span class="tab-sub">${esc(v.matricula||'—')}</span>
    </button>`).join('');
  el.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{ selected=b.dataset.id; repPagina=1; render(); }));
}

/* Enlaza un botón de plegar/desplegar SIN re-render */
function bindToggle(btnId, panelId, getOpen, setOpen, textOn, textOff){
  const btn = document.getElementById(btnId);
  const panel = document.getElementById(panelId);
  if(!btn || !panel) return;
  const aplicar = () => {
    const abierto = getOpen();
    panel.hidden = !abierto;
    const spans = btn.querySelectorAll('span');
    if(spans[0]) spans[0].textContent = abierto ? '▼' : '▶';
    if(spans[1]) spans[1].textContent = abierto ? textOn : textOff;
  };
  btn.addEventListener('click', ()=>{ setOpen(!getOpen()); aplicar(); });
  aplicar();
}

function renderContent(){
  const el = document.getElementById('content');
  if(!vehicles.length){
    el.innerHTML = `<div class="card empty"><div class="emoji">🚙</div><h2>Aún no tienes ningún vehículo</h2><p>Añade tu primer coche para empezar.</p><button class="btn primary" id="empty-add">＋ Añadir mi primer vehículo</button></div>`;
    document.getElementById('empty-add').addEventListener('click',()=>openVehicleForm());
    return;
  }
  let v = vehicles.find(x=>x.id===selected)||vehicles[0];
  selected = v.id;
  const alerts = getAlerts(v);
  const mants = [...v.mantenimientos].sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  const year = new Date().getFullYear();
  const totalDeInt = m => (Number(m.coste)||0)+(Array.isArray(m.materiales)?m.materiales.reduce((s,x)=>s+(Number(x.cantidad)||0)*(Number(x.precio)||0),0):0);
  const mantTotal = v.mantenimientos.reduce((s,m)=>s+totalDeInt(m),0);
  const mantAnio = v.mantenimientos.filter(m=>(m.fecha||'').startsWith(String(year))).reduce((s,m)=>s+totalDeInt(m),0);
  const mantUlt = v.mantenimientos.filter(m=>{const d=daysUntil(m.fecha);return d!==null&&d>-365&&d<=0;}).reduce((s,m)=>s+totalDeInt(m),0);

  const enAnio = h => (h.fecha||'').startsWith(String(year));
  const enUlt = h => {const d=daysUntil(h.fecha);return d!==null&&d>-365&&d<=0;};
  const itvRegs=registrosHist(v.id,'itv'),segRegs=registrosHist(v.id,'seguro'),ivtmRegs=registrosHist(v.id,'ivtm');
  const sumRegs=(regs,filtro)=>regs.filter(filtro||(()=>true)).reduce((s,h)=>s+(Number(h.precio)||0),0);
  const itvTotal=sumRegs(itvRegs);
  const itvAnio=sumRegs(itvRegs,enAnio);
  const itvUlt=sumRegs(itvRegs,enUlt);
  const segTotal=sumRegs(segRegs);
  const segAnio=sumRegs(segRegs,enAnio);
  const segUlt=sumRegs(segRegs,enUlt);
  const ivtmTotal=sumRegs(ivtmRegs);
  const ivtmAnio=sumRegs(ivtmRegs,enAnio);
  const ivtmUlt=sumRegs(ivtmRegs,enUlt);

  const curItv  = getCurrentObl(v.id,'itv');
  const curSeg  = getCurrentObl(v.id,'seguro');
  const curIvtm = getCurrentObl(v.id,'ivtm');
  const fechaItv  = curItv  ? (curItv.proxima_fecha  || curItv.fecha  || null) : null;
  const fechaSeg  = curSeg  ? (curSeg.proxima_fecha  || curSeg.fecha  || null) : null;
  const fechaIvtm = curIvtm ? (curIvtm.proxima_fecha || curIvtm.fecha || null) : null;

  const reps = registrosRepostajes(v.id);
  const repTotal = reps.reduce((s,r)=>s+(Number(r.coste_total)||0),0);
  const repAnio = reps.filter(enAnio).reduce((s,r)=>s+(Number(r.coste_total)||0),0);
  const repUlt = reps.filter(enUlt).reduce((s,r)=>s+(Number(r.coste_total)||0),0);

  const totalGasto = mantTotal+itvTotal+segTotal+ivtmTotal+repTotal;
  const gastoAnio = mantAnio+itvAnio+segAnio+ivtmAnio+repAnio;
  const gastoUlt = mantUlt+itvUlt+segUlt+ivtmUlt+repUlt;

  const partes = [v.marca,v.modelo].filter(Boolean).join(' ');
  const edad = v.anio ? (year-Number(v.anio)) : null;

  let revHtml = '';
  if(v.intervalo_revision_km && v.ultima_revision_km){
    const prox = Number(v.ultima_revision_km)+Number(v.intervalo_revision_km);
    const rest = prox-(Number(v.km)||0);
    let cls='ok',txt=`Faltan ${kmFmt(rest)} para la próxima revisión (a los ${kmFmt(prox)})`;
    if(rest<=0){cls='danger';txt=`Revisión superada por ${kmFmt(Math.abs(rest))} (tocaba a los ${kmFmt(prox)})`;}
    else if(rest<=1000){cls='warn';txt=`Revisión próxima: faltan ${kmFmt(rest)} (a los ${kmFmt(prox)})`;}
    revHtml = `<div class="vehicle-meta" style="margin-top:6px"><span class="badge ${cls}">🔧 ${esc(txt)}</span></div>`;
  }

  const mantProg = registrosMantProg(v.id).map(p=>({...p,_est:estadoMantProg(p.intervalo,v.km)})).sort((a,b)=>a._est.orden!==b._est.orden?a._est.orden-b._est.orden:(a.orden||0)-(b.orden||0));
  const nVenc=mantProg.filter(p=>p._est.nivel==='danger').length;
  const nToca=mantProg.filter(p=>p._est.nivel==='warn').length;
  const nProx=mantProg.filter(p=>p._est.nivel==='accent').length;
  const mpCls = p => p._est.nivel==='danger'?'row-mp-overdue':p._est.nivel==='warn'?'row-mp-due':p._est.nivel==='accent'?'row-mp-soon':'';
  const mpBdg = p => {
    const n = p._est.nivel;
    if(n==='danger') return '<span class="badge danger">⛔ Vencido</span>';
    if(n==='warn') return '<span class="badge warn">⚠️ Toca</span>';
    if(n==='accent') return '<span class="badge" style="background:var(--bg);color:var(--accent);border:1px solid var(--accent)">🔔 Próximo</span>';
    if(n==='ok') return '<span class="badge ok">✓ Programado</span>';
    return '<span class="badge muted">— Sin datos</span>';
  };

  const recambios = registrosRecambios(v.id);
  const repostajes = [...reps].sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  const REP_POR_PAGINA = 10;
  const totalRepPaginas = Math.max(1, Math.ceil(repostajes.length / REP_POR_PAGINA));
  if(repPagina > totalRepPaginas) repPagina = totalRepPaginas;
  if(repPagina < 1) repPagina = 1;
  const repIni = (repPagina - 1) * REP_POR_PAGINA;
  const repostajesPag = repostajes.slice(repIni, repIni + REP_POR_PAGINA);

  el.innerHTML = `
    <div class="card section">
      <div class="vehicle-head">
        <div class="vehicle-title">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <h2>${esc(v.nombre||partes||'Vehículo')}</h2>
            ${v.matricula?`<span class="plate">${esc(v.matricula.toUpperCase())}</span>`:''}
          </div>
          <div class="vehicle-meta">
            ${partes?`<span>${esc(partes)}</span>`:''}
            ${v.anio?`<span class="dot"></span><span>${esc(v.anio)}${edad!==null?` (${edad} año${edad===1?'':'s'})`:''}</span>`:''}
            ${v.combustible?`<span class="dot"></span><span>${esc(v.combustible)}</span>`:''}
          </div>
          ${v.bastidor?`<div class="vehicle-meta" style="margin-top:6px"><span>🔩 Bastidor: <code style="font-family:ui-monospace,monospace;background:var(--bg);padding:1px 6px;border-radius:5px;border:1px solid var(--border)">${esc(v.bastidor)}</code></span></div>`:''}
          ${revHtml}
          ${v.notas?`<div class="vehicle-meta" style="margin-top:6px"><span>📝 ${esc(v.notas)}</span></div>`:''}
        </div>
        <div class="km-box">
          <div class="lbl">Kilómetros</div>
          <div class="big">${num.format(Number(v.km)||0)}</div>
          <button class="btn ghost sm" id="btn-km" style="margin-top:6px">Actualizar</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn ghost sm" id="btn-edit-vehicle">✎ Editar</button>
          <button class="btn danger sm" id="btn-del-vehicle">🗑 Eliminar</button>
        </div>
      </div>
    </div>

    ${alerts.length?`<div class="section">${alerts.map(a=>`<div class="alert ${a.level}">${a.level==='danger'?'⛔':a.level==='warn'?'⚠️':'✅'} <span>${esc(a.text)}</span></div>`).join('')}</div>`:''}

    <div class="section">
      <div class="section-head">
        <button type="button" class="mp-toggle" id="btn-toggle-docs">
          <span>${mostrarDocs?'▼':'▶'}</span>
          <span>${mostrarDocs?'Ocultar documentos y obligaciones':'Ver documentos y obligaciones'}</span>
        </button>
      </div>
      <div class="mp-panel" id="docs-panel" ${mostrarDocs?'':'hidden'}>
        <div class="docs">
          ${docCard('ITV',fechaItv,30,[
            curItv?.fecha?`<div><span class="lbl">Última ITV</span> ${fmtDate(curItv.fecha)}</div>`:'',
            curItv?.precio!=null?`<div><span class="lbl">Precio</span> ${money(curItv.precio)}</div>`:'',
            curItv?.lugar?`<div><span class="lbl">Lugar</span> ${esc(curItv.lugar)}</div>`:''
          ].filter(Boolean).join(''),`<button type="button" class="btn ghost tiny" data-add-hist="itv">＋ Registrar</button><button type="button" class="btn ghost tiny" data-ver-hist="itv">📋 Historial (${itvRegs.length})</button>`)}
          ${docCard('Seguro',fechaSeg,21,[
            curSeg?.fecha?`<div><span class="lbl">Fecha</span> ${fmtDate(curSeg.fecha)}</div>`:'',
            curSeg?.tipo_seguro?`<div><span class="lbl">Tipo</span> ${esc(curSeg.tipo_seguro)}</div>`:'',
            curSeg?.plazos?`<div><span class="lbl">Plazos</span> ${esc(curSeg.plazos)}</div>`:'',
            curSeg?.compania?`<div><span class="lbl">Compañía</span> ${esc(curSeg.compania)}</div>`:'',
            curSeg?.precio!=null?`<div><span class="lbl">Precio</span> ${money(curSeg.precio)}</div>`:''
          ].filter(Boolean).join(''),`<button type="button" class="btn ghost tiny" data-add-hist="seguro">＋ Registrar</button><button type="button" class="btn ghost tiny" data-ver-hist="seguro">📋 Historial (${segRegs.length})</button>`)}
          ${docCard('Impuesto (IVTM)',fechaIvtm,30,[
            curIvtm?.fecha?`<div><span class="lbl">Fecha pago</span> ${fmtDate(curIvtm.fecha)}</div>`:'',
            curIvtm?.lugar?`<div><span class="lbl">Dónde</span> ${esc(curIvtm.lugar)}</div>`:'',
            curIvtm?.precio!=null?`<div><span class="lbl">Cantidad</span> ${money(curIvtm.precio)}</div>`:''
          ].filter(Boolean).join(''),`<button type="button" class="btn ghost tiny" data-add-hist="ivtm">＋ Registrar</button><button type="button" class="btn ghost tiny" data-ver-hist="ivtm">📋 Historial (${ivtmRegs.length})</button>`)}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <button type="button" class="mp-toggle" id="btn-toggle-mp">
          <span>${mostrarMantProg?'▼':'▶'}</span>
          <span>${mostrarMantProg?'Ocultar mantenimiento programado':'Ver mantenimiento programado'}</span>
          ${mantProg.length?`<span class="badge muted">${mantProg.length}</span>`:''}
        </button>
        ${(mantProg.length&&mostrarMantProg)?`<div class="spacer"></div><button class="btn ghost sm" id="btn-import-xml">📥 Importar XML</button><button class="btn primary sm" id="btn-add-mp">＋ Añadir registro</button>`:''}
      </div>
      <div class="mp-panel" id="mp-panel" ${mostrarMantProg?'':'hidden'}>
        ${mantProg.length?`
          <div class="hint" style="margin-bottom:8px">
            Estado según los <b>${num.format(Number(v.km)||0)} km</b> actuales.
            ${nVenc?`<span style="color:var(--danger);font-weight:700">⛔ ${nVenc} vencido${nVenc===1?'':'s'}</span>`:''}
            ${nToca?`· <span style="color:var(--warn);font-weight:700">⚠️ ${nToca} para hacer</span>`:''}
            ${nProx?`· <span style="color:var(--accent);font-weight:700">🔔 ${nProx} próximo${nProx===1?'':'s'}</span>`:''}
          </div>
          <div class="card table-wrap">
            <table>
              <thead><tr><th>Estado</th><th>Operación</th><th>Intervalo</th><th>Detalle</th><th>Notas</th><th></th></tr></thead>
              <tbody>${mantProg.map(p=>`
                <tr class="${mpCls(p)}">
                  <td>${mpBdg(p)}</td>
                  <td><strong>${esc(p.operacion)}</strong></td>
                  <td>${esc(p.intervalo||'—')}</td>
                  <td class="muted" style="font-size:.8rem">${esc(p._est.detalle||'—')}</td>
                  <td class="muted" style="font-size:.8rem">${esc(p.notas||'—')}</td>
                  <td><div class="row-actions"><button class="icon-btn" data-edit-mp="${p.id}">✎</button><button class="icon-btn" data-del-mp="${p.id}">🗑</button></div></td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        `:`
          <div class="card empty" style="padding:36px 20px">
            <div class="emoji">📋</div>
            <p style="margin:10px 0 16px">Aún no has cargado el plan de mantenimiento.</p>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
              <button class="btn ghost" id="btn-import-xml-empty">📥 Importar XML</button>
              <button class="btn primary" id="btn-add-mp-empty">＋ Añadir registro</button>
            </div>
          </div>
        `}
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <button type="button" class="mp-toggle" id="btn-toggle-docoficial">
          <span>${mostrarDocOficial?'▼':'▶'}</span>
          <span>${mostrarDocOficial?'Ocultar documentación oficial del vehículo':'Ver documentación oficial del vehículo'}</span>
        </button>
      </div>
      <div class="mp-panel" id="docoficial-panel" ${mostrarDocOficial?'':'hidden'}>
        <div class="docs">
          ${docFileCard('Permiso de circulación',v.permiso_circulacion_path)}
          ${docFileCard('Ficha técnica',v.ficha_tecnica_path)}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><h2>Resumen de gastos</h2></div>
      <div class="stats">
        <div class="stat"><div class="k">Gasto total</div><div class="v">${money(totalGasto)}</div></div>
        <div class="stat"><div class="k">Últimos 12 meses</div><div class="v">${money(gastoUlt)}</div></div>
        <div class="stat"><div class="k">Año ${year}</div><div class="v">${money(gastoAnio)}</div></div>
        <div class="stat"><div class="k">Intervenciones</div><div class="v">${v.mantenimientos.length}</div></div>
      </div>
      <div class="expense-breakdown">
        <span class="exp-item"><span class="exp-lbl">🔧 Mantenimiento</span><strong>${money(mantTotal)}</strong></span>
        <span class="exp-item"><span class="exp-lbl">⛽ Repostajes</span><strong>${money(repTotal)}</strong></span>
        <span class="exp-item"><span class="exp-lbl">📋 ITV</span><strong>${money(itvTotal)}</strong></span>
        <span class="exp-item"><span class="exp-lbl">🛡 Seguro</span><strong>${money(segTotal)}</strong></span>
        <span class="exp-item"><span class="exp-lbl">💰 IVTM</span><strong>${money(ivtmTotal)}</strong></span>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <button type="button" class="mp-toggle" id="btn-toggle-rep">
          <span>${mostrarRepostajes?'▼':'▶'}</span>
          <span>${mostrarRepostajes?'Ocultar repostajes / recargas':'Ver repostajes / recargas'}</span>
          ${repostajes.length?`<span class="badge muted">${repostajes.length}</span>`:''}
        </button>
        ${mostrarRepostajes?`<div class="spacer"></div><button class="btn primary sm" id="btn-add-rep">＋ Añadir repostaje</button>`:''}
      </div>
      <div class="mp-panel" id="rep-panel" ${mostrarRepostajes?'':'hidden'}>
        ${repostajes.length?`
          <div class="card" style="padding:16px;margin-bottom:12px">
            <div class="section-head" style="margin-bottom:6px">
              <h3 style="font-size:.92rem">Gasto de combustible / recarga</h3>
              <div class="spacer"></div>
              <div class="rep-chart-tabs">
                <button type="button" class="rep-chart-tab ${repVista==='semanal'?'active':''}" data-rep-vista="semanal">Semanal</button>
                <button type="button" class="rep-chart-tab ${repVista==='mensual'?'active':''}" data-rep-vista="mensual">Mensual</button>
                <button type="button" class="rep-chart-tab ${repVista==='anual'?'active':''}" data-rep-vista="anual">Anual</button>
              </div>
            </div>
            <div class="rep-chart-wrap"><div id="rep-chart"></div></div>
            <div class="rep-stats">
              <div class="stat"><div class="k">Total gastado</div><div class="v">${money(repTotal)}</div></div>
              <div class="stat"><div class="k">Este año</div><div class="v">${money(repAnio)}</div></div>
              <div class="stat"><div class="k">Últimos 12 meses</div><div class="v">${money(repUlt)}</div></div>
              <div class="stat"><div class="k">Media / repostaje</div><div class="v">${money(repostajes.length?repTotal/repostajes.length:0)}</div></div>
            </div>
          </div>
        `:''}
        <div class="card table-wrap">
          ${repostajes.length?`
            <table>
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Precio unit.</th><th>Total</th><th>Km</th><th>Estación</th><th></th></tr></thead>
              <tbody>${repostajesPag.map(r=>{
                const esE = normTipo(r.tipo).includes('eléctric')||normTipo(r.tipo).includes('electric');
                const u = esE?'kWh':'L';
                return `<tr>
                  <td>${fmtDate(r.fecha)}</td>
                  <td><span class="tag">${esc(r.tipo||'—')}</span></td>
                  <td>${r.cantidad!=null&&r.cantidad!==''?num.format(Number(r.cantidad))+' '+u:'<span class="muted">—</span>'}</td>
                  <td>${r.precio_unitario!=null&&r.precio_unitario!==''?money(r.precio_unitario)+'/'+u:'<span class="muted">—</span>'}</td>
                  <td><strong>${money(r.coste_total)}</strong></td>
                  <td>${r.km?kmFmt(r.km):'<span class="muted">—</span>'}</td>
                  <td>${r.estacion?esc(r.estacion):'<span class="muted">—</span>'}</td>
                  <td><div class="row-actions"><button class="icon-btn" data-edit-rep="${r.id}">✎</button><button class="icon-btn" data-del-rep="${r.id}">🗑</button></div></td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          `:`
            <div class="empty" style="padding:36px 20px">
              <div class="emoji">⛽</div>
              <p style="margin-bottom:0">Aún no has añadido repostajes.<br>Añade tus repostajes o recargas para ver la gráfica.</p>
            </div>
          `}
        </div>
        ${repostajes.length > REP_POR_PAGINA ? `
          <div class="pagination">
            <button type="button" class="pg-btn" data-rep-pg="first" ${repPagina===1?'disabled':''} title="Primera">«</button>
            <button type="button" class="pg-btn" data-rep-pg="prev" ${repPagina===1?'disabled':''}>‹ Anterior</button>
            <span class="pg-info">Página <strong>${repPagina}</strong> de <strong>${totalRepPaginas}</strong> · ${repostajes.length} repostajes</span>
            <button type="button" class="pg-btn" data-rep-pg="next" ${repPagina===totalRepPaginas?'disabled':''}>Siguiente ›</button>
            <button type="button" class="pg-btn" data-rep-pg="last" ${repPagina===totalRepPaginas?'disabled':''} title="Última">»</button>
          </div>
        `:''}
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <button type="button" class="mp-toggle" id="btn-toggle-rec">
          <span>${mostrarRecambios?'▼':'▶'}</span>
          <span>${mostrarRecambios?'Ocultar recambios básicos':'Ver recambios básicos'}</span>
          ${recambios.length?`<span class="badge muted">${recambios.length}</span>`:''}
        </button>
        ${mostrarRecambios?`<div class="spacer"></div><button class="btn primary sm" id="btn-add-rec">＋ Añadir recambio</button>`:''}
      </div>
      <div class="mp-panel" id="rec-panel" ${mostrarRecambios?'':'hidden'}>
        <div class="card table-wrap">
          ${recambios.length?`
            <table>
              <thead><tr><th>Imagen</th><th>P/N</th><th>Marca</th><th>Descripción</th><th>Cantidad</th><th>P/N alternativos</th><th></th></tr></thead>
              <tbody>${recambios.map(r=>`
                <tr>
                  <td>${r.imagen?`<div class="rec-thumb rec-thumb-bg ${getCachedUrl(r.imagen)?'':'rec-thumb-loading'}" data-img-path="${esc(r.imagen)}" data-ver-doc="${esc(r.imagen)}" title="Ver imagen"></div>`:`<div class="rec-thumb-tag">🔩</div>`}</td>
                  <td><span class="rec-pn">${esc(r.pn||'—')}</span></td>
                  <td>${r.marca?esc(r.marca):'<span class="muted">—</span>'}</td>
                  <td>${r.descripcion?`<span class="rec-desc">${esc(r.descripcion)}</span>`:'<span class="muted">—</span>'}${r.notas?`<div class="hint" style="margin-top:2px">📝 ${esc(r.notas)}</div>`:''}</td>
                  <td>${r.cantidad??1}</td>
                  <td>${r.pn_alternativos?`<span class="rec-alt">${esc(r.pn_alternativos)}</span>`:'<span class="muted">—</span>'}</td>
                  <td><div class="row-actions"><button class="icon-btn" data-edit-rec="${r.id}">✎</button><button class="icon-btn" data-del-rec="${r.id}">🗑</button></div></td>
                </tr>`).join('')}</tbody>
            </table>
          `:`
            <div class="empty" style="padding:36px 20px">
              <div class="emoji">🔩</div>
              <p style="margin-bottom:0">Aún no has añadido recambios.</p>
            </div>
          `}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <button type="button" class="mp-toggle" id="btn-toggle-hist">
          <span>${mostrarHistorial?'▼':'▶'}</span>
          <span>${mostrarHistorial?'Ocultar historial de mantenimiento':'Ver historial de mantenimiento'}</span>
          ${mants.length?`<span class="badge muted">${mants.length}</span>`:''}
        </button>
        ${mostrarHistorial?`<div class="spacer"></div><button class="btn primary sm" id="btn-add-mant">＋ Añadir intervención</button>`:''}
      </div>
      <div class="mp-panel" id="hist-panel" ${mostrarHistorial?'':'hidden'}>
        <div class="card table-wrap">
          ${mants.length?`
            <table>
              <thead><tr><th>Tipo</th><th>Fecha</th><th>Km</th><th>Coste</th><th>Taller</th><th>Próximo</th><th></th></tr></thead>
              <tbody>${mants.map(m=>mantRow(m,v)).join('')}</tbody>
            </table>
          `:`
            <div class="empty" style="padding:44px 20px">
              <div class="emoji">🔧</div>
              <p style="margin-bottom:0">Todavía no has registrado ninguna intervención.</p>
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  /* Precargar miniaturas en un único lote */
  const todasLasImgs = [
    ...recambios.map(r=>r.imagen),
    ...v.mantenimientos.flatMap(m => (m.materiales||[]).map(x=>x.imagen))
  ].filter(Boolean);
  if(todasLasImgs.length) precargarImagenesRecambios(todasLasImgs);

  document.getElementById('btn-edit-vehicle').onclick = () => openVehicleForm(v.id);
  document.getElementById('btn-del-vehicle').onclick = () => deleteVehicle(v.id);
  document.getElementById('btn-km').onclick = () => openKmForm(v.id);
  const bAddMant = document.getElementById('btn-add-mant'); if(bAddMant) bAddMant.onclick = () => openMantForm(v.id);
  const bAddRec = document.getElementById('btn-add-rec'); if(bAddRec) bAddRec.onclick = () => openRecambioForm(v.id);
  const bAddRep = document.getElementById('btn-add-rep'); if(bAddRep) bAddRep.onclick = () => openRepostajeForm(v.id);

  /* Toggles: no re-render, solo mostrar/ocultar el panel */
  bindToggle('btn-toggle-docs',       'docs-panel',       ()=>mostrarDocs,       val=>{mostrarDocs=val;},       'Ocultar documentos y obligaciones',          'Ver documentos y obligaciones');
  bindToggle('btn-toggle-mp',         'mp-panel',         ()=>mostrarMantProg,   val=>{mostrarMantProg=val;},   'Ocultar mantenimiento programado',           'Ver mantenimiento programado');
  bindToggle('btn-toggle-docoficial', 'docoficial-panel', ()=>mostrarDocOficial, val=>{mostrarDocOficial=val;}, 'Ocultar documentación oficial del vehículo', 'Ver documentación oficial del vehículo');
  bindToggle('btn-toggle-rep',        'rep-panel',        ()=>mostrarRepostajes, val=>{mostrarRepostajes=val;}, 'Ocultar repostajes / recargas',              'Ver repostajes / recargas');
  bindToggle('btn-toggle-rec',        'rec-panel',        ()=>mostrarRecambios,  val=>{mostrarRecambios=val;},  'Ocultar recambios básicos',                  'Ver recambios básicos');
  bindToggle('btn-toggle-hist',       'hist-panel',       ()=>mostrarHistorial,  val=>{mostrarHistorial=val;},  'Ocultar historial de mantenimiento',         'Ver historial de mantenimiento');

  const bImp = document.getElementById('btn-import-xml'); if(bImp) bImp.onclick = () => openImportXMLModal(v.id);
  const bAmp = document.getElementById('btn-add-mp'); if(bAmp) bAmp.onclick = () => openMantProgForm(v.id);
  const bImpE = document.getElementById('btn-import-xml-empty'); if(bImpE) bImpE.onclick = () => openImportXMLModal(v.id);
  const bAmpE = document.getElementById('btn-add-mp-empty'); if(bAmpE) bAmpE.onclick = () => openMantProgForm(v.id);
  el.querySelectorAll('[data-edit-mant]').forEach(b=>b.onclick=()=>openMantForm(v.id,b.dataset.editMant));
  el.querySelectorAll('[data-del-mant]').forEach(b=>b.onclick=()=>deleteMant(v.id,b.dataset.delMant));
  el.querySelectorAll('[data-edit-mp]').forEach(b=>b.onclick=()=>openMantProgForm(v.id,b.dataset.editMp));
  el.querySelectorAll('[data-del-mp]').forEach(b=>b.onclick=()=>deleteMantProg(v.id,b.dataset.delMp));
  el.querySelectorAll('[data-edit-rec]').forEach(b=>b.onclick=()=>openRecambioForm(v.id,b.dataset.editRec));
  el.querySelectorAll('[data-del-rec]').forEach(b=>b.onclick=()=>deleteRecambio(v.id,b.dataset.delRec));
  el.querySelectorAll('[data-edit-rep]').forEach(b=>b.onclick=()=>openRepostajeForm(v.id,b.dataset.editRep));
  el.querySelectorAll('[data-del-rep]').forEach(b=>b.onclick=()=>deleteRepostaje(v.id,b.dataset.delRep));
  el.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>{const r=document.getElementById(b.dataset.toggle);if(r)r.hidden=!r.hidden;}));
  el.querySelectorAll('[data-ver-doc]').forEach(b=>b.addEventListener('click',()=>verDocumento(b.dataset.verDoc)));
  el.querySelectorAll('[data-add-hist]').forEach(b=>b.addEventListener('click',()=>openHistorialForm(v.id,normTipo(b.dataset.addHist))));
  el.querySelectorAll('[data-ver-hist]').forEach(b=>b.addEventListener('click',()=>openHistorialList(v.id,normTipo(b.dataset.verHist))));
  el.querySelectorAll('[data-rep-vista]').forEach(b=>b.addEventListener('click',()=>{repVista=b.dataset.repVista;repPagina=1;render();}));
  el.querySelectorAll('[data-rep-pg]').forEach(b=>b.addEventListener('click',()=>{
    const accion = b.dataset.repPg;
    if(accion==='first') repPagina = 1;
    else if(accion==='prev') repPagina = Math.max(1, repPagina-1);
    else if(accion==='next') repPagina = Math.min(totalRepPaginas, repPagina+1);
    else if(accion==='last') repPagina = totalRepPaginas;
    render();
    const panel = document.getElementById('rep-panel');
    if(panel) panel.scrollIntoView({behavior:'smooth',block:'start'});
  }));

  if(repostajes.length) dibujarGrafica(repostajes);
}

/* ============ GRÁFICA (CSS pura) ============ */
function dibujarGrafica(repostajes){
  const cont = document.getElementById('rep-chart');
  if(!cont) return;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const labels=[],values=[];
  const fISO = d => { const x = new Date(d.getTime()-d.getTimezoneOffset()*60000); return x.toISOString().slice(0,10); };
  const fShort = iso => { const [y,m,d]=iso.split('-'); return `${d}/${m}`; };

  if(repVista === 'semanal'){
    const dias=[];
    for(let i=6;i>=0;i--){ const d=new Date(hoy); d.setDate(d.getDate()-i); dias.push(fISO(d)); }
    dias.forEach(iso=>{labels.push(fShort(iso));values.push(0);});
    repostajes.forEach(r=>{const i=dias.indexOf(r.fecha);if(i>=0)values[i]+=Number(r.coste_total)||0;});
  } else if(repVista === 'mensual'){
    const dias=[];
    for(let i=29;i>=0;i--){ const d=new Date(hoy); d.setDate(d.getDate()-i); dias.push(fISO(d)); }
    const buckets=[0,0,0,0,0];
    dias.forEach((iso,idx)=>{
      const sem = Math.floor((dias.length-1-idx)/7);
      const val = repostajes.filter(r=>r.fecha===iso).reduce((s,r)=>s+(Number(r.coste_total)||0),0);
      buckets[sem] += val;
    });
    ['Esta semana','Hace 1 sem.','Hace 2 sem.','Hace 3 sem.','Hace 4 sem.'].forEach((n,i)=>{labels.push(n);values.push(buckets[i]||0);});
  } else {
    const meses=[];
    for(let i=11;i>=0;i--){
      const d=new Date(hoy.getFullYear(),hoy.getMonth()-i,1);
      const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0');
      meses.push({key:`${y}-${m}`,label:`${m}/${String(y).slice(2)}`});
    }
    meses.forEach(mm=>{labels.push(mm.label);values.push(0);});
    repostajes.forEach(r=>{if(!r.fecha)return;const k=r.fecha.slice(0,7);const i=meses.findIndex(mm=>mm.key===k);if(i>=0)values[i]+=Number(r.coste_total)||0;});
  }

  const max = Math.max(...values, 1);
  cont.innerHTML = `<div class="rep-bars">${
    labels.map((lab,i)=>{
      const v = values[i]||0;
      const pct = v>0 ? Math.max(2, Math.round(v/max*100)) : 0;
      return `<div class="rep-bar-col">
        <div class="rep-bar-val">${v?money(v):''}</div>
        <div class="rep-bar-track">
          <div class="rep-bar" style="height:${pct}%" title="${esc(lab)}: ${money(v)}"></div>
        </div>
        <div class="rep-bar-lbl">${esc(lab)}</div>
      </div>`;
    }).join('')
  }</div>`;
}

/* ============ TARJETAS ============ */
function docCard(nombre,iso,warnDays,extra,acciones){
  const d = daysUntil(iso);
  let cls='ok',sub='';
  if(d===null){cls='';sub='Sin fecha';}
  else if(d<0){cls='danger';sub=`Vencido hace ${pluralDias(Math.abs(d))}`;}
  else if(d<=warnDays){cls='warn';sub=`Vence en ${pluralDias(d)}`;}
  else {cls='ok';sub=`Quedan ${pluralDias(d)}`;}
  return `<div class="doc ${cls}"><div class="bar"></div><div class="name">${nombre}</div><div class="date">${fmtDate(iso)}</div><div class="sub">${sub}</div>${extra?`<div class="doc-extra">${extra}</div>`:''}${acciones?`<div class="doc-actions">${acciones}</div>`:''}</div>`;
}
function docFileCard(nombre,path){
  return `<div class="doc ${path?'ok':''}"><div class="bar"></div><div class="name">${nombre}</div>${path?`<div class="actions" style="margin-top:8px"><button type="button" class="btn ghost tiny" data-ver-doc="${esc(path)}">📄 Ver documento</button></div>`:`<div class="no-file">Sin documento adjunto</div>`}</div>`;
}
function mantRow(m,v){
  let prox = '<span class="muted">—</span>';
  if(m.proximaFecha||m.proximoKm){
    const p=[];
    if(m.proximaFecha){const d=daysUntil(m.proximaFecha);let c='ok';if(d!==null&&d<0)c='danger';else if(d!==null&&d<=30)c='warn';p.push(`<span class="badge ${c}">${fmtDate(m.proximaFecha)}</span>`);}
    if(m.proximoKm){const r=Number(m.proximoKm)-(Number(v.km)||0);let c='ok';if(r<=0)c='danger';else if(r<=1000)c='warn';p.push(`<span class="badge ${c}">${kmFmt(m.proximoKm)}</span>`);}
    prox = `<div style="display:flex;gap:5px;flex-wrap:wrap">${p.join('')}</div>`;
  }
  const mats = Array.isArray(m.materiales)?m.materiales:[];
  const totM = mats.reduce((s,x)=>s+(Number(x.cantidad)||0)*(Number(x.precio)||0),0);
  const tot = (Number(m.coste)||0)+totM;
  const cf = mats.filter(x=>x.imagen).length;
  const dId = 'det-'+m.id;
  const mainRow = `<tr>
    <td><span class="tag">${esc(m.tipo||'Otros')}</span></td>
    <td>${fmtDate(m.fecha)}</td>
    <td>${m.km?kmFmt(m.km):'<span class="muted">—</span>'}</td>
    <td><strong>${tot?money(tot):'<span class="muted">—</span>'}</strong>${mats.length?`<button type="button" class="link-btn" data-toggle="${dId}">🔧 ${mats.length} material${mats.length===1?'':'es'}${cf?` · 📷 ${cf}`:''}</button>`:''}</td>
    <td>${m.taller?esc(m.taller):'<span class="muted">—</span>'}</td>
    <td>${prox}</td>
    <td><div class="row-actions"><button class="icon-btn" data-edit-mant="${m.id}">✎</button><button class="icon-btn" data-del-mant="${m.id}">🗑</button></div></td>
  </tr>`;
  const detRow = mats.length?`
    <tr id="${dId}" class="detail-row" hidden><td colspan="7"><div class="mats-wrap">
      <table class="mats-table"><thead><tr><th>Foto</th><th>Material</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th><th>Tienda</th></tr></thead>
      <tbody>${mats.map(x=>{const s=(Number(x.cantidad)||0)*(Number(x.precio)||0);return `<tr>
        <td>${x.imagen?`<div class="mat-thumb rec-thumb-bg ${getCachedUrl(x.imagen)?'':'rec-thumb-loading'}" data-img-path="${esc(x.imagen)}" data-ver-doc="${esc(x.imagen)}" title="Ver imagen"></div>`:'<span class="muted">—</span>'}</td>
        <td>${esc(x.nombre||'—')}</td><td>${x.cantidad??'—'}</td>
        <td>${x.precio!=null&&x.precio!==''?money(x.precio):'—'}</td>
        <td><strong>${money(s)}</strong></td><td>${esc(x.tienda||'—')}</td>
      </tr>`;}).join('')}</tbody></table>
      <div class="mats-total">Mano de obra: <strong>${money(m.coste)}</strong> · Materiales: <strong>${money(totM)}</strong> · Total: <strong>${money(tot)}</strong></div>
    </div></td></tr>`:'';
  return mainRow+detRow;
}

/* ============ ALERTAS ============ */
function getAlerts(v){
  const out=[];
  const check=(label,iso,w)=>{
    const d = daysUntil(iso);
    if(d===null) return;
    if(d<0) out.push({level:'danger',text:`${label} vencido hace ${pluralDias(Math.abs(d))} (${fmtDate(iso)})`});
    else if(d<=w) out.push({level:'warn',text:`${label} vence en ${pluralDias(d)} — ${fmtDate(iso)}`});
  };
  const curItv  = getCurrentObl(v.id,'itv');
  const curSeg  = getCurrentObl(v.id,'seguro');
  const curIvtm = getCurrentObl(v.id,'ivtm');
  check('ITV',  curItv  ? (curItv.proxima_fecha  || curItv.fecha)  : null, 30);
  check('Seguro', curSeg ? (curSeg.proxima_fecha  || curSeg.fecha) : null, 21);
  check('Impuesto de circulación (IVTM)', curIvtm ? (curIvtm.proxima_fecha || curIvtm.fecha) : null, 30);

  if(v.intervalo_revision_km && v.ultima_revision_km){
    const p = Number(v.ultima_revision_km)+Number(v.intervalo_revision_km);
    const r = p-(Number(v.km)||0);
    if(r<=1000) out.push({level:r<=0?'danger':'warn',text:r<=0?`Revisión por km superada por ${kmFmt(Math.abs(r))} (tocaba a los ${kmFmt(p)})`:`Revisión por km próxima: faltan ${kmFmt(r)} (a los ${kmFmt(p)})`});
  }
  (v.mantenimientos||[]).forEach(m=>{
    if(m.proximaFecha){const d=daysUntil(m.proximaFecha);if(d!==null&&d<=30)out.push({level:d<0?'danger':'warn',text:`${m.tipo||'Mantenimiento'} ${d<0?'pendiente desde hace '+pluralDias(Math.abs(d)):'programado en '+pluralDias(d)}`});}
    if(m.proximoKm){const r=Number(m.proximoKm)-(Number(v.km)||0);if(r<=1000)out.push({level:r<=0?'danger':'warn',text:`${m.tipo||'Mantenimiento'} ${r<=0?'superado por '+kmFmt(Math.abs(r)):'en '+kmFmt(r)}`});}
  });
  if(!out.length) out.push({level:'info',text:'Todo en orden. No hay avisos próximos.'});
  return out.sort((a,b)=>{const r=x=>x==='danger'?0:x==='warn'?1:2;return r(a.level)-r(b.level);});
}

/* ============ MODAL ============ */
function openModal(title,body,onSubmit,submitLabel='Guardar'){
  modalRoot.innerHTML = `
    <div class="overlay"><div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close>✕</button></div>
      <form id="modal-form" novalidate>
        <div class="modal-body">${body}</div>
        <div class="modal-foot">
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary" id="modal-submit">${esc(submitLabel)}</button>
        </div>
      </form>
    </div></div>`;
  const overlay = modalRoot.querySelector('.overlay');
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal();});
  modalRoot.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeModal));
  modalRoot.querySelector('#modal-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const btn = document.getElementById('modal-submit');
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'Guardando…';
    try { await onSubmit(new FormData(e.target)); }
    catch(err){console.error(err);alert('Error: '+(err.message||err));btn.disabled=false;btn.textContent=orig;}
  });
  const first = modalRoot.querySelector('input,select,textarea');
  if(first) setTimeout(()=>first.focus(),40);
}
function closeModal(){ modalRoot.innerHTML = ''; }
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

/* ============ REPOSTAJES ============ */
function openRepostajeForm(vid,repId){
  const v = vehicles.find(x=>x.id===vid);
  const reg = repId ? allRepostajes.find(r=>r.id===repId) : null;
  const esNuevo = !reg;
  const fecha = reg?.fecha || todayISO();

  const tipoDef = reg?.tipo || tipoRepostajePorDefecto(v?.combustible);
  const esElecInicial = esTipoElectrico(tipoDef);
  const estacionInicial = reg?.estacion || '';
  const esCasaInicial = esElecInicial && estacionInicial.trim().toLowerCase() === 'casa';
  const origenInicial = esElecInicial ? (esCasaInicial ? 'casa' : 'otro') : 'otro';

  const body = `
    <div class="grid2">
      <label>Fecha<input type="date" name="fecha" value="${esc(fecha)}" required></label>
      <label>Tipo<select name="tipo" id="rep-tipo" required>${TIPOS_REPOSTAJE.map(t=>`<option ${tipoDef===t?'selected':''}>${t}</option>`).join('')}</select></label>
    </div>
    <div class="grid3">
      <label>Cantidad (L o kWh)<input name="cantidad" type="number" step="0.01" min="0" value="${esc(reg?.cantidad)}" placeholder="Ej. 45.20"></label>
      <label>Precio unit. (€/L · €/kWh)<input name="precio_unitario" type="number" step="0.001" min="0" value="${esc(reg?.precio_unitario)}" placeholder="Ej. 1.599"></label>
      <label>Coste total (€)<input name="coste_total" id="rep-coste" type="number" step="0.01" min="0" value="${esc(reg?.coste_total)}"></label>
    </div>
    <div class="hint">Si rellenas cantidad y precio unitario, el coste total se calcula automáticamente.</div>
    <div class="grid2">
      <label>Kilómetros (odómetro)<input name="km" type="number" min="0" step="1" value="${esc(reg?.km)}"></label>
      <div id="rep-estacion-wrap" ${esElecInicial && esCasaInicial ? 'hidden' : ''}>
        <label><span id="rep-estacion-lbl">Estación / Lugar</span>
          <input name="estacion" id="rep-estacion" value="${esc(esCasaInicial ? '' : estacionInicial)}" placeholder="Repsol, Iberdrola…">
        </label>
      </div>
    </div>
    <div id="rep-origen-wrap" ${esElecInicial ? '' : 'hidden'}>
      <label style="text-transform:none;font-weight:600;font-size:.8rem;color:var(--muted)">¿Dónde has cargado?</label>
      <div style="display:flex;gap:18px;margin-top:6px;flex-wrap:wrap">
        <label style="flex-direction:row;align-items:center;gap:6px;text-transform:none;font-weight:600;font-size:.85rem;color:var(--text)">
          <input type="radio" name="origen_recarga" value="casa" ${origenInicial==='casa'?'checked':''}> 🏠 En casa
        </label>
        <label style="flex-direction:row;align-items:center;gap:6px;text-transform:none;font-weight:600;font-size:.85rem;color:var(--text)">
          <input type="radio" name="origen_recarga" value="otro" ${origenInicial==='otro'?'checked':''}> 📍 En otro sitio
        </label>
      </div>
    </div>
    <label>Notas<textarea name="notas" rows="2">${esc(reg?.notas)}</textarea></label>`;

  openModal(esNuevo?'Nuevo repostaje / recarga':'Editar repostaje',body,async fd=>{
    const cantidad = fd.get('cantidad')?Number(fd.get('cantidad')):null;
    const precio = fd.get('precio_unitario')?Number(fd.get('precio_unitario')):null;
    let coste = fd.get('coste_total')?Number(fd.get('coste_total')):0;
    if(!coste && cantidad != null && precio != null) coste = cantidad*precio;

    const tipo = (fd.get('tipo')||'Otro').trim();
    const esElec = esTipoElectrico(tipo);
    let estacion = (fd.get('estacion')||'').trim()||null;
    if(esElec){
      const origen = fd.get('origen_recarga') || 'otro';
      if(origen === 'casa') estacion = 'Casa';
    }

    const data = {
      vehicle_id: vid,
      fecha: fd.get('fecha')||null,
      tipo,
      cantidad, precio_unitario: precio,
      coste_total: coste,
      km: fd.get('km')?Number(fd.get('km')):null,
      estacion,
      notas: (fd.get('notas')||'').trim()||null
    };
    if(reg){ const {error}=await sb.from('repostajes').update(data).eq('id',reg.id); if(error) throw error; }
    else { const {error}=await sb.from('repostajes').insert(data); if(error) throw error; }
    if(data.km && Number(data.km) > (Number(vehicles.find(v=>v.id===vid)?.km)||0)){
      await sb.from('vehicles').update({km:Number(data.km)}).eq('id',vid);
    }
    await loadData(); closeModal(); render();
    toast(reg?'Actualizado':'Añadido','ok');
  }, esNuevo?'Añadir':'Guardar');

  setTimeout(()=>{
    const ci=document.querySelector('#modal-form [name="cantidad"]');
    const pi=document.querySelector('#modal-form [name="precio_unitario"]');
    const ti=document.getElementById('rep-coste');
    if(ci&&pi&&ti){
      const rec=()=>{const c=Number(ci.value)||0;const p=Number(pi.value)||0;if(c>0&&p>0)ti.value=(c*p).toFixed(2);};
      ci.addEventListener('input',rec); pi.addEventListener('input',rec);
    }
    const tipoSel   = document.getElementById('rep-tipo');
    const origenWrap= document.getElementById('rep-origen-wrap');
    const estWrap   = document.getElementById('rep-estacion-wrap');
    const estLbl    = document.getElementById('rep-estacion-lbl');
    const estInput  = document.getElementById('rep-estacion');
    if(!tipoSel||!origenWrap||!estWrap||!estLbl||!estInput) return;
    const actualizar = () => {
      const esElec = esTipoElectrico(tipoSel.value);
      origenWrap.hidden = !esElec;
      if(esElec){
        const origen = document.querySelector('#modal-form [name="origen_recarga"]:checked')?.value || 'otro';
        estWrap.hidden = (origen === 'casa');
        estLbl.textContent = 'Lugar / Punto de recarga';
        estInput.placeholder = 'Iberdrola, Repsol, Zunder…';
      } else {
        estWrap.hidden = false;
        estLbl.textContent = 'Estación / Lugar';
        estInput.placeholder = 'Repsol, Cepsa, BP…';
      }
    };
    tipoSel.addEventListener('change', actualizar);
    document.querySelectorAll('#modal-form [name="origen_recarga"]').forEach(r=>r.addEventListener('change', actualizar));
    actualizar();
  },60);
}
async function deleteRepostaje(vid,repId){
  const reg = allRepostajes.find(r=>r.id===repId); if(!reg) return;
  if(!confirm(`¿Eliminar el repostaje del ${fmtDate(reg.fecha)} (${money(reg.coste_total)})?`)) return;
  const {error}=await sb.from('repostajes').delete().eq('id',repId);
  if(error) return toast('Error: '+error.message,'error');
  await loadData(); render(); toast('Eliminado','ok');
}

/* ============ RECAMBIOS ============ */
function openRecambioForm(vid,rid){
  const reg = rid ? allRecambios.find(r=>r.id===rid) : null;
  const esNuevo = !reg;
  let _file=null,_preview=null;
  const body = `
    <div class="grid2">
      <label>P/N <span style="color:var(--danger)">*</span><input name="pn" value="${esc(reg?.pn)}" required></label>
      <label>Marca<input name="marca" value="${esc(reg?.marca)}"></label>
    </div>
    <label>Descripción<input name="descripcion" value="${esc(reg?.descripcion)}" placeholder="Ej. Pastillas de freno delanteras"></label>
    <div class="grid2">
      <label>Cantidad<input name="cantidad" type="number" min="0" step="1" value="${esc(reg?.cantidad??1)}"></label>
      <label>P/N alternativos<input name="pn_alternativos" value="${esc(reg?.pn_alternativos)}"></label>
    </div>
    <label>Notas<textarea name="notas" rows="2">${esc(reg?.notas)}</textarea></label>
    <h4>Imagen (opcional)</h4>
    <div class="rec-img-btns">
      <button type="button" class="mat-img-btn" id="rec-cam">📷 Hacer foto</button>
      <button type="button" class="mat-img-btn" id="rec-gal">🖼 Galería</button>
    </div>
    <input type="file" accept="image/*" capture="environment" id="rec-cam-inp" hidden>
    <input type="file" accept="image/*" id="rec-gal-inp" hidden>
    <div id="rec-prev">
      ${reg?.imagen?`<div class="rec-img-preview"><div class="rec-thumb-tag" data-ver-doc="${esc(reg.imagen)}" title="Ver imagen">📷</div></div>`:''}
    </div>`;
  openModal(esNuevo?'Añadir recambio':'Editar recambio',body,async fd=>{
    const data = {
      vehicle_id: vid,
      pn: (fd.get('pn')||'').trim(),
      marca: (fd.get('marca')||'').trim()||null,
      descripcion: (fd.get('descripcion')||'').trim()||null,
      cantidad: fd.get('cantidad')?Number(fd.get('cantidad')):1,
      pn_alternativos: (fd.get('pn_alternativos')||'').trim()||null,
      notas: (fd.get('notas')||'').trim()||null
    };
    if(!data.pn) throw new Error('P/N obligatorio.');
    let ridF = reg?.id;
    if(reg){ const {error}=await sb.from('recambios').update(data).eq('id',reg.id); if(error) throw error; }
    else { data.orden = registrosRecambios(vid).length; const {data:ins,error}=await sb.from('recambios').insert(data).select('id').single(); if(error) throw error; ridF=ins.id; }
    if(_file && _file.size>0 && ridF){
      const path = await subirRecambioImagen(_file,vid,ridF);
      if(path){ const {error}=await sb.from('recambios').update({imagen:path}).eq('id',ridF); if(error) throw error; }
    }
    await loadData(); closeModal(); render();
    toast(reg?'Actualizado':'Añadido','ok');
  }, esNuevo?'Añadir':'Guardar');
  setTimeout(()=>{
    const cb=document.getElementById('rec-cam'),gb=document.getElementById('rec-gal