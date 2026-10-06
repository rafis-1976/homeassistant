import { sb, h, weekStart, addDays, fmtFecha, renderHeader } from './app.js';

renderHeader('lista');

const semana = new URLSearchParams(location.search).get('semana') || weekStart();
const MAX_FILAS_VACIAS = 3;

let CATALOGO = [];
let TIENDAS  = [];
let ITEMS    = [];

// Nav de semana
document.getElementById('week-nav').innerHTML = `
  <a href="lista.html?semana=${addDays(semana, -7)}">← Anterior</a>
  <strong>${fmtFecha(semana)} — ${fmtFecha(addDays(semana, 6))}</strong>
  <a href="lista.html?semana=${addDays(semana, 7)}">Siguiente →</a>
`;

async function init() {
  const [cat, tien, items] = await Promise.all([
    sb.from('compras_ingredientes')
      .select('id, nombre, unidad, tienda_id')
      .order('nombre'),
    sb.from('compras_tiendas').select('*').order('orden'),
    sb.from('compras_lista')
      .select('*, compras_ingredientes(nombre, unidad), compras_tiendas(nombre, color)')
      .eq('semana_inicio', semana)
      .order('created_at', { ascending: true }),
  ]);
  CATALOGO = cat.data || [];
  TIENDAS  = tien.data || [];
  ITEMS    = items.data || [];

  renderDatalist();
  renderLista();
  renderResumen();
}

function renderDatalist() {
  const uniq = [...new Set(CATALOGO.map(i => i.nombre))].sort((a,b) => a.localeCompare(b));
  document.getElementById('lista-ings').innerHTML =
    uniq.map(n => `<option value="${h(n)}">`).join('');
}

function renderResumen() {
  const total = ITEMS.length;
  const pend  = ITEMS.filter(i => !i.comprado).length;
  document.getElementById('resumen').innerHTML = `
    <span>📦 <strong>${total}</strong> productos</span>
    <span>⏳ <strong>${pend}</strong> pendientes</span>
  `;
}

function renderLista() {
  const cont = document.getElementById('lista-filas');
  cont.innerHTML = '';

  for (const it of ITEMS) {
    cont.appendChild(buildFila(it));
  }
  for (let i = 0; i < MAX_FILAS_VACIAS; i++) {
    cont.appendChild(buildFila(null));
  }
}

function nombreDeItem(it) {
  return it.compras_ingredientes?.nombre ?? it.nombre_libre ?? '';
}

function buildFila(item) {
  const row = document.createElement('div');
  row.className = 'lista-row';
  if (item) {
    row.dataset.id = item.id;
    if (item.comprado) row.classList.add('comprado');
  }

  const nombre   = item ? nombreDeItem(item) : '';
  const unidad   = item?.compras_ingredientes?.unidad ?? '';
  const cantidad = item?.cantidad ?? '';
  const comprado = item?.comprado ?? false;

  row.innerHTML = `
    <button class="check-btn" title="Marcar como comprado" type="button"
            aria-pressed="${comprado}">
      <span class="check-icon">${comprado ? '✓' : ''}</span>
    </button>
    <input type="text" class="nombre-input" list="lista-ings"
           value="${h(nombre)}" placeholder="Escribe un ingrediente o algo libre…"
           autocomplete="off">
    <input type="number" class="cant-input" min="0.01" step="0.01"
           value="${cantidad}" placeholder="1">
    <span class="unidad-label">${h(unidad)}</span>
    <button class="del-btn" title="Borrar" type="button">✕</button>
  `;

  const nombreIn = row.querySelector('.nombre-input');
  const cantIn   = row.querySelector('.cant-input');
  const checkBtn = row.querySelector('.check-btn');
  const delBtn   = row.querySelector('.del-btn');

  nombreIn.addEventListener('change', () => guardarFila(row));
  cantIn.addEventListener('change',   () => guardarFila(row));

  // Botón "comprado" — toggle
  checkBtn.addEventListener('click', async () => {
    const id = row.dataset.id;
    if (!id) return;

    const nuevoEstado = !row.classList.contains('comprado');

    const { error } = await sb.from('compras_lista')
      .update({ comprado: nuevoEstado }).eq('id', id);
    if (error) return console.error(error);

    row.classList.toggle('comprado', nuevoEstado);
    checkBtn.setAttribute('aria-pressed', nuevoEstado ? 'true' : 'false');
    checkBtn.querySelector('.check-icon').textContent = nuevoEstado ? '✓' : '';

    const it = ITEMS.find(x => x.id == id);
    if (it) it.comprado = nuevoEstado;
    renderResumen();
  });

  delBtn.addEventListener('click', async () => {
    const id = row.dataset.id;
    if (id && !confirm('¿Quitar este producto?')) return;
    if (id) {
      await sb.from('compras_lista').delete().eq('id', id);
      ITEMS = ITEMS.filter(x => x.id != id);
    }
    row.remove();
    ensureEmptyRows();
    renderResumen();
  });

  return row;
}

async function guardarFila(row) {
  const id       = row.dataset.id || null;
  const nombre   = row.querySelector('.nombre-input').value.trim();
  const cantidad = parseFloat(row.querySelector('.cant-input').value) || 1;

  // Vacío y fila nueva → no hacer nada
  if (!nombre && !id) return;

  // Vacío y fila existente → borrar
  if (!nombre && id) {
    await sb.from('compras_lista').delete().eq('id', id);
    ITEMS = ITEMS.filter(x => x.id != id);
    row.remove();
    ensureEmptyRows();
    renderResumen();
    return;
  }

  // Buscar coincidencia exacta con un ingrediente conocido
  const ing = CATALOGO.find(i => i.nombre.toLowerCase() === nombre.toLowerCase());

  const payload = {
    cantidad,
    semana_inicio: semana,
    manual: true,
  };

  if (ing) {
    payload.ingrediente_id = ing.id;
    payload.tienda_id      = ing.tienda_id;
    payload.nombre_libre   = null;
    row.querySelector('.unidad-label').textContent = ing.unidad || '';
  } else {
    payload.ingrediente_id = null;
    payload.tienda_id      = null;
    payload.nombre_libre   = nombre;
    row.querySelector('.unidad-label').textContent = '';
  }

  if (id) {
    const { error } = await sb.from('compras_lista').update(payload).eq('id', id);
    if (error) return console.error(error);
    const it = ITEMS.find(x => x.id == id);
    if (it) {
      Object.assign(it, payload);
      it.compras_ingredientes = ing
        ? { nombre: ing.nombre, unidad: ing.unidad }
        : null;
    }
  } else {
    const { data, error } = await sb.from('compras_lista')
      .insert(payload)
      .select('*, compras_ingredientes(nombre, unidad)')
      .single();
    if (error) return console.error(error);
    row.dataset.id = data.id;
    ITEMS.push(data);
    ensureEmptyRows();
  }
  renderResumen();
}

function ensureEmptyRows() {
  const cont = document.getElementById('lista-filas');
  const vacias = [...cont.querySelectorAll('.lista-row')]
    .filter(r => !r.dataset.id && !r.querySelector('.nombre-input').value.trim()).length;
  for (let i = vacias; i < MAX_FILAS_VACIAS; i++) {
    cont.appendChild(buildFila(null));
  }
}

init();