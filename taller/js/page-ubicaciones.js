/* ============================================================
   Página: Ubicaciones y categorías
   ============================================================ */
TP.pageTitle = 'Ubicaciones y categorías';
TP.pageSub   = 'Organiza tu taller';
TP.navId     = 'ubicaciones';

TP.onReady = function () {
  const cats = TP.dbAll(`
    SELECT c.nombre AS nombre,
           (SELECT COUNT(*) FROM herramientas h WHERE h.categoria = c.nombre) AS n
    FROM categorias c ORDER BY c.nombre COLLATE NOCASE`);
  const ubis = TP.dbAll(`
    SELECT u.nombre AS nombre,
           (SELECT COUNT(*) FROM herramientas h WHERE h.ubicacion = u.nombre) AS n
    FROM ubicaciones u ORDER BY u.nombre COLLATE NOCASE`);
  const sinUbi = TP.dbGet("SELECT COUNT(*) AS c FROM herramientas WHERE ubicacion = '' OR ubicacion IS NULL").c;

  const $v = TP.$('#view');
  $v.innerHTML = `
    <div class="section-title">📍 Ubicaciones de almacenamiento
      <button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="TP.nuevaUbicacion()">＋ Añadir ubicación</button>
    </div>
    ${ubis.length ? `<div class="loc-grid">${ubis.map(u => `
      <div class="loc">
        <div class="loc-ico">📍</div>
        <div class="loc-info">
          <div class="loc-name">${TP.esc(u.nombre)}</div>
          <div class="loc-count">${u.n} herramienta(s)</div>
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
      ${cats.map(c => `
        <div class="loc">
          <div class="loc-ico">${TP.iconoCat(c.nombre)}</div>
          <div class="loc-info">
            <div class="loc-name">${TP.esc(c.nombre)}</div>
            <div class="loc-count">${c.n} herramienta(s)</div>
          </div>
          <button class="btn-icon" onclick="TP.editarCategoria('${TP.esc(c.nombre).replace(/'/g, "\\'")}')" title="Renombrar">✏️</button>
          <button class="btn-icon" onclick="TP.borrarCategoria('${TP.esc(c.nombre).replace(/'/g, "\\'")}')" title="Eliminar" style="color:var(--danger)">🗑️</button>
        </div>`).join('')}
    </div>`;
};

TP.nuevaUbicacion = function () {
  TP.showModal({
    title: 'Nueva ubicación',
    body: `<div class="form-grid"><label class="full">Nombre de la ubicación
      <input id="u-nombre" placeholder="Ej: Estantería C, Caja roja, Pared sur..."></label></div>`,
    saveText: 'Añadir',
    onSave: () => {
      const n = TP.$('#u-nombre').value.trim();
      if (!n) { TP.toast('Escribe un nombre', 'err'); return false; }
      if (TP.dbGet('SELECT 1 AS x FROM ubicaciones WHERE nombre = ?', [n])) { TP.toast('Ya existe esa ubicación', 'err'); return false; }
      TP.dbRun('INSERT INTO ubicaciones (nombre) VALUES (?)', [n]);
      TP.refresh(); TP.toast('Ubicación añadida');
    }
  });
};
TP.editarUbicacion = function (antigua) {
  TP.showModal({
    title: 'Renombrar ubicación',
    body: `<div class="form-grid"><label class="full">Nuevo nombre
      <input id="u-nombre" value="${TP.esc(antigua)}"></label></div>`,
    saveText: 'Guardar',
    onSave: () => {
      const n = TP.$('#u-nombre').value.trim();
      if (!n) { TP.toast('Escribe un nombre', 'err'); return false; }
      TP.dbExec('BEGIN');
      TP.dbRun('UPDATE ubicaciones SET nombre = ? WHERE nombre = ?', [n, antigua]);
      TP.dbRun('UPDATE herramientas SET ubicacion = ? WHERE ubicacion = ?', [n, antigua]);
      TP.dbExec('COMMIT');
      TP.refresh(); TP.toast('Ubicación renombrada');
    }
  });
};
TP.borrarUbicacion = function (nombre) {
  const n = TP.dbGet('SELECT COUNT(*) AS c FROM herramientas WHERE ubicacion = ?', [nombre]).c;
  TP.showModal({
    title: 'Eliminar ubicación',
    body: `<p style="font-size:14.5px">¿Eliminar la ubicación <b>${TP.esc(nombre)}</b>?</p>
           ${n ? `<div class="alert alert-w" style="margin-top:12px"><span>⚠️</span><div>${n} herramienta(s) quedarán sin ubicación asignada.</div></div>` : ''}`,
    saveText: 'Eliminar',
    onSave: () => {
      TP.dbExec('BEGIN');
      TP.dbRun('DELETE FROM ubicaciones WHERE nombre = ?', [nombre]);
      TP.dbRun('UPDATE herramientas SET ubicacion = ? WHERE ubicacion = ?', ['', nombre]);
      TP.dbExec('COMMIT');
      TP.refresh(); TP.toast('Ubicación eliminada');
    }
  });
};

