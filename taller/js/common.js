/* ============================================================
   TallerPro — common.js
   Utilidades · SQLite · Shell · CRUD compartido entre páginas
   ============================================================ */
(function () {
  const TP = window.TP = {};
  const $  = TP.$  = (s, r = document) => r.querySelector(s);
  const $$ = TP.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ============ Utilidades ============ */
  TP.uid    = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  TP.esc    = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  TP.hoy    = () => new Date().toISOString().slice(0, 10);
  TP.addDays = (f, n) => { const d = new Date(f + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  TP.diasHasta = f => Math.round((new Date(f + 'T00:00:00') - new Date(TP.hoy() + 'T00:00:00')) / 86400000);
  TP.fmtFecha = f => f ? new Date(f + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  TP.fmtMoney = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);
  TP.num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

  TP.ESTADOS = {
    disponible: { label: 'Disponible', cls: 'est-disponible' },
    prestada:   { label: 'Prestada',   cls: 'est-prestada' },
    averiada:   { label: 'Averiada',   cls: 'est-averiada' }
  };
  const ICONOS_CAT = {
    'Manuales':'🔨','Eléctricas':'⚡','Medición':'📏','Automoción':'🚗','Jardinería':'🌿',
    'Fijación':'🔩','Seguridad':'🦺','Soldadura':'🔥','Neumática':'💨','Pintura':'🎨','Otros':'🧰'
  };
  TP.iconoCat = c => ICONOS_CAT[c] || '🧰';

  /* ============ Config ============ */
  const LS_DATA = 'tallerpro_sqlite_v2';
  const LS_CFG  = 'tallerpro_cfg_v2';
  TP.LS_DATA = LS_DATA;
  TP.LS_CFG  = LS_CFG;

  TP.ajustes = { taller: 'Mi Taller', tema: 'claro' };
  try { Object.assign(TP.ajustes, JSON.parse(localStorage.getItem(LS_CFG) || '{}')); } catch {}

  TP.saveCfg = () => localStorage.setItem(LS_CFG, JSON.stringify(TP.ajustes));
  TP.setTema = function (t) {
    TP.ajustes.tema = t; TP.saveCfg();
    document.documentElement.dataset.theme = t;
    const btn = $('#btnTheme'); if (btn) btn.textContent = t === 'oscuro' ? '☀️' : '🌙';
  };

  /* ============ Toast ============ */
  TP.toast = function (msg, tipo = 'ok') {
    const el = document.createElement('div');
    el.className = 'toast ' + (tipo === 'err' ? 'err' : 'ok');
    el.innerHTML = `<span>${tipo === 'err' ? '⚠️' : '✅'}</span><span>${TP.esc(msg)}</span>`;
    $('#toasts').appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0'; el.style.transform = 'translateX(30px)';
      setTimeout(() => el.remove(), 320);
    }, 2600);
  };

  /* ============ Modal ============ */
  let modalSaveHandler = null;
  TP.showModal = function ({ title, body, saveText = 'Guardar', onSave, hideSave = false }) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = body;
    $('#modalSave').textContent = saveText;
    $('#modalSave').style.display = hideSave ? 'none' : '';
    modalSaveHandler = onSave;
    $('#overlay').classList.add('open');
    setTimeout(() => {
      const f = $('#modalBody input, #modalBody select, #modalBody textarea'); if (f) f.focus();
    }, 60);
  };
  TP.closeModal = function () { $('#overlay').classList.remove('open'); modalSaveHandler = null; };

  function wireModal() {
    $('#modalClose').onclick  = TP.closeModal;
    $('#modalCancel').onclick = TP.closeModal;
    $('#overlay').onclick = e => { if (e.target === $('#overlay')) TP.closeModal(); };
    $('#modalSave').onclick = () => {
      if (typeof modalSaveHandler === 'function') {
        if (modalSaveHandler() !== false) TP.closeModal();
      } else TP.closeModal();
    };
    document.addEventListener('keydown', e => { if (e.key === 'Escape') TP.closeModal(); });
  }

  /* ============ SQLite ============ */
  TP.SCHEMA = `
CREATE TABLE IF NOT EXISTS categorias (nombre TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS ubicaciones (nombre TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS herramientas (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Otros',
  marca TEXT DEFAULT '', modelo TEXT DEFAULT '', serie TEXT DEFAULT '',
  cantidad INTEGER NOT NULL DEFAULT 1, precio REAL NOT NULL DEFAULT 0,
  fecha_compra TEXT DEFAULT '', ubicacion TEXT DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'disponible',
  notas TEXT DEFAULT '', creado INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_herr_cat ON herramientas(categoria);
CREATE INDEX IF NOT EXISTS idx_herr_ubi ON herramientas(ubicacion);
CREATE INDEX IF NOT EXISTS idx_herr_est ON herramientas(estado);
CREATE TABLE IF NOT EXISTS prestamos (
  id TEXT PRIMARY KEY, herramienta_id TEXT NOT NULL,
  persona TEXT NOT NULL, telefono TEXT DEFAULT '',
  fecha_prestamo TEXT NOT NULL, fecha_prevista TEXT DEFAULT '',
  fecha_devolucion TEXT DEFAULT '', retraso INTEGER DEFAULT 0,
  notas TEXT DEFAULT '', activo INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (herramienta_id) REFERENCES herramientas(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_prest_herr   ON prestamos(herramienta_id);
CREATE INDEX IF NOT EXISTS idx_prest_activo ON prestamos(activo);
CREATE TABLE IF NOT EXISTS actividad (
  id TEXT PRIMARY KEY, fecha TEXT NOT NULL,
  tipo TEXT NOT NULL, texto TEXT NOT NULL
);
`;

  let db = TP.db = null;

  let saveTimer = null;
  TP.scheduleSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(TP.persistDB, 250); };

  TP.persistDB = function () {
    if (!db) return;
    try {
      const data = db.export();
      let s = ''; const chunk = 0x8000;
      for (let i = 0; i < data.length; i += chunk)
        s += String.fromCharCode.apply(null, data.subarray(i, i + chunk));
      localStorage.setItem(LS_DATA, btoa(s));
    } catch (e) { console.warn('No se pudo guardar la BD', e); }
  };

  TP.loadPersisted = function () {
    const b64 = localStorage.getItem(LS_DATA);
    if (!b64) return null;
    try {
      const bin = atob(b64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return u8;
    } catch (e) { return null; }
  };

  TP.dbRun = function (sql, params = []) {
    const stmt = db.prepare(sql);
    try { stmt.bind(params); stmt.step(); }
    finally { stmt.free(); }
    TP.scheduleSave();
  };
  TP.dbAll = function (sql, params = []) {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally { stmt.free(); }
  };
  TP.dbGet = (sql, params = []) => TP.dbAll(sql, params)[0] || null;
  TP.dbExec = sql => { db.exec(sql); TP.scheduleSave(); };

  TP.initDB = async function () {
    if (typeof initSqlJs !== 'function')
      throw new Error('No se pudo cargar sql.js (comprueba tu conexión a internet)');
    const SQL = await initSqlJs({
      locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}`
    });
    const persisted = TP.loadPersisted();
    db = TP.db = persisted ? new SQL.Database(persisted) : new SQL.Database();
    db.exec(TP.SCHEMA);
    TP.seedIfEmpty();
  };

  /* ============ Seed ============ */
  TP.seedIfEmpty = function () {
    if (TP.dbGet('SELECT COUNT(*) AS c FROM herramientas').c > 0) return;
    TP.dbExec('BEGIN');
    const cats = ['Manuales','Eléctricas','Medición','Automoción','Jardinería','Fijación',
                  'Seguridad','Soldadura','Neumática','Pintura','Otros'];
    const ubis = ['Estantería A','Estantería B','Cajonera','Pared norte','Armario','Zona de trabajo'];
    cats.forEach(c => TP.dbRun('INSERT OR IGNORE INTO categorias (nombre) VALUES (?)', [c]));
    ubis.forEach(u => TP.dbRun('INSERT OR IGNORE INTO ubicaciones (nombre) VALUES (?)', [u]));

    const base = [
      ['Taladro percutor 18V','Eléctricas','Bosch','GSB 18V-55','Estantería A',149.9,'2022-11-03'],
      ['Juego de llaves combinadas','Manuales','Stanley','12 pzs','Cajonera',49.5,'2021-05-18'],
      ['Calibre pie de rey digital','Medición','Mitutoyo','500-196','Armario',89,'2023-02-11'],
      ['Amoladora angular 125mm','Eléctricas','Makita','GA5030','Estantería A',79.9,'2022-08-22'],
      ['Gato hidráulico 2T','Automoción','Bahco','BH12000','Zona de trabajo',65,'2020-09-30'],
      ['Cortacésped eléctrico','Jardinería','Einhell','GC-EM 1032','Pared norte',119,'2023-04-07'],
      ['Sierra circular','Eléctricas','DeWalt','DWE560','Estantería B',139,'2021-12-01'],
      ['Multímetro digital','Medición','Fluke','117','Armario',189,'2022-03-15'],
      ['Llave dinamométrica','Automoción','Gedore','1/2" 40-200','Cajonera',129,'2023-06-20'],
      ['Taladro de columna','Eléctricas','Einhell','TC-BD 450','Zona de trabajo',199,'2019-10-05'],
      ['Compresor de aire 50L','Neumática','Michelin','MC50','Estantería B',179,'2022-01-28'],
      ['Máscara de soldar automática','Seguridad','Telwin','Aster-X','Armario',59,'2023-03-12'],
      ['Martillo de bola 500g','Manuales','Bellota','—','Cajonera',18.9,'2020-06-14'],
      ['Nivel láser autonivelante','Medición','Bosch','GLL 2-15','Estantería A',109,'2023-09-01'],
      ['Hidrolimpiadora 130 bar','Jardinería','Kärcher','K5','Pared norte',229,'2021-07-19']
    ];
    const ids = [];
    base.forEach(([nombre, categoria, marca, modelo, ubicacion, precio, fechaCompra], i) => {
      const id = TP.uid('h'); ids.push(id);
      TP.dbRun(`INSERT INTO herramientas
        (id,nombre,categoria,marca,modelo,serie,cantidad,precio,fecha_compra,ubicacion,estado,notas,creado)
        VALUES (?,?,?,?,?,'',1,?,?,?,'disponible','',?)`,
        [id, nombre, categoria, marca, modelo, precio, fechaCompra, ubicacion,
         Date.now() - (base.length - i) * 1000]);
    });
    // Amoladora prestada
    TP.dbRun(`INSERT INTO prestamos
      (id,herramienta_id,persona,telefono,fecha_prestamo,fecha_prevista,fecha_devolucion,retraso,notas,activo)
      VALUES (?,?,?,?,?,?,'',0,?,1)`,
      [TP.uid('p'), ids[3], 'Carlos Ruiz', '600 123 456',
       TP.addDays(TP.hoy(), -12), TP.addDays(TP.hoy(), -3), 'Para reforma en su garaje']);
    // Taladro de columna averiado
    TP.dbRun('UPDATE herramientas SET estado = ? WHERE id = ?', ['averiada', ids[9]]);
    TP.dbExec('COMMIT');
    TP.dbRun('INSERT INTO actividad (id,fecha,tipo,texto) VALUES (?,?,?,?)',
      [TP.uid('a'), new Date().toISOString(), 'sistema', 'Base de datos inicializada con datos de ejemplo']);
    TP.persistDB();
  };

  /* ============ Consultas compartidas ============ */
  TP.SQL_HERR_CON_PRESTAMO = `
SELECT h.*,
       p.id             AS p_id,
       p.persona        AS p_persona,
       p.telefono       AS p_telefono,
       p.fecha_prestamo AS p_fecha,
       p.fecha_prevista AS p_fecha_prevista,
       p.notas          AS p_notas
FROM herramientas h
LEFT JOIN prestamos p ON p.herramienta_id = h.id AND p.activo = 1
`;

  TP.mapHerramienta = function (row) {
    if (!row) return null;
    return {
      id: row.id, nombre: row.nombre, categoria: row.categoria,
      marca: row.marca, modelo: row.modelo, serie: row.serie,
      cantidad: row.cantidad, precio: row.precio,
      fechaCompra: row.fecha_compra, ubicacion: row.ubicacion,
      estado: row.estado, notas: row.notas, creado: row.creado,
      prestamo: row.p_id ? {
        id: row.p_id, persona: row.p_persona, telefono: row.p_telefono,
        fecha: row.p_fecha, fechaPrevista: row.p_fecha_prevista, notas: row.p_notas
      } : null
    };
  };

  TP.getH       = id => TP.mapHerramienta(TP.dbGet(TP.SQL_HERR_CON_PRESTAMO + ' WHERE h.id = ?', [id]));
  TP.listH      = () => TP.dbAll(TP.SQL_HERR_CON_PRESTAMO + ' ORDER BY h.nombre COLLATE NOCASE').map(TP.mapHerramienta);
  TP.activos    = () => TP.dbAll(TP.SQL_HERR_CON_PRESTAMO + ' WHERE p.id IS NOT NULL ORDER BY p.fecha_prevista').map(TP.mapHerramienta);
  TP.getCats    = () => TP.dbAll('SELECT nombre FROM categorias ORDER BY nombre COLLATE NOCASE').map(r => r.nombre);
  TP.getUbis    = () => TP.dbAll('SELECT nombre FROM ubicaciones ORDER BY nombre COLLATE NOCASE').map(r => r.nombre);
  TP.getHistPrest = () => TP.dbAll(`
    SELECT p.*, h.nombre AS herramienta
    FROM prestamos p LEFT JOIN herramientas h ON h.id = p.herramienta_id
    WHERE p.activo = 0
    ORDER BY p.fecha_devolucion DESC, p.fecha_prestamo DESC
  `);
  TP.vencidos   = () => TP.activos().filter(h => h.prestamo.fechaPrevista && TP.diasHasta(h.prestamo.fechaPrevista) < 0);

  TP.log = function (tipo, texto) {
    TP.dbRun('INSERT INTO actividad (id, fecha, tipo, texto) VALUES (?,?,?,?)',
      [TP.uid('a'), new Date().toISOString(), tipo, texto]);
    TP.dbRun(`DELETE FROM actividad WHERE id NOT IN (
      SELECT id FROM actividad ORDER BY fecha DESC LIMIT 300)`);
  };

  /* ============ CRUD compartido ============ */
  function formHerramienta(h = {}) {
    const prestada = !!h.prestamo;
    return `
    <div class="form-grid">
      <label class="full">Nombre de la herramienta *
        <input id="f-nombre" value="${TP.esc(h.nombre || '')}" placeholder="Ej: Taladro percutor 18V" maxlength="80">
      </label>
      <label>Categoría
        <input id="f-categoria" list="dl-categorias" value="${TP.esc(h.categoria || '')}" placeholder="Eléctricas">
      </label>
      <label>Ubicación
        <input id="f-ubicacion" list="dl-ubicaciones" value="${TP.esc(h.ubicacion || '')}" placeholder="Estantería A">
      </label>
      <label>Marca
        <input id="f-marca" value="${TP.esc(h.marca || '')}" placeholder="Bosch">
      </label>
      <label>Modelo
        <input id="f-modelo" value="${TP.esc(h.modelo || '')}" placeholder="GSB 18V-55">
      </label>
      <label>Nº de serie / referencia
        <input id="f-serie" value="${TP.esc(h.serie || '')}" placeholder="Opcional">
      </label>
      <label>Cantidad
        <input id="f-cantidad" type="number" min="1" step="1" value="${TP.esc(h.cantidad || 1)}">
      </label>
      <label>Precio de compra (€)
        <input id="f-precio" type="number" min="0" step="0.01"
          value="${h.precio != null && h.precio !== '' ? TP.esc(h.precio) : ''}" placeholder="0.00">
      </label>
      <label>Fecha de compra
        <input id="f-fechaCompra" type="date" value="${TP.esc(h.fechaCompra || '')}">
      </label>
      <label>Estado
        <select id="f-estado" ${prestada ? 'disabled' : ''}>
          <option value="disponible" ${(!prestada && (h.estado || 'disponible') === 'disponible') ? 'selected' : ''}>Disponible</option>
          <option value="averiada" ${(!prestada && h.estado === 'averiada') ? 'selected' : ''}>Averiada</option>
          ${prestada ? '<option value="prestada" selected>Prestada</option>' : ''}
        </select>
        ${prestada ? '<span class="hint">Prestada a ' + TP.esc(h.prestamo.persona) + ' — devuélvela para cambiar el estado</span>' : ''}
      </label>
      <label class="full">Notas
        <textarea id="f-notas" rows="3" placeholder="Accesorios, observaciones, ubicación exacta...">${TP.esc(h.notas || '')}</textarea>
      </label>
    </div>`;
  }

  function leerFormulario(h) {
    const nombre = $('#f-nombre').value.trim();
    if (!nombre) { TP.toast('El nombre es obligatorio', 'err'); return null; }
    const cat = ($('#f-categoria').value.trim()) || 'Otros';
    const ubi = $('#f-ubicacion').value.trim();
    TP.dbRun('INSERT OR IGNORE INTO categorias (nombre) VALUES (?)', [cat]);
    if (ubi) TP.dbRun('INSERT OR IGNORE INTO ubicaciones (nombre) VALUES (?)', [ubi]);
    return {
      nombre, categoria: cat,
      marca: $('#f-marca').value.trim(),
      modelo: $('#f-modelo').value.trim(),
      serie: $('#f-serie').value.trim(),
      cantidad: Math.max(1, parseInt($('#f-cantidad').value) || 1),
      precio: TP.num($('#f-precio').value),
      fechaCompra: $('#f-fechaCompra').value,
      ubicacion: ubi,
      estado: h.prestamo ? h.estado : $('#f-estado').value,
      notas: $('#f-notas').value.trim()
    };
  }

  TP.nuevaHerramienta = function () {
    TP.showModal({
      title: 'Nueva herramienta',
      body: formHerramienta({ cantidad: 1, estado: 'disponible' }),
      saveText: 'Añadir al inventario',
      onSave: () => {
        const d = leerFormulario({});
        if (!d) return false;
        TP.dbRun(`INSERT INTO herramientas
          (id,nombre,categoria,marca,modelo,serie,cantidad,precio,fecha_compra,ubicacion,estado,notas,creado)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [TP.uid('h'), d.nombre, d.categoria, d.marca, d.modelo, d.serie,
           d.cantidad, d.precio, d.fechaCompra, d.ubicacion, d.estado, d.notas, Date.now()]);
        TP.log('alta', `Añadida «${d.nombre}» al inventario`);
        TP.refresh(); TP.toast('Herramienta añadida');
      }
    });
  };

  TP.editarHerramienta = function (id) {
    const h = TP.getH(id); if (!h) return;
    TP.showModal({
      title: 'Editar herramienta',
      body: formHerramienta(h),
      saveText: 'Guardar cambios',
      onSave: () => {
        const d = leerFormulario(h);
        if (!d) return false;
        TP.dbRun(`UPDATE herramientas SET
          nombre=?, categoria=?, marca=?, modelo=?, serie=?, cantidad=?, precio=?,
          fecha_compra=?, ubicacion=?, estado=?, notas=? WHERE id=?`,
          [d.nombre, d.categoria, d.marca, d.modelo, d.serie, d.cantidad, d.precio,
           d.fechaCompra, d.ubicacion, d.estado, d.notas, id]);
        TP.log('edicion', `Editada «${d.nombre}»`);
        TP.refresh(); TP.toast('Cambios guardados');
      }
    });
  };

  TP.eliminarHerramienta = function (id) {
    const h = TP.getH(id); if (!h) return;
    TP.showModal({
      title: 'Eliminar herramienta',
      body: `<p style="font-size:14.5px;line-height:1.6">¿Seguro que quieres eliminar <b>${TP.esc(h.nombre)}</b> del inventario?</p>
             <p style="margin-top:10px;color:var(--text-2);font-size:13px">También se eliminarán sus préstamos e historial asociado. Esta acción no se puede deshacer.</p>
             ${h.prestamo ? '<div class="alert alert-w" style="margin-top:14px"><span>⚠️</span><div>Esta herramienta está actualmente prestada a <b>' + TP.esc(h.prestamo.persona) + '</b>.</div></div>' : ''}`,
      saveText: 'Sí, eliminar',
      onSave: () => {
        TP.dbRun('DELETE FROM herramientas WHERE id = ?', [id]);
        TP.log('baja', `Eliminada «${h.nombre}»`);
        TP.refresh(); TP.toast('Herramienta eliminada');
      }
    });
  };

  TP.verDetalle = function (id) {
    const h = TP.getH(id); if (!h) return;
    const est = h.prestamo ? 'prestada' : (h.estado === 'averiada' ? 'averiada' : 'disponible');
    const historial = TP.dbAll(`
      SELECT * FROM prestamos WHERE herramienta_id = ? AND activo = 0
      ORDER BY fecha_devolucion DESC, fecha_prestamo DESC`, [id]);

    const fila = (k, v) => `<div style="background:var(--surface-2);padding:9px 12px;border-radius:9px">
      <div style="font-size:11px;color:var(--text-2);font-weight:600;text-transform:uppercase;letter-spacing:.4px">${TP.esc(k)}</div>
      <div style="font-weight:600;margin-top:2px">${TP.esc(v)}</div></div>`;

    const body = `
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:18px">
        <div class="tool-ico" style="width:54px;height:54px;font-size:26px">${TP.iconoCat(h.categoria)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:17px;font-weight:700;letter-spacing:-.3px">${TP.esc(h.nombre)}</div>
          <div style="color:var(--text-2);font-size:13px">${[h.marca, h.modelo].filter(Boolean).map(TP.esc).join(' · ') || TP.esc(h.categoria)}</div>
        </div>
        <span class="badge-est ${TP.ESTADOS[est].cls}">${TP.ESTADOS[est].label}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;font-size:13.5px">
        ${fila('Categoría', h.categoria)}
        ${fila('Ubicación', h.ubicacion || '—')}
        ${fila('Nº de serie', h.serie || '—')}
        ${fila('Cantidad', h.cantidad || 1)}
        ${fila('Precio', TP.num(h.precio) ? TP.fmtMoney(h.precio) : '—')}
        ${fila('Fecha de compra', h.fechaCompra ? TP.fmtFecha(h.fechaCompra) : '—')}
      </div>
      ${h.notas ? `<div style="margin-top:15px;padding:12px 14px;background:var(--surface-2);border-radius:10px;font-size:13px;color:var(--text-2)">${TP.esc(h.notas)}</div>` : ''}
      ${h.prestamo ? `
        <div class="section-title" style="font-size:13.5px;margin-top:20px">🤝 Préstamo activo</div>
        <div style="background:var(--info-soft);color:var(--info);padding:13px 15px;border-radius:10px;font-size:13px;line-height:1.7">
          <b>${TP.esc(h.prestamo.persona)}</b>${h.prestamo.telefono ? ' · ' + TP.esc(h.prestamo.telefono) : ''}<br>
          Prestada el ${TP.fmtFecha(h.prestamo.fecha)} · Devolución prevista: ${TP.fmtFecha(h.prestamo.fechaPrevista)}
          ${h.prestamo.notas ? '<br><i>' + TP.esc(h.prestamo.notas) + '</i>' : ''}
        </div>` : ''}
      <div class="section-title" style="font-size:13.5px;margin-top:20px">📜 Historial de préstamos (${historial.length})</div>
      ${historial.length ? historial.map(p => `
        <div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:13px">
          <div style="display:flex;justify-content:space-between;gap:10px">
            <b>${TP.esc(p.persona)}</b>
            <span style="color:var(--text-2);font-size:12.5px">Devuelto: ${TP.fmtFecha(p.fecha_devolucion)}</span>
          </div>
          <div style="color:var(--text-2);margin-top:2px">Prestado ${TP.fmtFecha(p.fecha_prestamo)}${p.fecha_prevista ? ' → Previsto ' + TP.fmtFecha(p.fecha_prevista) : ''}${p.retraso ? ' · <span style="color:var(--danger)">' + p.retraso + ' días de retraso</span>' : ''}</div>
          ${p.notas ? `<div style="color:var(--text-2);font-style:italic;margin-top:2px">${TP.esc(p.notas)}</div>` : ''}
        </div>`).join('') : '<p style="color:var(--text-2);font-size:13px">Sin préstamos registrados</p>'}
    `;
    TP.showModal({
      title: 'Detalle de herramienta', body, saveText: 'Editar',
      onSave: () => { setTimeout(() => TP.editarHerramienta(id), 50); return true; }
    });
  };

  TP.prestar = function (id) {
    const h = TP.getH(id); if (!h) return;
    if (h.prestamo) { TP.toast('Ya está prestada', 'err'); return; }
    TP.showModal({
      title: 'Prestar: ' + h.nombre,
      body: `
        <div class="form-grid">
          <label class="full">Persona que lo lleva *
            <input id="p-persona" placeholder="Nombre y apellidos" maxlength="60">
          </label>
          <label>Teléfono de contacto
            <input id="p-tel" placeholder="Opcional">
          </label>
          <label>Fecha de devolución prevista
            <input id="p-fecha" type="date" value="${TP.addDays(TP.hoy(), 7)}">
          </label>
          <label class="full">Notas
            <textarea id="p-notas" rows="2" placeholder="Para qué lo necesita, en qué estado se lleva..."></textarea>
          </label>
        </div>`,
      saveText: 'Registrar préstamo',
      onSave: () => {
        const persona = $('#p-persona').value.trim();
        if (!persona) { TP.toast('Indica el nombre de la persona', 'err'); return false; }
        TP.dbRun(`INSERT INTO prestamos
          (id, herramienta_id, persona, telefono, fecha_prestamo, fecha_prevista, fecha_devolucion, retraso, notas, activo)
          VALUES (?,?,?,?,?,?,'',0,?,1)`,
          [TP.uid('p'), id, persona, $('#p-tel').value.trim(), TP.hoy(),
           $('#p-fecha').value || TP.addDays(TP.hoy(), 7), $('#p-notas').value.trim()]);
        TP.log('prestamo', `«${h.nombre}» prestada a ${persona}`);
        TP.refresh(); TP.toast('Préstamo registrado');
      }
    });
  };

  TP.devolver = function (id) {
    const h = TP.getH(id); if (!h || !h.prestamo) return;
    const p = h.prestamo;
    const retraso = p.fechaPrevista ? TP.diasHasta(p.fechaPrevista) : 0;
    TP.showModal({
      title: 'Devolver herramienta',
      body: `
        <p style="font-size:14.5px;margin-bottom:14px">Registrar la devolución de <b>${TP.esc(h.nombre)}</b> por parte de <b>${TP.esc(p.persona)}</b>.</p>
        ${retraso < 0 ? `<div class="alert alert-d"><span>⏰</span><div>Devolución con <b>${Math.abs(retraso)} días</b> de retraso respecto a la fecha prevista.</div></div>` : ''}
        <div class="form-grid">
          <label class="full">Estado en que se devuelve
            <select id="d-estado">
              <option value="disponible">Correcto — disponible</option>
              <option value="averiada">Averiada</option>
            </select>
          </label>
          <label class="full">Observaciones
            <textarea id="d-notas" rows="2" placeholder="Opcional"></textarea>
          </label>
        </div>`,
      saveText: 'Confirmar devolución',
      onSave: () => {
        const nuevoEstado = $('#d-estado').value;
        const obs = $('#d-notas').value.trim();
        TP.dbRun(`UPDATE prestamos SET activo = 0, fecha_devolucion = ?, retraso = ?,
          notas = CASE WHEN ? <> '' THEN ? ELSE notas END WHERE id = ?`,
          [TP.hoy(), retraso < 0 ? Math.abs(retraso) : 0, obs, obs, p.id]);
        TP.dbRun('UPDATE herramientas SET estado = ? WHERE id = ?', [nuevoEstado, id]);
        TP.log('devolucion', `«${h.nombre}» devuelta por ${p.persona}${obs ? ' — ' + obs : ''}`);
        TP.refresh(); TP.toast('Devolución registrada');
      }
    });
  };

  /* ============ Shell (sidebar + topbar + view) ============ */
  TP.navItems = [
    { id: 'dashboard',    href: 'index.html',        icon: '📊', label: 'Panel' },
    { id: 'herramientas', href: 'herramientas.html', icon: '🔧', label: 'Herramientas' },
    { id: 'prestamos',    href: 'prestamos.html',    icon: '🤝', label: 'Préstamos', badge: true },
    { id: 'ubicaciones',  href: 'ubicaciones.html',  icon: '📍', label: 'Ubicaciones' },
    { id: 'ajustes',      href: 'ajustes.html',      icon: '⚙️', label: 'Ajustes' }
  ];

  TP.renderShell = function () {
    const navId = TP.navId || '';
    const venc = TP.vencidos().length;

    const navHtml = TP.navItems.map(item => `
      <a class="nav-item ${item.id === navId ? 'active' : ''}" href="${item.href}">
        <span class="ico">${item.icon}</span>${item.label}
        ${item.badge && venc ? `<span class="badge">${venc}</span>` : ''}
      </a>`).join('');

    $('#app').innerHTML = `
      <div class="app">
        <aside class="sidebar" id="sidebar">
          <div class="brand">
            <div class="brand-icon">🛠️</div>
            <div style="min-width:0">
              <h1>TallerPro</h1>
              <p>${TP.esc(TP.ajustes.taller || 'Mi Taller')}</p>
            </div>
          </div>
          <nav class="nav">${navHtml}</nav>
          <div class="sidebar-footer">
            TallerPro · v2.0<br>
            <span class="db-badge">SQLite activo</span>
          </div>
        </aside>
        <div class="backdrop" id="backdrop"></div>
        <main class="main">
          <header class="topbar">
            <button class="hamburger" id="hamburger">☰</button>
            <div>
              <h2>${TP.esc(TP.pageTitle || '')}</h2>
              <div class="sub">${TP.esc(TP.pageSub || '')}</div>
            </div>
            <div class="topbar-actions">
              <button class="btn btn-ghost btn-sm" id="btnTheme">${TP.ajustes.tema === 'oscuro' ? '☀️' : '🌙'}</button>
              <button class="btn btn-primary" id="btnNueva">＋ Nueva herramienta</button>
            </div>
          </header>
          <div class="view" id="view"></div>
        </main>
      </div>`;

    document.documentElement.dataset.theme = TP.ajustes.tema;

    $('#btnTheme').onclick = () => TP.setTema(TP.ajustes.tema === 'oscuro' ? 'claro' : 'oscuro');
    $('#btnNueva').onclick = () => TP.nuevaHerramienta();
    $('#hamburger').onclick = () => {
      $('#sidebar').classList.toggle('open');
      $('#backdrop').classList.toggle('open');
    };
    $('#backdrop').onclick = () => {
      $('#sidebar').classList.remove('open');
      $('#backdrop').classList.remove('open');
    };
  };

  /* ============ Refresh + Boot ============ */
  TP.onReady = null; // cada página lo sobreescribe
  TP.refresh = function () {
    TP.renderShell();
    if (typeof TP.onReady === 'function') TP.onReady();
  };

  TP.boot = async function () {
    try {
      $('#loaderMsg').textContent = 'Inicializando motor SQLite…';
      await TP.initDB();
      wireModal();
      TP.refresh();
      $('#loader').style.display = 'none';
      window.addEventListener('beforeunload', () => { try { TP.persistDB(); } catch {} });
    } catch (err) {
      console.error(err);
      $('#loader').classList.add('err');
      $('#loaderTitle').textContent = 'Error al iniciar SQLite';
      $('#loaderMsg').innerHTML = TP.esc(err.message) +
        '<br><br>Esta aplicación necesita conexión a internet la primera vez para descargar <b>sql.js</b> desde el CDN.' +
        '<br><br><button class="btn btn-primary" onclick="location.reload()" style="margin-top:8px">Reintentar</button>';
    }
  };

  /* ============ Descargas ============ */
  TP.descargar = function (nombre, contenido, tipo) {
    const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
})();