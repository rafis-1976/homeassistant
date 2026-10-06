import { sb, h, weekStart, addDays, diaEs, fmtFecha, renderHeader, regenerarLista } from './app.js';

renderHeader('calendario');

const params   = new URLSearchParams(location.search);
const semana   = params.get('semana') || weekStart();

// Nav de semana
document.getElementById('week-nav').innerHTML = `
  <a href="/?semana=${addDays(semana, -7)}">← Semana anterior</a>
  <strong>Semana del ${fmtFecha(semana)}</strong>
  <a href="/?semana=${addDays(semana, 7)}">Semana siguiente →</a>
`;
document.getElementById('btn-ver-lista').href = `/lista.html?semana=${semana}`;

// Días de la semana
const dias = [];
for (let i = 0; i < 7; i++) dias.push(addDays(semana, i));

// Cargar datos
const [menusResp, calResp] = await Promise.all([
  sb.from('compras_menus').select('id, nombre').order('nombre'),
  sb.from('compras_calendario').select('*').gte('fecha', dias[0]).lte('fecha', dias[6]),
]);

if (menusResp.error) console.error(menusResp.error);
if (calResp.error)   console.error(calResp.error);

const menus = menusResp.data || [];
const cal   = {};
for (const row of (calResp.data || [])) {
  cal[row.fecha]        = cal[row.fecha] || {};
  cal[row.fecha][row.tipo] = row;
}

// Render tabla
const tbody = document.getElementById('cal-body');
tbody.innerHTML = '';

for (const fecha of dias) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<th class="dia">${diaEs(fecha)}<br><small>${fmtFecha(fecha)}</small></th>`;

  for (const tipo of ['comida', 'cena']) {
    const cel = cal[fecha]?.[tipo] || null;
    const td  = document.createElement('td');
    td.innerHTML = `
      <form class="cell-form">
        <select class="menu-select" data-fecha="${fecha}" data-tipo="${tipo}">
          <option value="0">— Sin asignar —</option>
          ${menus.map(m => `<option value="${m.id}" ${cel?.menu_id == m.id ? 'selected' : ''}>${h(m.nombre)}</option>`).join('')}
        </select>
        <input type="number" min="1" max="20" value="${cel?.comensales ?? 2}"
               class="comensales-input" data-fecha="${fecha}" data-tipo="${tipo}">
      </form>`;
    tr.appendChild(td);
  }
  tbody.appendChild(tr);
}

// Guardado automático
tbody.addEventListener('change', async (e) => {
  const el = e.target;
  const fecha = el.dataset.fecha;
  const tipo  = el.dataset.tipo;
  const form  = el.closest('form');
  const menuId     = parseInt(form.querySelector('.menu-select').value, 10);
  const comensales = parseInt(form.querySelector('.comensales-input').value, 10) || 1;

  if (menuId === 0) {
    const { error } = await sb.from('compras_calendario').delete().eq('fecha', fecha).eq('tipo', tipo);
    if (error) return toast('Error al borrar', true);
  } else {
    const { error } = await sb.from('compras_calendario').upsert(
      { fecha, tipo, menu_id: menuId, comensales },
      { onConflict: 'fecha,tipo' }
    );
    if (error) return toast('Error al guardar', true);
  }
  toast('Guardado');
});

// Regenerar lista
document.getElementById('btn-regen').addEventListener('click', async () => {
  const btn = document.getElementById('btn-regen');
  btn.disabled = true;
  btn.textContent = '⏳ Generando...';
  try {
    const { insertados } = await regenerarLista(semana);
    toast(`✅ Lista generada (${insertados} productos)`);
  } catch (err) {
    console.error(err);
    toast('Error al generar la lista', true);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Regenerar lista de la compra';
  }
});

/* Toast helper global */
function toast(msg, error = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (error ? ' error' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => t.remove(), 2200);
}