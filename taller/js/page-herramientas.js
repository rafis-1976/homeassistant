/* ============================================================
   Página: Herramientas (inventario + filtros)
   ============================================================ */
TP.pageTitle = 'Herramientas';
TP.pageSub   = 'Inventario completo';
TP.navId     = 'herramientas';

const filtros = { q: '', cat: '', est: '', ubi: '', orden: 'nombre' };

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
      ${(TP.num(h.cantidad) || 1) > 1 ? `<span class="chip">×${h.cantidad}</span>` : ''}
      ${TP.num(h.precio) > 0 ? `<span class="chip">${TP.fmtMoney(h.precio)}</span>` : ''}
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

TP.onReady = function () {
  const cats = TP.getCats();
  const ubis = TP.getUbis();

  const where = [], params = [];
  if (filtros.q) {
    where.push(`(h.nombre LIKE ? OR h.marca LIKE ? OR h.modelo LIKE ? OR h.serie LIKE ? OR h.notas LIKE ?)`);
    const like = '%' + filtros.q + '%';
    params.push(like, like, like, like, like);
  }
  if (filtros.cat) { where.push('h.categoria = ?'); params.push(filtros.cat); }
  if (filtros.ubi) { where.push('h.ubicacion = ?'); params.push(filtros.ubi); }
  if (filtros.est) {
    if (filtros.est === 'prestada')       where.push('p.id IS NOT NULL');
    else if (filtros.est === 'disponible')where.push("p.id IS NULL AND h.estado = 'disponible'");
    else if (filtros.est === 'averiada')  where.push("h.estado = 'averiada'");
  }
  const orderMap = {
    nombre:   'h.nombre COLLATE NOCASE ASC',
    reciente: 'h.creado DESC',
    precio:   'h.precio DESC',
    categoria:'h.categoria COLLATE NOCASE ASC, h.nombre COLLATE NOCASE ASC'
  };
  const sql = TP.SQL_HERR_CON_PRESTAMO
    + (where.length ? ' WHERE ' + where.join(' AND ') : '')
    + ' ORDER BY ' + (orderMap[filtros.orden] || orderMap.nombre);
  const list = TP.dbAll(sql, params).map(TP.mapHerramienta);
  const totalReg = TP.dbGet('SELECT COUNT(*) AS c FROM herramientas').c;

  const $v = TP.$('#view');
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
      <span style="margin-left:auto;color:var(--text-2);font-size:13px;font-weight:600">${list.length} de ${totalReg}</span>
    </div>
    <div id="lista-herr"></div>`;

  const cont = TP.$('#lista-herr');
  if (!list.length) {
    cont.innerHTML = totalReg
      ? `<div class="empty"><div class="em">🔍</div><h3>Sin resultados</h3><p>No hay herramientas que coincidan con los filtros aplicados.</p></div>`
      : `<div class="empty"><div class="em">🧰</div><h3>Tu taller está vacío</h3><p>Añade tu primera herramienta para empezar a controlar tu inventario y préstamos.</p><button class="btn btn-primary" onclick="TP.nuevaHerramienta()">＋ Añadir herramienta</button></div>`;
  } else {
    cont.innerHTML = `<div class="grid">${list.map(cardHerramienta).join('')}</div>`;
  }

  // Wiring de filtros
  const q = TP.$('#f-q');
  if (q) {
    q.oninput = e => {
      filtros.q = e.target.value;
      clearTimeout(window._tq);
      window._tq = setTimeout(() => {
        const pos = e.target.selectionStart;
        TP.onReady();
        const nq = TP.$('#f-q'); if (nq) { nq.focus(); nq.setSelectionRange(pos, pos); }
      }, 220);
    };
  }
  const bind = (id, key) => { const el = TP.$(id); if (el) el.onchange = e => { filtros[key] = e.target.value; TP.onReady(); }; };
  bind('#f-cat','cat'); bind('#f-est','est'); bind('#f-ubi','ubi'); bind('#f-orden','orden');
  const cl = TP.$('#f-clear');
  if (cl) cl.onclick = () => {
    filtros.q=''; filtros.cat=''; filtros.est=''; filtros.ubi='';
    TP.onReady();
  };
};

TP.boot();