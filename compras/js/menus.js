import { sb, h, renderHeader } from './app.js';

renderHeader('menus');

async function cargar() {
  const { data, error } = await sb.from('compras_menus')
    .select('id, nombre, tipo, raciones, compras_menu_ingredientes(count)')
    .order('nombre');
  if (error) { console.error(error); return; }

  const cont = document.getElementById('listado');
  if (!data?.length) { cont.innerHTML = '<p class="empty">No hay menús todavía.</p>'; return; }

  cont.innerHTML = `
    <table>
      <thead><tr><th>Nombre</th><th>Tipo</th><th>Raciones</th><th>Ingredientes</th><th></th></tr></thead>
      <tbody>
        ${data.map(m => {
          const nIng = m.compras_menu_ingredientes?.[0]?.count ?? 0;
          return `
            <tr>
              <td><a href="/menu.html?id=${m.id}" style="color:#2563eb;text-decoration:none;font-weight:600">${h(m.nombre)}</a></td>
              <td><span class="badge ${h(m.tipo)}">${h(m.tipo)}</span></td>
              <td>${m.raciones}</td>
              <td>${nIng}</td>
              <td><button class="btn danger small" data-id="${m.id}">Borrar</button></td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  cont.querySelectorAll('button[data-id]').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm('¿Borrar este menú?')) return;
      const { error } = await sb.from('compras_menus').delete().eq('id', b.dataset.id);
      if (error) return alert(error.message);
      cargar();
    });
  });
}

document.getElementById('form-nuevo').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const { error } = await sb.from('compras_menus').insert({
    nombre:        f.nombre.value.trim(),
    tipo:          f.tipo.value,
    raciones:      parseInt(f.raciones.value, 10) || 2,
    descripcion:   '',
    instrucciones: '',
  });
  if (error) return alert(error.message);
  f.reset();
  f.raciones.value = 2;
  cargar();
});

cargar();