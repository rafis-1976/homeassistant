/* ============================================================
   Página: Ajustes — datos desde Supabase
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

TP.onReady = async function () {
  const $v = TP.$('#view');
  $v.innerHTML = '<p style="color:var(--text-2);padding:20px">Cargando…</p>';

  try {
    const [
      { count: nRefs },
      { data: herrs },
      { count: nCats },
      { count: nUbis },
      { count: nPrest },
      { count: nAct }
    ] = await Promise.all([
      TP.sb.from('taller_herramientas').select('*', { count: 'exact', head: true }),
      TP.sb.from('taller_herramientas').select('cantidad'),
      TP.sb.from('taller_categorias').select('*', { count: 'exact', head: true }),
      TP.sb.from('taller_ubicaciones').select('*', { count: 'exact', head: true }),
      TP.sb.from('taller_prestamos').select('*', { count: 'exact', head: true }),
      TP.sb.from('taller_actividad').select('*', { count: 'exact', head: true })
    ]);

    const nUnds = (herrs || []).reduce((s, h) => s + (h.cantidad || 0), 0);

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
          <div class="card-title">🗄️ Conexión Supabase</div>
          <p style="font-size:13.5px;color:var(--text-2);margin-bottom:14px">
            Los datos se guardan en tu proyecto <b>Supabase</b> (PostgreSQL en la nube). Accesibles desde cualquier dispositivo.
          </p>
          <div style="display:flex;gap:9px;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="TP.exportarCSV()">📊 Exportar CSV</button>
            <button class="btn btn-ghost" onclick="TP.recargarDatos()">🔄 Recargar datos</button>
          </div>
        </div>

        <div class="card card-pad">
          <div class="card-title">📈 Estadísticas (en vivo desde Supabase)</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13.5px">
            ${statMini('Referencias', nRefs || 0)}
            ${statMini('Unidades', nUnds)}
            ${statMini('Categorías', nCats || 0)}
            ${statMini('Ubicaciones', nUbis || 0)}
            ${statMini('Préstamos totales', nPrest || 0)}
            ${statMini('Eventos de actividad', nAct || 0)}
          </div>
        </div>

        <div class="card card-pad" style="border-color:var(--danger)">
          <div class="card-title" style="color:var(--danger)">⚠️ Zona peligrosa</div>
          <p style="font-size:13.5px;color:var(--text-2);margin-bottom:14px">
            Estas acciones afectan directamente a la base de datos de Supabase y no se pueden deshacer.
          </p>
          <div style="display:flex;gap:9px;flex-wrap:wrap">
            <button class="btn btn-ghost" onclick="TP.borrarActividad()">🧹 Borrar historial de actividad</button>
            <button class="btn btn-danger" onclick="TP.borrarTodo()">🗑️ Borrar TODOS los datos</button>
          </div>
        </div>

      </div>`;
  } catch (err) {
    console.error(err);
    $v.innerHTML = `<div class="empty"><div class="em">⚠️</div><h3>Error al cargar</h3><p>${TP.esc(err.message)}</p></div>`;
  }
};

TP.guardarAjustes = function () {
  TP.ajustes.taller = TP.$('#a-taller').value.trim() || 'Mi Taller';
  TP.saveCfg();
  TP.renderShell();
  TP.toast('Ajustes guardados');
};

TP.recargarDatos = async function () {
  await TP.onReady();
  TP.toast('Datos recargados');
};

TP.exportarCSV = async function () {
  const { data } = await TP.sb.from('taller_herramientas').select('*').order('nombre');
  const cab = ['Nombre','Categoría','Marca','Modelo','Nº Serie','Cantidad','Precio','Fecha compra','Ubicación','Estado','Notas'];
  const filas = (data || []).map(h => [
    h.nombre, h.categoria, h.marca, h.modelo, h.serie, h.cantidad,
    h.precio, h.fecha_compra, h.ubicacion, h.estado, h.notas
  ]);
  const csv = [cab, ...filas].map(f =>
    f.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')
  ).join('\r\n');
  TP.descargar(`inventario_${TP.hoy()}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
  TP.toast('CSV exportado');
};

TP.borrarActividad = function () {
  TP.showModal({
    title: 'Borrar historial de actividad',
    body: `<p style="font-size:14.5px">¿Borrar todo el historial de actividad (log)? No afecta a las herramientas ni a los préstamos.</p>`,
    saveText: 'Borrar actividad',
    onSave: async () => {
      await TP.sb.from('taller_actividad').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await TP.onReady();
      TP.toast('Actividad borrada');
    }
  });
};

TP.borrarTodo = function () {
  TP.showModal({
    title: 'Borrar TODOS los datos',
    body: `<p style="font-size:14.5px">¿Seguro que quieres borrar <b>todo</b> el inventario, préstamos y actividad de Supabase?</p>
           <div class="alert alert-d" style="margin-top:12px"><span>⚠️</span><div>Esta acción es irreversible. Asegúrate de tener una copia de seguridad (exporta antes el CSV).</div></div>`,
    saveText: 'Sí, borrar todo',
    onSave: async () => {
      await TP.sb.from('taller_prestamos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await TP.sb.from('taller_herramientas').delete().neq('id', '__none__');
      await TP.sb.from('taller_actividad').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await TP.onReady();
      TP.toast('Todos los datos han sido borrados');
    }
  });
};

TP.boot();