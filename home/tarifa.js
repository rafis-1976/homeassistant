/* ============================================================
   TARIFA.JS
   ============================================================ */

/* ---------- FESTIVOS ---------- */
const FESTIVOS = [
  '2025-01-01','2025-01-06','2025-04-17','2025-04-18','2025-05-01',
  '2025-05-02','2025-07-25','2025-08-15','2025-10-12','2025-11-01',
  '2025-12-06','2025-12-08','2025-12-25',
  '2026-01-01','2026-01-06','2026-04-02','2026-04-03','2026-05-01',
  '2026-05-02','2026-07-25','2026-08-15','2026-10-12','2026-11-02',
  '2026-12-07','2026-12-08','2026-12-25',
  '2027-01-01','2027-01-06','2027-03-25','2027-03-26','2027-05-01',
  '2027-05-03','2027-07-26','2027-08-16','2027-10-12','2027-11-01',
  '2027-12-06','2027-12-08','2027-12-25',
];

/* ---------- HORARIOS ---------- */
const HORARIOS = {
  punta: [[10,14],[18,22]],
  llano: [[8,10],[14,16],[22,24]],
  valle: [[0,8],[16,18]]
};

const PRECIOS = { punta: 0.195, llano: 0.116, valle: 0.079 };
const PRECIO_EXCEDENTE = 0.060;
const CONTRATADA = { punta: 4600, llano: 4600, valle: 6900 };

/* ---------- FECHA MADRID ---------- */
const _fmtFechaTar = new Intl.DateTimeFormat('fr-CA',{
  timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'
});
const _fmtHoraTar = new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/Madrid',hour:'2-digit',hour12:false
});
const fechaTar = d => _fmtFechaTar.format(d);
const horaTar  = d => parseInt(_fmtHoraTar.format(d),10);

/* ---------- TARIFA ACTUAL ---------- */
function getTarifaActual(){
  const ahora = new Date();
  const diaSem = ahora.getDay();
  const fecha = fechaTar(ahora);
  const hora = horaTar(ahora);

  const esFinde = (diaSem === 0 || diaSem === 6);
  const esFestivo = FESTIVOS.includes(fecha);

  if(esFinde || esFestivo){
    return {
      periodo: 'valle',
      precio: PRECIOS.valle,
      contratada: CONTRATADA.valle,
      motivo: esFestivo ? 'Festivo' : 'Fin de semana'
    };
  }

  const enFranja = arr => arr.some(([a,b]) => hora >= a && hora < b);

  if(enFranja(HORARIOS.punta)){
    return {periodo:'punta', precio:PRECIOS.punta, contratada:CONTRATADA.punta, motivo:'Laborable'};
  }
  if(enFranja(HORARIOS.llano)){
    return {periodo:'llano', precio:PRECIOS.llano, contratada:CONTRATADA.llano, motivo:'Laborable'};
  }
  return {periodo:'valle', precio:PRECIOS.valle, contratada:CONTRATADA.valle, motivo:'Laborable'};
}

/* ---------- FORMATEADORES ---------- */
const fmtW2 = w => Math.round(w||0) + ' W';
const fmtPrecio = p => p.toFixed(3).replace('.',',') + ' €/kWh';
const nombrePeriodo = p => p.charAt(0).toUpperCase() + p.slice(1);

