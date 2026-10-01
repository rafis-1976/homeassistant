/* ============================================================
   Página: Ubicaciones y categorías — datos desde Supabase
   ============================================================ */
TP.pageTitle = 'Ubicaciones y categorías';
TP.pageSub   = 'Organiza tu taller';
TP.navId     = 'ubicaciones';

TP.onReady = async function () {
  const $v = TP.$('#view');
  $v.innerHTML = '<p style="color:var(--text-2);padding:20px">Cargando…</p>';

  try {
    // Todo en paralelo
    const [
      { data: catRows },
      { data: ubiRows },
      { data: herrs }
    ] = await Promise.all([
      TP.sb.from('taller_categorias').select('nombre').order('nombre'),
      TP.sb.from('taller_ubicaciones').select('nombre').order('nombre'),
      TP.sb.from('taller_herramientas').select('categoria, ubicacion')
    ]);

    const listaCats = catRows || [];
    const listaUbis = ubiRows || [];
    const herramientas = herrs || [];

    // Contar en cliente
    const cuentaCat = {};
    herramientas.forEach(h => { cuentaCat[h.categoria] = (cuentaCat[h.categoria] || 0) + 1; });
    const cuentaUbi = {};
    herramientas.forEach(h => {
      const u = h.ubicacion || '';
      cuentaUbi[u] = (cuentaUbi[u] || 0) + 1;
    });
    const sinUbi = herramientas.filter(h => !h.ubicacion).length;

    $v.innerHTML = `
      <div class="section-title">📍 Ubicaciones de almacenamiento
        <button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="TP.nuevaUbicacion()">＋ Añadir ubicación</button>
      </div>
      ${listaUbis.length ? `<div class="loc-grid">${listaUbis.map(u => `
        <div class="loc">
          <div class="loc-ico">📍</div>
          <div class="loc-info">
            <div class="loc-name">${TP.esc(u.nombre)}</div>
            <div class="loc-count">${cuentaUbi[u.nombre] || 0} herramienta(s)</div>
          </div>
          <button class="btn-icon" onclick="TP.editarUbicacion('${TP.esc(u.nombre).replace(/'/g, "\\'")}')" title="Renombrar">✏️</button>
          <button class="btn-icon" onclick="TP.borrarUbicacion('${TP.esc(u.nombre).replace(/'/g, "\\'")}')" title="Eliminar" style="color:var(--danger)">🗑️</button>
        </div>`).join('')}</div>`
      : '<p style="color:var(--text-2);font-size:13.5px">No hay ubicaciones definidas.</p>'}

      ${sinUbi ? `<div class="alert alert-i" style="margin-top:16px"><span>ℹ️</span><div>Hay <b>${sinUbi}</b> herramienta(s) sin ubicación asignada. Edítalas para asignarles un sitio.</div></div>` : ''}

      <div class="section-title" style="margin-top:34px">🏷️ Categorías
        <button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="TP.nuevaCategoria()">＋ Añadir categoría</button>
      </div>
      <div class="loc-grid">
        ${listaCats.map(c => `
          <div class="loc">
            <div class="loc-ico">${TP.iconoCat(c.nombre)}</div>
            <div class="loc-info">
              <div class="loc-name">${TP.esc(c.nombre)}</div>
              <div class="loc-count">${cuentaCat[c.nombre] || 0} herramienta(s)</div>
            </div>
            <button class="btn-icon" onclick="TP.editarCategoria('${TP.esc(c.nombre).replace(/'/g, "\\'")}')" title="Renombrar">✏️</button>
            <button class="btn-icon" onclick="TP.borrarCategoria('${TP.esc(c.nombre).replace(/'/g, "\\'")}')" title="Eliminar" style="color:var(--danger)">🗑️</button>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    console.error(err);
    $v.innerHTML = `<div class="empty"><div class="em">⚠️</div><h3>Error al cargar</h3><p>${TP.esc(err.message)}</p></div>`;
  }
};

/* ---------- Ubicaciones ---------- */
TP.nuevaUbicacion = function () {
  TP.showModal({
    title: 'Nueva ubicación',
    body: `<div class="form-grid"><label class="full">Nombre de la ubicación
      <input id="u-nombre" placeholder="Ej: Estantería C, Caja roja, Pared sur..."></label></div>`,
    saveText: 'Añadir',
    onSave: async () => {
      const n = TP.$('#u-nombre').value.trim();
      if (!n) { TP.toast('Escribe un nombre', 'err'); return false; }
      const { error } = await TP.sb.from('taller_ubicaciones').insert({ nombre: n });
      if (error) { TP.toast('Error: ' + error.message, 'err'); return false; }
      await TP.onReady();
      TP.toast('Ubicación añadida');
    }
  });
};

