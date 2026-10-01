/* ============================================================
   Página: Ajustes (identidad, tema, export/import, reset)
   ============================================================ */
TP.pageTitle = 'Ajustes';
TP.pageSub   = 'Configuración y datos';
TP.navId     = 'ajustes';

function statMini(k, v) {
  return `<div style="background:var(--surface-2);padding:10px 12px;border-radius:9px">
    <div style="font-size:11.5px;color:var(--text-2);font-weight:600">${TP.esc(k)}</div>
    <div style="font-size:18px;font-weight:700;margin-top:2px">${v}</div>
  </div>`;
}

TP.onReady = function () {
  const tam = (() => {
    try { return ((localStorage.getItem(TP.LS_DATA) || '').length / 1024).toFixed(1); }
    catch { return '—'; }
  })();

  const stats = {
    refs:  TP.dbGet('SELECT COUNT(*) AS c FROM herramientas').c,
    unds:  TP.dbGet('SELECT COALESCE(SUM(cantidad),0) AS c FROM herramientas').c,
    cats:  TP.dbGet('SELECT COUNT(*) AS c FROM categorias').c,
    ubis:  TP.dbGet('SELECT COUNT(*) AS c FROM ubicaciones').c,
    prest: TP.dbGet('SELECT COUNT(*) AS c FROM prestamos').c,
    act:   TP.dbGet('SELECT COUNT(*) AS c FROM actividad').c
  };

  const $v = TP.$('#view');
  $v.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:16px;max-width:1000px">

      <div class="card card-pad">
        <div class="card-title">🏠 Identidad del taller</div>
        <div class="form-grid">
          <label class="full">Nombre del taller
            <input id="a-taller" value="${TP.esc(TP.ajustes.taller)}" placeholder="Mi Taller">
          </label>
        </div>
        <button class="btn btn-primary" style="margin-top:14px" onclick="TP.guardarAjustes()">Guardar</button>
      </div>

      <div class="card card-pad">
        <div class="card-title">🎨 Apariencia</div>
        <p style="font-size:13.5px;color:var(--text-2);margin-bottom:12px">Elige el tema de la interfaz.</p>
        <div style="display:flex;gap:9px">
          <button class="btn ${TP.ajustes.tema === 'claro' ? 'btn-primary' : 'btn-ghost'}" onclick="TP.setTema('claro')">☀️ Claro</button>
          <button class="btn ${TP.ajustes.tema === 'oscuro' ? 'btn-primary' : 'btn-ghost'}" onclick="TP.setTema('oscuro')">🌙 Oscuro</button>
        </div>
      </div>

      <div class="card card-pad">
        <div class="card-title">🗄️ Base de datos SQLite</div>
        <p style="font-size:13.5px;color:var(--text-2);margin-bottom:14px">
          Motor <b>sql.js</b> (SQLite compilado a WebAssembly). Los datos se persisten en este navegador (${tam} KB en localStorage).
        </p>
        <div style="display:flex;gap:9px;flex-wrap:wrap;margin-bottom:14px">
          <button class="btn btn-primary" onclick="TP.exportarSQLite()">⬇️ Exportar .sqlite</button>
          <button class="btn btn-ghost" onclick="TP.exportarSQL()">📄 Exportar SQL (dump)</button>
        </div>
        <div style="display:flex;gap:9px;flex-wrap:wrap">
          <button class="btn btn-ghost" onclick="TP.exportarCSV()">📊 Exportar CSV</button>
          <button class="btn btn-ghost" onclick="TP.$('#inputImport').click()">⬆️ Importar .sqlite</button>
        </div>
        <input type="file" id="inputImport" accept=".sqlite,.db,.sqlite3,application/octet-stream" style="display:none">
        <p style="font-size:12px;color:var(--text-2);margin-top:12px">Al importar se reemplazará la base de datos actual.</p>
      </div>

      <div class="card card-pad">
        <div class="card-title">📈 Estadísticas</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13.5px">
          ${statMini('Referencias', stats.refs)}
          ${statMini('Unidades', stats.unds)}
          ${statMini('Categorías', stats.cats)}
          ${statMini('Ubicaciones', stats.ubis)}
          ${statMini('Préstamos totales', stats.prest)}
          ${statMini('Eventos de actividad', stats.act)}
        </div>
      </div>

      <div class="card card-pad" style="border-color:var(--danger)">
        <div class="card-title" style="color:var(--danger)">⚠️ Zona peligrosa</div>
        <p style="font-size:13.5px;color:var(--text-2);margin-bottom:14px">
          Estas acciones no se pueden deshacer. Asegúrate de tener una copia de seguridad.
        </p>
        <div style="display:flex;gap:9px;flex-wrap:wrap">
          <button class="btn btn-ghost" onclick="TP.cargarDemo()">🔄 Cargar datos de ejemplo</button>
          <button class="btn btn-danger" onclick="TP.borrarTodo()">🗑️ Borrar todos los datos</button>
        </div>
      </div>

    </div>`;

  TP.$('#inputImport').onchange = TP.importarSQLite;
};

TP.guardarAjustes = function () {
  TP.ajustes.taller = TP.$('#a-taller').value.trim() || 'Mi Taller';
  TP.saveCfg();
  TP.refresh();
  TP.toast('Ajustes guardados');
};

TP.exportarSQLite = function () {
  const data = TP.db.export();
  TP.descargar(`tallerpro_${TP.hoy()}.sqlite`, new Blob([data], { type: 'application/x-sqlite3' }));
  TP.toast('Base de datos exportada');
};

TP.exportarSQL = function () {
  const tablas = ['categorias','ubicaciones','herramientas','prestamos','actividad'];
  let out = '-- TallerPro SQL dump\n-- ' + new Date().toISOString() + '\n\n';
  out += TP.SCHEMA.replace(/CREATE INDEX[^;]+;/g, '').trim() + '\n\n';
  tablas.forEach(t => {
    const rows = TP.dbAll(`SELECT * FROM ${t}`);
    if (!rows.length) return;
    out += `-- Datos de ${t}\n`;
    rows.forEach(r => {
      const cols = Object.keys(r);
      const vals = cols.map(c => {
        const v = r[c];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number') return String(v);
        return "'" + String(v).replace(/'/g, "''") + "'";
      });
      out += `INSERT INTO ${t} (${cols.join(',')}) VALUES (${vals.join(',')});\n`;
    });
    out += '\n';
  });
  TP.descargar(`tallerpro_${TP.hoy()}.sql`, out, 'application/sql');
  TP.toast('Dump SQL exportado');
};

TP.exportarCSV = function () {
  const rows = TP.dbAll(TP.SQL_HERR_CON_PRESTAMO + ' ORDER BY h.nombre COLLATE NOCASE');
  const cab = ['Nombre','Categoría','Marca','Modelo','Nº Serie','Cantidad','Precio','Fecha compra','Ubicación','Estado','Prestada a','Devolución prevista','Notas'];
  const filas = rows.map(r => {
    const m = TP.mapHerramienta(r);
    const est = m.prestamo ? 'prestada' : (m.estado === 'averiada' ? 'averiada' : 'disponible');
    return [m.nombre, m.categoria, m.marca, m.modelo, m.serie, m.cantidad, m.precio, m.fechaCompra,
            m.ubicacion, est, m.prestamo ? m.prestamo.persona : '',
            m.prestamo ? m.prestamo.fechaPrevista : '', m.notas];
  });
  const csv = [cab, ...filas].map(f => f.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  TP.descargar(`inventario_${TP.hoy()}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
  TP.toast('CSV exportado');
};