/* ---------- RENDER ---------- */
function renderTarifa(){
  const card = document.getElementById('tariff-card');
  if(!card) return;

  const tar = getTarifaActual();

  const solar = (typeof E !== 'undefined' && E.sol)   || 0;
  const casa  = (typeof E !== 'undefined' && E.casa)  || 0;
  const coche = (typeof E !== 'undefined' && E.coche) || 0;

  const consumoW = (casa + coche) * 1000;
  const solarW   = solar * 1000;

  const sobranteW = Math.max(0, tar.contratada - consumoW);
  const excesoW = Math.max(0, solarW - consumoW);
  const gananciaHora = (excesoW / 1000) * PRECIO_EXCEDENTE;

  card.classList.remove('punta','llano','valle');
  card.classList.add(tar.periodo);

  const badge = document.getElementById('tar-badge');
  if(badge) badge.textContent = nombrePeriodo(tar.periodo);

  const info = document.getElementById('tar-info');
  if(info){
    const hora = horaTar(new Date());
    info.textContent = tar.motivo + ' · ' + String(hora).padStart(2,'0') + ':00';
  }

  setTxtTar('tar-periodo', nombrePeriodo(tar.periodo));
  setTxtTar('tar-precio', fmtPrecio(tar.precio));
  setTxtTar('tar-precio-exc', fmtPrecio(PRECIO_EXCEDENTE));
  setTxtTar('tar-contratada', fmtW2(tar.contratada));
  setTxtTar('tar-consumo', fmtW2(consumoW));
  setTxtTar('tar-sobrante', fmtW2(sobranteW));
  setTxtTar('tar-exceso', excesoW > 5 ? fmtW2(excesoW) : '—');
  setTxtTar('tar-ganancia', excesoW > 5 ? gananciaHora.toFixed(4).replace('.',',') + ' €/h' : '—');

  actualizarSemaforo(tar, excesoW);
  actualizarSobranteGrande(sobranteW, excesoW, tar.contratada, consumoW);
  actualizarFlujoDirecto(excesoW);
}

function setTxtTar(id, txt){
  const el = document.getElementById(id);
  if(el) el.textContent = txt;
}

/* ---------- SEMÁFORO TARIFARIO ---------- */
function actualizarSemaforo(tar, excesoW){
  const ind = document.getElementById('tariff-indicator');
  const label = document.getElementById('tariff-label');
  const precio = document.getElementById('tariff-precio-ind');
  if(!ind) return;

  ind.classList.remove('punta','llano','valle','excedente');

  if(excesoW > 5){
    ind.classList.add('excedente');
    if(label) label.textContent = '⚡ Excedente FV';
    if(precio) precio.textContent = fmtW2(excesoW) + ' · ' + fmtPrecio(PRECIO_EXCEDENTE);
  } else {
    ind.classList.add(tar.periodo);
    if(label) label.textContent = nombrePeriodo(tar.periodo);
    if(precio) precio.textContent = fmtPrecio(tar.precio) + ' · ' + fmtW2(tar.contratada);
  }
}

/* ---------- BLOQUE GRANDE: POTENCIA SOBRANTE (SVG) ---------- */
function actualizarSobranteGrande(sobranteW, excesoW, contratada, consumoW){
  const g = document.getElementById('g-sobrante');
  const val = document.getElementById('v-sobrante');
  const exc = document.getElementById('v-excedente');
  const sub = document.getElementById('v-sub-sobrante');
  if(!g || !val) return;

  g.classList.toggle('excedente', excesoW > 5);

  // Valor principal (W o kW)
  if(sobranteW >= 1000){
    val.textContent = (sobranteW/1000).toFixed(2).replace('.',',') + ' kW';
  } else {
    val.textContent = Math.round(sobranteW) + ' W';
  }

  // Línea "+ excedente FV"
  if(exc){
    if(excesoW > 5){
      exc.style.display = '';
      const excTxt = excesoW >= 1000
        ? (excesoW/1000).toFixed(2).replace('.',',') + ' kW'
        : Math.round(excesoW) + ' W';
      exc.textContent = '+ ' + excTxt + ' FV';
    } else {
      exc.style.display = 'none';
    }
  }

  // Subtexto con el desglose
  if(sub){
    if(excesoW > 5){
      sub.textContent = 'contratada ' + Math.round(contratada) + ' W − consumo ' + Math.round(consumoW) + ' W';
    } else {
      sub.textContent = Math.round(contratada) + ' W contrat. − ' + Math.round(consumoW) + ' W consumo';
    }
  }
}

/* ---------- FLUJO DIRECTO FV → RED ---------- */
function actualizarFlujoDirecto(excesoW){
  const el = document.getElementById('f-export-direct');
  if(!el) return;
  const activo = excesoW > 5;
  el.classList.toggle('on', activo);
  if(activo){
    const pot = excesoW / 1000;
    el.style.stroke = '#39ff14';
    el.style.filter = 'drop-shadow(0 0 8px #39ff14)';
    el.style.animationDuration = Math.max(0.5, 1.6 - pot * 0.15).toFixed(2) + 's';
  }
}

/* ---------- INICIO ---------- */
function iniciarTarifa(){
  renderTarifa();
  setInterval(renderTarifa, 3000);
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', iniciarTarifa);
} else {
  iniciarTarifa();
}