TP.editarUbicacion = function (antigua) {
  TP.showModal({
    title: 'Renombrar ubicación',
    body: `<div class="form-grid"><label class="full">Nuevo nombre
      <input id="u-nombre" value="${TP.esc(antigua)}"></label></div>`,
    saveText: 'Guardar',
    onSave: async () => {
      const n = TP.$('#u-nombre').value.trim();
      if (!n) { TP.toast('Escribe un nombre', 'err'); return false; }
      // 1. Insertar la nueva
      await TP.sb.from('taller_ubicaciones').insert({ nombre: n });
      // 2. Actualizar herramientas
      await TP.sb.from('taller_herramientas').update({ ubicacion: n }).eq('ubicacion', antigua);
      // 3. Borrar la antigua
      await TP.sb.from('taller_ubicaciones').delete().eq('nombre', antigua);
      await TP.onReady();
      TP.toast('Ubicación renombrada');
    }
  });
};

TP.borrarUbicacion = async function (nombre) {
  const { count } = await TP.sb.from('taller_herramientas')
    .select('id', { count: 'exact', head: true })
    .eq('ubicacion', nombre);
  TP.showModal({
    title: 'Eliminar ubicación',
    body: `<p style="font-size:14.5px">¿Eliminar la ubicación <b>${TP.esc(nombre)}</b>?</p>
           ${count ? `<div class="alert alert-w" style="margin-top:12px"><span>⚠️</span><div>${count} herramienta(s) quedarán sin ubicación asignada.</div></div>` : ''}`,
    saveText: 'Eliminar',
    onSave: async () => {
      await TP.sb.from('taller_herramientas').update({ ubicacion: '' }).eq('ubicacion', nombre);
      await TP.sb.from('taller_ubicaciones').delete().eq('nombre', nombre);
      await TP.onReady();
      TP.toast('Ubicación eliminada');
    }
  });
};

/* ---------- Categorías ---------- */
TP.nuevaCategoria = function () {
  TP.showModal({
    title: 'Nueva categoría',
    body: `<div class="form-grid"><label class="full">Nombre de la categoría
      <input id="c-nombre" placeholder="Ej: Neumática, Soldadura, Corte..."></label></div>`,
    saveText: 'Añadir',
    onSave: async () => {
      const n = TP.$('#c-nombre').value.trim();
      if (!n) { TP.toast('Escribe un nombre', 'err'); return false; }
      const { error } = await TP.sb.from('taller_categorias').insert({ nombre: n });
      if (error) { TP.toast('Error: ' + error.message, 'err'); return false; }
      await TP.onReady();
      TP.toast('Categoría añadida');
    }
  });
};

TP.editarCategoria = function (antigua) {
  TP.showModal({
    title: 'Renombrar categoría',
    body: `<div class="form-grid"><label class="full">Nuevo nombre
      <input id="c-nombre" value="${TP.esc(antigua)}"></label></div>`,
    saveText: 'Guardar',
    onSave: async () => {
      const n = TP.$('#c-nombre').value.trim();
      if (!n) { TP.toast('Escribe un nombre', 'err'); return false; }
      await TP.sb.from('taller_categorias').insert({ nombre: n });
      await TP.sb.from('taller_herramientas').update({ categoria: n }).eq('categoria', antigua);
      await TP.sb.from('taller_categorias').delete().eq('nombre', antigua);
      await TP.onReady();
      TP.toast('Categoría renombrada');
    }
  });
};

TP.borrarCategoria = async function (nombre) {
  const { count } = await TP.sb.from('taller_herramientas')
    .select('id', { count: 'exact', head: true })
    .eq('categoria', nombre);
  TP.showModal({
    title: 'Eliminar categoría',
    body: `<p style="font-size:14.5px">¿Eliminar la categoría <b>${TP.esc(nombre)}</b>?</p>
           ${count ? `<div class="alert alert-w" style="margin-top:12px"><span>⚠️</span><div>${count} herramienta(s) pasarán a la categoría <b>Otros</b>.</div></div>` : ''}`,
    saveText: 'Eliminar',
    onSave: async () => {
      await TP.sb.from('taller_categorias').upsert({ nombre: 'Otros' });
      await TP.sb.from('taller_herramientas').update({ categoria: 'Otros' }).eq('categoria', nombre);
      await TP.sb.from('taller_categorias').delete().eq('nombre', nombre);
      await TP.onReady();
      TP.toast('Categoría eliminada');
    }
  });
};

TP.boot();