TP.importarSQLite = function (e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const u8 = new Uint8Array(ev.target.result);
      const cab = new TextDecoder().decode(u8.slice(0, 15));
      if (!cab.startsWith('SQLite format 3')) throw new Error('No es un archivo SQLite válido');
      TP.showModal({
        title: 'Confirmar importación',
        body: `<p style="font-size:14.5px">Se reemplazará toda la base de datos actual por el archivo <b>${TP.esc(file.name)}</b>.</p>
               <div class="alert alert-w" style="margin-top:12px"><span>⚠️</span><div>Esta acción no se puede deshacer.</div></div>`,
        saveText: 'Importar y reemplazar',
        onSave: () => {
          const SQLmod = window.initSqlJs;
          const SQL = window.SQL || null;
          // Creamos la nueva BD sobre el motor ya cargado
          const nuevo = new (TP.db.constructor)(u8);
          TP.db.close();
          TP.db = nuevo;
          nuevo.exec(TP.SCHEMA);
          TP.persistDB();
          TP.refresh();
          TP.toast('Base de datos importada correctamente');
        }
      });
    } catch (err) {
      TP.toast('Error al importar: ' + err.message, 'err');
    }
    e.target.value = '';
  };
  reader.readAsArrayBuffer(file);
};

TP.cargarDemo = function () {
  TP.showModal({
    title: 'Cargar datos de ejemplo',
    body: `<p style="font-size:14.5px">Se reemplazará todo el contenido actual por un inventario de ejemplo de 15 herramientas.</p>
           <div class="alert alert-w" style="margin-top:12px"><span>⚠️</span><div>Esta acción no se puede deshacer.</div></div>`,
    saveText: 'Cargar ejemplo',
    onSave: () => {
      TP.db.exec(`
        DROP TABLE IF EXISTS prestamos;
        DROP TABLE IF EXISTS herramientas;
        DROP TABLE IF EXISTS categorias;
        DROP TABLE IF EXISTS ubicaciones;
        DROP TABLE IF EXISTS actividad;`);
      TP.db.exec(TP.SCHEMA);
      TP.seedIfEmpty();
      TP.refresh();
      TP.toast('Datos de ejemplo cargados');
    }
  });
};

TP.borrarTodo = function () {
  TP.showModal({
    title: 'Borrar todos los datos',
    body: `<p style="font-size:14.5px">¿Seguro que quieres borrar <b>todo</b> el inventario, préstamos e historial?</p>
           <div class="alert alert-d" style="margin-top:12px"><span>⚠️</span><div>Esta acción es irreversible. Exporta antes una copia si la necesitas.</div></div>`,
    saveText: 'Sí, borrar todo',
    onSave: () => {
      TP.db.exec(`
        DELETE FROM prestamos;
        DELETE FROM herramientas;
        DELETE FROM actividad;
        DELETE FROM ubicaciones;
        DELETE FROM categorias;`);
      ['Manuales','Eléctricas','Medición','Automoción','Jardinería','Fijación',
       'Seguridad','Soldadura','Neumática','Pintura','Otros']
        .forEach(c => TP.dbRun('INSERT INTO categorias (nombre) VALUES (?)', [c]));
      TP.persistDB();
      TP.refresh();
      TP.toast('Todos los datos han sido borrados');
    }
  });
};

TP.boot();