TP.nuevaCategoria = function () {
  TP.showModal({
    title: 'Nueva categoría',
    body: `<div class="form-grid"><label class="full">Nombre de la categoría
      <input id="c-nombre" placeholder="Ej: Neumática, Soldadura, Corte..."></label></div>`,
    saveText: 'Añadir',
    onSave: () => {
      const n = TP.$('#c-nombre').value.trim();
      if (!n) { TP.toast('Escribe un nombre', 'err'); return false; }
      if (TP.dbGet('SELECT 1 AS x FROM categorias WHERE nombre = ?', [n])) { TP.toast('Ya existe esa categoría', 'err'); return false; }
      TP.dbRun('INSERT INTO categorias (nombre) VALUES (?)', [n]);
      TP.refresh(); TP.toast('Categoría añadida');
    }
  });
};
TP.editarCategoria = function (antigua) {
  TP.showModal({
    title: 'Renombrar categoría',
    body: `<div class="form-grid"><label class="full">Nuevo nombre
      <input id="c-nombre" value="${TP.esc(antigua)}"></label></div>`,
    saveText: 'Guardar',
    onSave: () => {
      const n = TP.$('#c-nombre').value.trim();
      if (!n) { TP.toast('Escribe un nombre', 'err'); return false; }
      TP.dbExec('BEGIN');
      TP.dbRun('UPDATE categorias SET nombre = ? WHERE nombre = ?', [n, antigua]);
      TP.dbRun('UPDATE herramientas SET categoria = ? WHERE categoria = ?', [n, antigua]);
      TP.dbExec('COMMIT');
      TP.refresh(); TP.toast('Categoría renombrada');
    }
  });
};
TP.borrarCategoria = function (nombre) {
  const n = TP.dbGet('SELECT COUNT(*) AS c FROM herramientas WHERE categoria = ?', [nombre]).c;
  TP.showModal({
    title: 'Eliminar categoría',
    body: `<p style="font-size:14.5px">¿Eliminar la categoría <b>${TP.esc(nombre)}</b>?</p>
           ${n ? `<div class="alert alert-w" style="margin-top:12px"><span>⚠️</span><div>${n} herramienta(s) pasarán a la categoría <b>Otros</b>.</div></div>` : ''}`,
    saveText: 'Eliminar',
    onSave: () => {
      TP.dbRun("INSERT OR IGNORE INTO categorias (nombre) VALUES ('Otros')");
      TP.dbExec('BEGIN');
      TP.dbRun('DELETE FROM categorias WHERE nombre = ?', [nombre]);
      TP.dbRun("UPDATE herramientas SET categoria = 'Otros' WHERE categoria = ?", [nombre]);
      TP.dbExec('COMMIT');
      TP.refresh(); TP.toast('Categoría eliminada');
    }
  });
};

TP.boot();