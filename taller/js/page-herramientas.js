/* ============================================================
   Página: Herramientas — datos desde Supabase
   ============================================================ */
TP.pageTitle = 'Herramientas';
TP.pageSub   = 'Inventario completo';
TP.navId     = 'herramientas';

let filtros = { q: '', cat: '', est: '', ubi: '', orden: 'nombre' };
let cacheHerrs = [];   // caché en memoria de la última consulta

function cardHerramienta(h) {
  const est  = h.prestamo ? 'prestada' : (h.estado === 'averiada' ? 'averiada' : 'disponible');
  const venc = h.prestamo && h.prestamo.fechaPrevista && TP.diasHasta(h.prestamo.fechaPrevista) < 0;
  return `
  <div class="tool">
    <div class="tool-top">
      <div class="tool-ico">${TP.iconoCat(h.categoria)}</div>
      <div style="flex:1;min-width:0">
        <div class="tool-name">${TP.esc(h.nombre)}</div>
        <div class="tool-meta">${[h.marca, h.modelo].filter(Boolean).map(TP.esc).join(' · ') || TP.esc(h.categoria)}</div>
      </div>
    </div>
    <div class="tool-body">
      <span class="badge-est ${TP.ESTADOS[est].cls}">${TP.ESTADOS[est].label}</span>
      ${h.ubicacion ? `<span class="chip">📍 ${TP.esc(h.ubicacion)}</span>` : ''}
      ${(h.cantidad || 1) > 1 ? `<span class="chip">×${h.cantidad}</span>` : ''}
      ${h.precio > 0 ? `<span class="chip">${TP.fmtMoney(h.precio)}</span>` : ''}
    </div>
    ${h.prestamo ? `
      <div style="background:var(--info-soft);color:var(--info);padding:9px 12px;border-radius:9px;font-size:12.5px">
        <b>${TP.esc(h.prestamo.persona)}</b>${h.prestamo.telefono ? ' · ' + TP.esc(h.prestamo.telefono) : ''}<br>
        <span style="${venc ? 'color:var(--danger);font-weight:700' : ''}">
          Devolución: ${TP.fmtFecha(h.prestamo.fechaPrevista)}${venc ? ` (${Math.abs(TP.diasHasta(h.prestamo.fechaPrevista))}d de retraso)` : ''}
        </span>
      </div>` : ''}
    ${h.notas ? `<div style="font-size:12.5px;color:var(--text-2);font-style:italic">${TP.esc(h.notas)}</div>` : ''}
    <div class="tool-actions">
      ${h.prestamo
        ? `<button class="btn btn-sm btn-success" onclick="TP.devolver('${h.id}')">↩️ Devolver</button>`
        : `<button class="btn btn-sm btn-primary" onclick="TP.prestar('${h.id}')">🤝 Prestar</button>`}
      <button class="btn btn-sm btn-ghost" onclick="TP.editarHerramienta('${h.id}')">✏️ Editar</button>
      <button class="btn btn-sm btn-ghost" onclick="TP.verDetalle('${h.id}')" title="Detalle">ℹ️</button>
      <button class="btn btn-sm btn-ghost" onclick="TP.eliminarHerramienta('${h.id}')" title="Eliminar" style="color:var(--danger)">🗑️</button>
    </div>
  </div>`;
}

