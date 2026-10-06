import { sb, h, renderHeader } from './app.js';

renderHeader('ingredientes');

async function cargar() {
  const { data, error } = await sb.from('compras_ingredientes')
    .select('id, nombre')
    .order('nombre');
  if (error) { console.error(error); return; }

  const cont = document.getElementById('listado');
  if (!data?.length) {
    cont.innerHTML = '<p class="empty">No hay ingredientes todavía. Añade uno arriba.</p>';
    return;
  }

  cont.innerHTML = `
    <table>
      <thead>
        <tr><th>Nombre</th><th></th></tr>
      </thead>
      <tbody>
        ${data.map(i => `
          <tr data-id="${i.id}">
            <td><input data-field="nombre" value="${h(i.nombre)}" style="width:100%"></td>
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
      const nombre = tr.querySelector('[data-field="nombre"]').value.trim();
      if (!nombre) return alert('El nombre no puede estar vacío');

      const { error } = await sb.from('compras_ingredientes')
        .update({ nombre })
        .eq('id', id);
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
  const nombre = f.nombre.value.trim();
  if (!nombre) return;

  const { error } = await sb.from('compras_ingredientes').insert({
    nombre,
    unidad: 'und',   // valor por defecto — no se muestra en el formulario
  });
  if (error) return alert(error.message);

  f.reset();
  cargar();
});

cargar();