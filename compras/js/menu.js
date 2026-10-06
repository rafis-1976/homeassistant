import { sb, h, fmt, renderHeader } from './app.js';

renderHeader('menus');

const id = parseInt(new URLSearchParams(location.search).get('id') || '0', 10);
const cont = document.getElementById('contenido');

if (!id) {
  cont.innerHTML = '<p class="empty">Menú no encontrado.</p>';
} else {
  const [menuResp, ingsResp, allResp] = await Promise.all([
    sb.from('compras_menus').select('*').eq('id', id).single(),
    sb.from('compras_menu_ingredientes')
      .select('cantidad, compras_ingredientes (id, nombre, unidad, compras_tiendas(nombre))')
      .eq('menu_id', id),
    sb.from('compras_ingredientes').select('id, nombre, unidad').order('nombre'),
  ]);

  if (menuResp.error) {
    cont.innerHTML = `<p class="empty">${h(menuResp.error.message)}</p>`;
  } else {
    const m = menuResp.data;
    const ings = ingsResp.data || [];
    const todos = allResp.data || [];

    cont.innerHTML = `
      <div class="card">
        <h2>${h(m.nombre)}</h2>
        <form id="form-menu">
          <div class="form-row">
            <input name="nombre" value="${h(m.nombre)}" required style="flex:1;min-width:220px">
            <select name="tipo">
              ${['ambos','comida','cena'].map(t => `<option value="${t}" ${m.tipo===t?'selected':''}>${t}</option>`).join('')}
            </select>
            <input name="raciones" type="number" min="1" value="${m.raciones}" style="width:90px">
          </div>
          <div class="form-row">
            <textarea name="descripcion" placeholder="Descripción...">${h(m.descripcion||'')}</textarea>
          </div>
          <div class="form-row">
            <textarea name="instrucciones" placeholder="Instrucciones...">${h(m.instrucciones||'')}</textarea>
          </div>
          <button class="btn">💾 Guardar cambios</button>
        </form>
      </div>

      <div class="card">
        <h3>🥕 Ingredientes (para ${m.raciones} raciones)</h3>
        ${ings.length ? `
          <table>
            <thead>
              <tr>
                <th>Ingrediente</th>
                <th class="col-cantidad">Cantidad</th>
                <th class="col-unidad">Unidad</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${ings.map(i => {
                const ing = i.compras_ingredientes;
                const cant = Number(i.cantidad);
                const uni  = ing?.unidad ?? '';
                return `
                  <tr>
                    <td>${h(ing?.nombre ?? '(sin nombre)')}</td>
                    <td class="col-cantidad">${fmt(cant)}</td>
                    <td class="col-unidad">${h(uni)}</td>
                    <td>
                      <button class="btn danger small" data-ing="${ing?.id ?? ''}">✕</button>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>`
        : '<p class="empty">Este menú aún no tiene ingredientes.</p>'}

        <h3 style="margin-top:1.2rem">➕ Añadir ingrediente</h3>
        <form id="form-add-ing" class="form-row">
          <select name="ingrediente_id" required style="flex:1;min-width:220px">
            <option value="">— Selecciona ingrediente —</option>
            ${todos.map(i => `<option value="${i.id}">${h(i.nombre)} (${h(i.unidad)})</option>`).join('')}
          </select>
          <input type="number" name="cantidad" step="0.01" min="0.01" value="1" style="width:110px" required>
          <button class="btn">Añadir</button>
        </form>
      </div>
    `;

    // Guardar cambios del menú
    document.getElementById('form-menu').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const { error } = await sb.from('compras_menus').update({
        nombre:        f.nombre.value.trim(),
        tipo:          f.tipo.value,
        raciones:      parseInt(f.raciones.value, 10) || 2,
        descripcion:   f.descripcion.value.trim(),
        instrucciones: f.instrucciones.value.trim(),
      }).eq('id', id);
      if (error) return alert(error.message);
      alert('✅ Cambios guardados');
    });

    // Añadir ingrediente
    document.getElementById('form-add-ing').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const ingId = parseInt(f.ingrediente_id.value, 10);
      const cant  = parseFloat(f.cantidad.value);

      if (!ingId || !isFinite(cant) || cant <= 0) {
        return alert('Revisa el ingrediente y la cantidad');
      }

      const { error } = await sb.from('compras_menu_ingredientes').upsert(
        { menu_id: id, ingrediente_id: ingId, cantidad: cant },
        { onConflict: 'menu_id,ingrediente_id' }
      );
      if (error) return alert(error.message);
      location.reload();
    });

    // Quitar ingrediente
    cont.querySelectorAll('button[data-ing]').forEach(b => {
      b.addEventListener('click', async () => {
        const ingId = b.dataset.ing;
        if (!ingId) return;
        const { error } = await sb.from('compras_menu_ingredientes')
          .delete().eq('menu_id', id).eq('ingrediente_id', ingId);
        if (error) return alert(error.message);
        location.reload();
      });
    });
  }
}