function aplicarFiltros(lista) {
  let out = lista.slice();
  const q = filtros.q.trim().toLowerCase();
  if (q) {
    out = out.filter(h =>
      `${h.nombre} ${h.marca} ${h.modelo} ${h.serie} ${h.notas}`.toLowerCase().includes(q)
    );
  }
  if (filtros.cat) out = out.filter(h => h.categoria === filtros.cat);
  if (filtros.ubi) out = out.filter(h => h.ubicacion === filtros.ubi);
  if (filtros.est) {
    out = out.filter(h => {
      const est = h.prestamo ? 'prestada' : h.estado;
      return est === filtros.est;
    });
  }
  const cmp = {
    nombre:   (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
    reciente: (a, b) => (b.creado || '') > (a.creado || '') ? 1 : -1,
    precio:   (a, b) => (b.precio || 0) - (a.precio || 0),
    categoria:(a, b) => a.categoria.localeCompare(b.categoria, 'es') || a.nombre.localeCompare(b.nombre, 'es')
  };
  out.sort(cmp[filtros.orden] || cmp.nombre);
  return out;
}

function renderListaHerramientas() {
  const cont = TP.$('#lista-herr');
  if (!cont) return;
  const list = aplicarFiltros(cacheHerrs);
  const totalReg = cacheHerrs.length;

  if (!list.length) {
    cont.innerHTML = totalReg
      ? `<div class="empty"><div class="em">🔍</div><h3>Sin resultados</h3><p>No hay herramientas que coincidan con los filtros aplicados.</p></div>`
      : `<div class="empty"><div class="em">🧰</div><h3>Tu taller está vacío</h3><p>Añade tu primera herramienta para empezar a controlar tu inventario y préstamos.</p><button class="btn btn-primary" onclick="TP.nuevaHerramienta()">＋ Añadir herramienta</button></div>`;
    return;
  }
  cont.innerHTML = `<div class="grid">${list.map(cardHerramienta).join('')}</div>`;

  // Contador
  const cnt = TP.$('#contador-herr');
  if (cnt) cnt.textContent = `${list.length} de ${totalReg}`;
}

TP.onReady = async function () {
  const $v = TP.$('#view');
  $v.innerHTML = '<p style="color:var(--text-2);padding:20px">Cargando herramientas…</p>';

  try {
    // 1. Cargar herramientas + préstamos activos + categorías + ubicaciones en paralelo
    const [
      { data: herrs, error: e1 },
      { data: prestamos },
      cats,
      ubis
    ] = await Promise.all([
      TP.sb.from('taller_herramientas').select('*'),
      TP.sb.from('taller_prestamos').select('*').eq('activo', true),
      TP.getCats(),
      TP.getUbis()
    ]);
    if (e1) throw e1;

    // 2. Adjuntar préstamo activo a cada herramienta
    const prestMap = {};
    (prestamos || []).forEach(p => { prestMap[p.herramienta_id] = p; });

    cacheHerrs = (herrs || []).map(h => TP.mapHerramienta(h, prestMap[h.id] || null));

    // 3. Render de la estructura (toolbar + contenedor)
    $v.innerHTML = `
      <div class="toolbar">
        <div class="search">
          <span class="ico">🔍</span>
          <input id="f-q" placeholder="Buscar por nombre, marca, modelo..." value="${TP.esc(filtros.q)}">
        </div>
        <select class="filter" id="f-cat">
          <option value="">Todas las categorías</option>
          ${cats.map(c => `<option value="${TP.esc(c)}" ${filtros.cat === c ? 'selected' : ''}>${TP.esc(c)}</option>`).join('')}
        </select>
        <select class="filter" id="f-est">
          <option value="">Todos los estados</option>
          ${Object.entries(TP.ESTADOS).map(([k, v]) => `<option value="${k}" ${filtros.est === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select>
        <select class="filter" id="f-ubi">
          <option value="">Todas las ubicaciones</option>
          ${ubis.map(u => `<option value="${TP.esc(u)}" ${filtros.ubi === u ? 'selected' : ''}>${TP.esc(u)}</option>`).join('')}
        </select>
        <select class="filter" id="f-orden">
          <option value="nombre" ${filtros.orden==='nombre'?'selected':''}>Ordenar: Nombre</option>
          <option value="reciente" ${filtros.orden==='reciente'?'selected':''}>Ordenar: Más reciente</option>
          <option value="precio" ${filtros.orden==='precio'?'selected':''}>Ordenar: Precio</option>
          <option value="categoria" ${filtros.orden==='categoria'?'selected':''}>Ordenar: Categoría</option>
        </select>
        ${(filtros.q || filtros.cat || filtros.est || filtros.ubi) ? '<button class="btn btn-ghost btn-sm" id="f-clear">✕ Limpiar</button>' : ''}
        <span id="contador-herr" style="margin-left:auto;color:var(--text-2);font-size:13px;font-weight:600"></span>
      </div>
      <div id="lista-herr"></div>`;

    renderListaHerramientas();

    // 4. Wiring de filtros (solo re-renderiza la lista, sin volver a pedir a Supabase)
    const q = TP.$('#f-q');
    if (q) {
      q.oninput = e => {
        filtros.q = e.target.value;
        clearTimeout(window._tq);
        window._tq = setTimeout(() => {
          const pos = e.target.selectionStart;
          renderListaHerramientas();
          const nq = TP.$('#f-q'); if (nq) { nq.focus(); nq.setSelectionRange(pos, pos); }
        }, 200);
      };
    }
    const bind = (id, key) => { const el = TP.$(id); if (el) el.onchange = e => { filtros[key] = e.target.value; renderListaHerramientas(); }; };
    bind('#f-cat','cat'); bind('#f-est','est'); bind('#f-ubi','ubi'); bind('#f-orden','orden');
    const cl = TP.$('#f-clear');
    if (cl) cl.onclick = () => {
      filtros.q=''; filtros.cat=''; filtros.est=''; filtros.ubi='';
      TP.onReady();
    };
  } catch (err) {
    console.error(err);
    $v.innerHTML = `<div class="empty"><div class="em">⚠️</div><h3>Error al cargar</h3><p>${TP.esc(err.message)}</p></div>`;
  }
};

TP.boot();