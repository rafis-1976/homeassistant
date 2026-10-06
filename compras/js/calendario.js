import { sb, h, weekStart, addDays, diaEs, fmtFecha, renderHeader, toast } from './app.js';

renderHeader('calendario');

const params = new URLSearchParams(location.search);
const semana = params.get('semana') || weekStart();

// Nav de semana (rutas relativas)
document.getElementById('week-nav').innerHTML = `
  <a href="index.html?semana=${addDays(semana, -7)}">← Semana anterior</a>
  <strong>${fmtFecha(addDays(semana, 0))} — ${fmtFecha(addDays(semana, 6))}</strong>
  <a href="index.html?semana=${addDays(semana, 7)}">Semana siguiente →</a>
`;
document.getElementById('btn-ver-lista').href = `lista.html?semana=${semana}`;

// Días de la semana (lunes → domingo)
const dias = [];
for (let i = 0; i < 7; i++) dias.push(addDays(semana, i));

const hoy = new Date();
const hoyYMD = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;

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
  cal[row.fecha] = cal[row.fecha] || {};
  cal[row.fecha][row.tipo] = row;
}

// Render de la pizarra (7 columnas)
const grid = document.getElementById('board-grid');
grid.innerHTML = '';

for (const fecha of dias) {
  const col = document.createElement('div');
  col.className = 'day-column';

  const dayDate = new Date(fecha + 'T00:00:00');
  const dow = dayDate.getDay();
  if (dow === 0 || dow === 6) col.classList.add('weekend');
  if (fecha === hoyYMD)       col.classList.add('today');

  const com  = cal[fecha]?.comida || null;
  const cen  = cal[fecha]?.cena   || null;

  const opciones = (cel) => `
    <option value="0">— sin menú —</option>
    ${menus.map(m => `<option value="${m.id}" ${cel?.menu_id == m.id ? 'selected' : ''}>${h(m.nombre)}</option>`).join('')}
  `;

  col.innerHTML = `
    <div class="day-header">
      <div class="day-name">${diaEs(fecha)}</div>
      <div class="day-date">${fmtFecha(fecha)}</div>
    </div>

    <div class="meal-slot">
      <div class="meal-label">🍲 Comida</div>
      <div class="meal-row">
        <select class="menu-select" data-fecha="${fecha}" data-tipo="comida">
          ${opciones(com)}
        </select>
        <input type="number" min="1" max="20" value="${com?.comensales ?? 2}"
               class="comensales-input" data-fecha="${fecha}" data-tipo="comida"
               title="Comensales">
      </div>
    </div>

    <div class="meal-slot">
      <div class="meal-label">🌙 Cena</div>
      <div class="meal-row">
        <select class="menu-select" data-fecha="${fecha}" data-tipo="cena">
          ${opciones(cen)}
        </select>
        <input type="number" min="1" max="20" value="${cen?.comensales ?? 2}"
               class="comensales-input" data-fecha="${fecha}" data-tipo="cena"
               title="Comensales">
      </div>
    </div>
  `;
  grid.appendChild(col);
}

// Guardado automático — SOLO toca compras_calendario.
// NO modifica la lista de la compra.
grid.addEventListener('change', async (e) => {
  const el    = e.target;
  const fecha = el.dataset.fecha;
  const tipo  = el.dataset.tipo;
  if (!fecha || !tipo) return;

  const slot       = el.closest('.meal-slot');
  const menuId     = parseInt(slot.querySelector('.menu-select').value, 10);
  const comensales = parseInt(slot.querySelector('.comensales-input').value, 10) || 1;

  if (menuId === 0) {
    const { error } = await sb.from('compras_calendario')
      .delete().eq('fecha', fecha).eq('tipo', tipo);
    if (error) return toast('Error al borrar', true);
  } else {
    const { error } = await sb.from('compras_calendario').upsert(
      { fecha, tipo, menu_id: menuId, comensales },
      { onConflict: 'fecha,tipo' }
    );
    if (error) return toast('Error al guardar', true);
  }
  toast('Guardado ✍️');
});