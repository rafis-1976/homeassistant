import { sb, h, fmt, money, weekStart, addDays, fmtFecha, renderHeader, regenerarLista } from './app.js';

renderHeader('lista');

const semana = new URLSearchParams(location.search).get('semana') || weekStart();

// Nav de semana (rutas relativas)
document.getElementById('week-nav').innerHTML = `
  <a href="lista.html?semana=${addDays(semana, -7)}">← Semana anterior</a>
  <strong>Semana del ${fmtFecha(semana)}</strong>
  <a href="lista.html?semana=${addDays(semana, 7)}">Semana siguiente →</a>
`;

/* Catálogo para el selector manual */
(async () => {
  const { data } = await sb.from('compras_ingredientes').select('id, nombre, unidad').order('nombre');
  document.getElementById('sel-ing').innerHTML =
    '<option value="">— Selecciona ingrediente —</option>' +
    (data||[]).map(i => `<option value="${i.id}">${h(i.nombre)} (${h(i.unidad)})</option>`).join('');
})();

async function cargar() {
  const [itemsResp, tiendasResp] = await Promise.all([
    sb.from('compras_lista')
      .select('*, compras_ingredientes (nombre, unidad, precio_aprox), compras_tiendas (nombre, color, orden)')
      .eq('semana_inicio', semana),
    sb.from('compras_tiendas').select('*').order('orden'),
  ]);

  const items    = itemsResp.data || [];
  const tiendas  = tiendasResp.data || [];

  // Agrupar por tienda
  const grupos = {};
  for (const it of items) {
    const key = it.tienda_id ?? 0;
    (grupos[key] = grupos[key] || []).push(it);
  }

  // Orden de grupos: tiendas + "sin tienda"
  const orden = [
    ...tiendas.map(t => ({ id: t.id, nombre: t.nombre, color: t.color })),
    { id: 0, nombre: 'Sin tienda asignada', color: '#9ca3af' },
  ];

  // Resumen
  const totalItems      = items.length;
  const totalPendientes = items.filter(i => !i.comprado).length;
  const coste = items.reduce((sum, it) => {
    if (it.comprado || it.compras_ingredientes?.precio_aprox == null) return sum;
    return sum + Number(it.compras_ingredientes.precio_aprox) * Number(it.cantidad);
  }, 0);

  document.getElementById('resumen').innerHTML = `
    <span>📦 <strong>${totalItems}</strong> productos</span>
    <span>⏳ <strong>${totalPendientes}</strong> pendientes</span>
    <span>💶 ~<strong>${money(coste)}</strong></span>
    <button class="btn success" id="btn-regen" style="margin-left:auto">🔄 Regenerar desde calendario</button>
    <button class="btn danger" id="btn-vaciar">🗑️ Vaciar</button>
  `;

  document.getElementById('btn-regen').addEventListener('click', async (e) => {
    const b = e.target; b.disabled = true; b.textContent = '⏳...';
    try {
      const { insertados } = await regenerarLista(semana);
      alert(`✅ Lista regenerada (${insertados} productos)`);
      cargar();
    } catch (err) { alert(err.message); }
    finally { b.disabled = false; b.textContent = '🔄 Regenerar desde calendario'; }
  });

  document.getElementById('btn-vaciar').addEventListener('click', async () => {
    if (!confirm('¿Vaciar toda la lista de esta semana?')) return;
    const { error } = await sb.from('compras_lista').delete().eq('semana_inicio', semana);
    if (error) return alert(error.message);
    cargar();
  });

  // Render grupos
  const cont = document.getElementById('grupos');
  if (!items.length) {
    cont.innerHTML = '<p class="empty">La lista está vacía. Asigna menús en el calendario y pulsa «Regenerar».</p>';
    return;
  }

  cont.innerHTML = orden.map(g => {
    const gItems = grupos[g.id] || [];
    if (!gItems.length) return '';
    gItems.sort((a,b) => (a.compras_ingredientes?.nombre||'').localeCompare(b.compras_ingredientes?.nombre||''));
    return `
      <div class="tienda-group">
        <div class="tienda-header" style="background:${h(g.color)}">
          <span class="dot"></span>
          <span>${h(g.nombre)}</span>
          <span style="margin-left:auto;font-weight:400;font-size:.85rem">${gItems.length} productos</span>
        </div>
        <div class="tienda-items">
          ${gItems.map(it => {
            const ing = it.compras_ingredientes;
            const precio = ing?.precio_aprox != null
              ? `~${money(Number(ing.precio_aprox) * Number(it.cantidad))}` : '';
            return `
              <div class="item ${it.comprado ? 'comprado' : ''}" data-id="${it.id}">
                <input type="checkbox" ${it.comprado ? 'checked' : ''} data-act="toggle">
                <span class="nombre">${h(ing?.nombre)}${it.manual ? ' <small style="color:#9ca3af">(manual)</small>' : ''}</span>
                <span class="cant">${fmt(it.cantidad)} ${h(ing?.unidad||'')}</span>
                <span class="cant">${precio}</span>
                <button class="btn danger small" data-act="del">✕</button>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');

  cont.querySelectorAll('.item').forEach(row => {
    const id = row.dataset.id;
    row.querySelector('[data-act="toggle"]').addEventListener('change', async (e) => {
      const { error } = await sb.from('compras_lista')
        .update({ comprado: e.target.checked }).eq('id', id);
      if (error) return alert(error.message);
      row.classList.toggle('comprado', e.target.checked);
    });
    row.querySelector('[data-act="del"]').addEventListener('click', async () => {
      if (!confirm('¿Quitar este producto?')) return;
      const { error } = await sb.from('compras_lista').delete().eq('id', id);
      if (error) return alert(error.message);
      cargar();
    });
  });
}

/* Añadir producto manual */
document.getElementById('form-manual').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const ingId = parseInt(f.ingrediente_id.value, 10);

  // Traer tienda del ingrediente
  const { data: ing } = await sb.from('compras_ingredientes')
    .select('tienda_id').eq('id', ingId).single();

  const { error } = await sb.from('compras_lista').insert({
    ingrediente_id: ingId,
    cantidad:       parseFloat(f.cantidad.value),
    tienda_id:      ing?.tienda_id ?? null,
    semana_inicio:  semana,
    manual:         true,
    comprado:       false,
  });
  if (error) return alert(error.message);
  f.cantidad.value = 1;
  cargar();
});

cargar();