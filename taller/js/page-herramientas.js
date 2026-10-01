/* ============================================================
   Página: Herramientas — datos desde Supabase
   Vista: grid (tarjetas) o lista (filas). Preferencia persistente.
   ============================================================ */
TP.pageTitle = 'Herramientas';
TP.pageSub   = 'Inventario completo';
TP.navId     = 'herramientas';

// Estado de filtros + modo de vista (persistido en localStorage)
window.__herrFiltros = window.__herrFiltros || { q: '', cat: '', est: '', ubi: '', orden: 'nombre' };
window.__herrCache   = window.__herrCache   || [];
window.__herrVista   = window.__herrVista   || (localStorage.getItem('tallerpro_vista_herr') || 'grid');

function __setVista(v) {
  window.__herrVista = v;
  localStorage.setItem('tallerpro_vista_herr', v);
}

/* ---------- Tarjeta (modo GRID) ---------- */
function __cardHerramienta(h) {
  const est  = h.prestamo ? 'prestada' : (h.estado === 'averiada' ? 'averiada' : 'disponible');
  const venc = h.prestamo && h.prestamo.fechaPrevista && TP.diasHasta(h.prestamo.fechaPrevista) < 0;

  const miniatura = h.fotoUrl
    ? `<div class="tool-ico" style="padding:0;overflow:hidden">
         <img src="${TP.esc(h.fotoUrl)}" alt="" loading="lazy"
              style="width:100%;height:100%;object-fit:cover">
       </div>`
    : `<div class="tool-ico">${TP.iconoCat(h.categoria)}</div>`;

  return `
  <div class="tool">
    <div class="tool-top">
      ${miniatura}
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

/* ---------- Fila (modo LISTA) ---------- */
function __filaHerramienta(h) {
  const est  = h.prestamo ? 'prestada' : (h.estado === 'averiada' ? 'averiada' : 'disponible');
  const venc = h.prestamo && h.prestamo.fechaPrevista && TP.diasHasta(h.prestamo.fechaPrevista) < 0;

  const foto = h.fotoUrl
    ? `<div class="herr-row-foto"><img src="${TP.esc(h.fotoUrl)}" alt="" loading="lazy"></div>`
    : `<div class="herr-row-foto">${TP.iconoCat(h.categoria)}</div>`;

  const chips = [];
  if (h.ubicacion) chips.push(`<span class="chip">📍 ${TP.esc(h.ubicacion)}</span>`);
  if ((h.cantidad || 1) > 1) chips.push(`<span class="chip">×${h.cantidad}</span>`);
  if (h.precio > 0) chips.push(`<span class="chip">${TP.fmtMoney(h.precio)}</span>`);
  if (h.serie) chips.push(`<span class="chip">S/N ${TP.esc(h.serie)}</span>`);

  return `
  <div class="herr-row">
    ${foto}
    <div class="herr-row-main">
      <div class="herr-row-title">${TP.esc(h.nombre)}</div>
      <div class="herr-row-sub">${[h.marca, h.modelo].filter(Boolean).map(TP.esc).join(' · ') || TP.esc(h.categoria)}</div>
      ${chips.length ? `<div class="herr-row-chips">${chips.join('')}</div>` : ''}
      ${h.prestamo ? `
        <span class="herr-row-prestamo ${venc ? 'venc' : ''}">
          ${venc ? '⏰' : '🤝'} ${TP.esc(h.prestamo.persona)} · devolución ${TP.fmtFecha(h.prestamo.fechaPrevista)}${venc ? ` (${Math.abs(TP.diasHasta(h.prestamo.fechaPrevista))}d retraso)` : ''}
        </span>` : ''}
    </div>
    <div class="herr-row-estado">
      <span class="badge-est ${TP.ESTADOS[est].cls}">${TP.ESTADOS[est].label}</span>
    </div>
    <div class="herr-row-actions">
      ${h.prestamo
        ? `<button class="btn btn-sm btn-success" onclick="TP.devolver('${h.id}')" title="Devolver">↩️</button>`
        : `<button class="btn btn-sm btn-primary" onclick="TP.prestar('${h.id}')" title="Prestar">🤝</button>`}
      <button class="btn btn-sm btn-ghost" onclick="TP.editarHerramienta('${h.id}')" title="Editar">✏️</button>
      <button class="btn btn-sm btn-ghost" onclick="TP.verDetalle('${h.id}')" title="Detalle">ℹ️</button>
      <button class="btn btn-sm btn-ghost" onclick="TP.eliminarHerramienta('${h.id}')" title="Eliminar" style="color:var(--danger)">🗑️</button>
    </div>
  </div>`;
}

/* ---------- Filtros ---------- */
function __aplicarFiltros(lista) {
  const f = window.__herrFiltros;
  let out = lista.slice();
  const q = f.q.trim().toLowerCase();
  if (q) {
    out = out.filter(h =>
      `${h.nombre} ${h.marca} ${h.modelo} ${h.serie} ${h.notas}`.toLowerCase().includes(q)
    );
  }
  if (f.cat) out = out.filter(h => h.categoria === f.cat);
  if (f.ubi) out = out.filter(h => h.ubicacion === f.ubi);
  if (f.est) {
    out = out.filter(h => {
      const est = h.prestamo ? 'prestada' : h.estado;
      return est === f.est;
    });
  }
  const cmp = {
    nombre:    (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
    reciente:  (a, b) => (b.creado || '') > (a.creado || '') ? 1 : -1,
    precio:    (a, b) => (b.precio || 0) - (a.precio || 0),
    categoria: (a, b) => a.categoria.localeCompare(b.categoria, 'es') || a.nombre.localeCompare(b.nombre, 'es')
  };
  out.sort(cmp[f.orden] || cmp.nombre);
  return out;
}

/* ---------- Render del listado (grid o lista) ---------- */
function __renderLista() {
  const cont = TP.$('#lista-herr');
  if (!cont) return;

  const list = __aplicarFiltros(window.__herrCache);
  const totalReg = window.__herrCache.length;

  // Actualizar botones del toggle
  const bGrid = TP.$('#vista-grid');
  const bList = TP.$('#vista-lista');
  if (bGrid) bGrid.classList.toggle('active', window.__herrVista === 'grid');
  if (bList) bList.classList.toggle('active', window.__herrVista === 'lista');

  if (!list.length) {
    cont.innerHTML = totalReg
      ? `<div class="empty"><div class="em">🔍</div><h3>Sin resultados</h3><p>No hay herramientas que coincidan con los filtros aplicados.</p></div>`
      : `<div class="empty"><div class="em">🧰</div><h3>Tu taller está vacío</h3><p>Añade tu primera herramienta para empezar a controlar tu inventario y préstamos.</p><button class="btn btn-primary" onclick="TP.nuevaHerramienta()">＋ Añadir herramienta</button></div>`;
    const cnt = TP.$('#contador-herr');
    if (cnt) cnt.textContent = `0 de ${totalReg}`;
    return;
  }

  if (window.__herrVista === 'lista') {
    cont.innerHTML = `<div class="herr-list">${list.map(__filaHerramienta).join('')}</div>`;
  } else {
    cont.innerHTML = `<div class="grid">${list.map(__cardHerramienta).join('')}</div>`;
  }

  const cnt = TP.$('#contador-herr');
  if (cnt) cnt.textContent = `${list.length} de ${totalReg}`;
}

/* ---------- Carga principal ---------- */
TP.onReady = async function () {
  const $v = TP.$('#view');
  $v.innerHTML = '<p style="color:var(--text-2);padding:20px">Cargando herramientas…</p>';

  try {
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

    const prestMap = {};
    (prestamos || []).forEach(p => { prestMap[p.herramienta_id] = p; });

    window.__herrCache = (herrs || []).map(h => TP.mapHerramienta(h, prestMap[h.id] || null));

    $v.innerHTML = `
      <div class="toolbar">
        <div class="search">
          <span class="ico">🔍</span>
          <input id="f-q" placeholder="Buscar por nombre, marca, modelo..." value="${TP.esc(window.__herrFiltros.q)}">
        </div>
        <select class="filter" id="f-cat">
          <option value="">Todas las categorías</option>
          ${cats.map(c => `<option value="${TP.esc(c)}" ${window.__herrFiltros.cat === c ? 'selected' : ''}>${TP.esc(c)}</option>`).join('')}
        </select>
        <select class="filter" id="f-est">
          <option value="">Todos los estados</option>
          ${Object.entries(TP.ESTADOS).map(([k, v]) => `<option value="${k}" ${window.__herrFiltros.est === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select>
        <select class="filter" id="f-ubi">
          <option value="">Todas las ubicaciones</option>
          ${ubis.map(u => `<option value="${TP.esc(u)}" ${window.__herrFiltros.ubi === u ? 'selected' : ''}>${TP.esc(u)}</option>`).join('')}
        </select>
        <select class="filter" id="f-orden">
          <option value="nombre"    ${window.__herrFiltros.orden==='nombre'?'selected':''}>Ordenar: Nombre</option>
          <option value="reciente"  ${window.__herrFiltros.orden==='reciente'?'selected':''}>Ordenar: Más reciente</option>
          <option value="precio"    ${window.__herrFiltros.orden==='precio'?'selected':''}>Ordenar: Precio</option>
          <option value="categoria" ${window.__herrFiltros.orden==='categoria'?'selected':''}>Ordenar: Categoría</option>
        </select>

        <!-- NUEVO: Toggle grid / lista -->
        <div class="view-toggle" role="group" aria-label="Cambiar vista">
          <button id="vista-grid"  type="button" title="Vista de tarjetas">▦</button>
          <button id="vista-lista" type="button" title="Vista de lista">☰</button>
        </div>

        ${(window.__herrFiltros.q || window.__herrFiltros.cat || window.__herrFiltros.est || window.__herrFiltros.ubi)
          ? '<button class="btn btn-ghost btn-sm" id="f-clear">✕ Limpiar</button>' : ''}
        <span id="contador-herr" style="margin-left:auto;color:var(--text-2);font-size:13px;font-weight:600"></span>
      </div>
      <div id="lista-herr"></div>`;

    __renderLista();

    // Wiring: búsqueda con debounce
    const q = TP.$('#f-q');
    if (q) {
      q.oninput = e => {
        window.__herrFiltros.q = e.target.value;
        clearTimeout(window.__herrTq);
        window.__herrTq = setTimeout(() => {
          const pos = e.target.selectionStart;
          __renderLista();
          const nq = TP.$('#f-q');
          if (nq) { nq.focus(); nq.setSelectionRange(pos, pos); }
        }, 200);
      };
    }

    // Wiring: filtros
    const bind = (id, key) => {
      const el = TP.$(id);
      if (el) el.onchange = e => {
        window.__herrFiltros[key] = e.target.value;
        __renderLista();
      };
    };
    bind('#f-cat', 'cat');
    bind('#f-est', 'est');
    bind('#f-ubi', 'ubi');
    bind('#f-orden', 'orden');

    // Wiring: toggle de vista
    const bGrid = TP.$('#vista-grid');
    const bList = TP.$('#vista-lista');
    if (bGrid) bGrid.onclick = () => { __setVista('grid');  __renderLista(); };
    if (bList) bList.onclick = () => { __setVista('lista'); __renderLista(); };

    // Wiring: limpiar filtros
    const cl = TP.$('#f-clear');
    if (cl) cl.onclick = () => {
      window.__herrFiltros.q = '';
      window.__herrFiltros.cat = '';
      window.__herrFiltros.est = '';
      window.__herrFiltros.ubi = '';
      TP.onReady();
    };
  } catch (err) {
    console.error('💥 Error en page-herramientas:', err);
    $v.innerHTML = `
      <div class="empty">
        <div class="em">⚠️</div>
        <h3>Error al cargar herramientas</h3>
        <p style="color:var(--danger);font-family:monospace;font-size:12.5px;background:var(--surface-2);padding:10px;border-radius:8px;text-align:left;max-width:600px;margin:0 auto 14px;word-break:break-word">
          ${TP.esc(err.message)}
        </p>
        <button class="btn btn-primary" onclick="TP.onReady()">Reintentar</button>
      </div>`;
  }
};

TP.boot();