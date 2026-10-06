import { sb, h, renderHeader } from './app.js';

renderHeader('ingredientes');

let CATS = [], TIENDAS = [];

async function cargarCatalogos() {
  const [c, t] = await Promise.all([
    sb.from('compras_categorias').select('*').order('orden'),
    sb.from('compras_tiendas').select('*').order('orden'),
  ]);
  CATS = c.data || [];
  TIENDAS = t.data || [];

  document.getElementById('sel-cat').innerHTML =
    '<option value="">— Categoría —</option>' +
    CATS.map(x => `<option value="${x.id}">${h(x.nombre)}</option>`).join('');
  document.getElementById('sel-tienda').innerHTML =
    '<option value="">— Tienda —</option>' +
    TIENDAS.map(x => `<option value="${x.id}">${h(x.nombre)}</option>`).join('');
}

async function cargar() {
  const { data, error } = await sb.from('compras_ingredientes')
    .select('*, compras_categorias(nombre, orden), compras_tiendas(nombre)')
    .order('nombre');
  if (error) { console.error(error); return; }

  const cont = document.getElementById('listado');
  if (!data?.length) { cont.innerHTML = '<p class="empty">No hay ingredientes.</p>'; return; }

  // Ordenar por categoría
  data.sort((a, b) => (a.compras_categorias?.orden ?? 999) - (b.compras_categorias?.orden ?? 999)
                    || a.nombre.localeCompare(b.nombre));

  cont.innerHTML = `
    <table>
      <thead><tr><th>Nombre</th><th>Unidad</th><th>Categoría</th><th>Tienda</th><th>€ aprox</th><th></th></tr></thead>
      <tbody>
        ${data.map(i => `
          <tr data-id="${i.id}">
            <td><input data-field="nombre" value="${h(i.nombre)}" style="width:100%"></td>
            <td><input data-field="unidad" value="${h(i.unidad)}" style="width:80px"></td>
            <td>
              <select data-field="categoria_id" style="width:100%">
                <option value="">—</option>
                ${CATS.map(c => `<option value="${c.id}" ${i.categoria_id==c.id?'selected':''}>${h(c.nombre)}</option>`).join('')}
              </select>
            </td>
            <td>
              <select data-field="tienda_id" style="width:100%">
                <option value="">—</option>
                ${TIENDAS.map(t => `<option value="${t.id}" ${i.tienda_id==t.id?'selected':''}>${h(t.nombre)}</option>`).join('')}
              </select>
            </td>
            <td><input data-field="precio_aprox" type="number" step="0.01" min="0" value="${i.precio_aprox ?? ''}" style="width:80px"></td>
            <td style="white-space:nowrap">
              <button class="btn small success" data-act="save">💾</button>
              <button class="btn small danger" data-act="del">✕</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  cont.querySelectorAll('tr[data-id]').forEach(tr => {
    tr.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const id = tr.dataset.id;
      const get = f => tr.querySelector(`[data-field="${f}"]`).value;
      const { error } = await sb.from('compras_ingredientes').update({
        nombre:       get('nombre').trim(),
        unidad:       get('unidad').trim() || 'ud',
        categoria_id: get('categoria_id') ? parseInt(get('categoria_id'),10) : null,
        tienda_id:    get('tienda_id')    ? parseInt(get('tienda_id'),10)    : null,
        precio_aprox: get('precio_aprox') !== '' ? parseFloat(get('precio_aprox')) : null,
      }).eq('id', id);
      if (error) return alert(error.message);
      const btn = tr.querySelector('[data-act="save"]');
      btn.textContent = '✓';
      setTimeout(() => btn.textContent = '💾', 1200);
    });

    tr.querySelector('[data-act="del"]').addEventListener('click', async () => {
      if (!confirm('¿Borrar este ingrediente?')) return;
      const { error } = await sb.from('compras_ingredientes').delete().eq('id', tr.dataset.id);
      if (error) return alert(error.message);
      cargar();
    });
  });
}

document.getElementById('form-nuevo').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const { error } = await sb.from('compras_ingredientes').insert({
    nombre:       f.nombre.value.trim(),
    unidad:       f.unidad.value.trim() || 'ud',
    categoria_id: f.categoria_id.value ? parseInt(f.categoria_id.value,10) : null,
    tienda_id:    f.tienda_id.value    ? parseInt(f.tienda_id.value,10)    : null,
    precio_aprox: f.precio_aprox.value !== '' ? parseFloat(f.precio_aprox.value) : null,
  });
  if (error) return alert(error.message);
  f.reset();
  f.unidad.value = 'ud';
  cargar();
});

await cargarCatalogos();
cargar();