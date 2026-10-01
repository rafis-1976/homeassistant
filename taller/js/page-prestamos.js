/* ============================================================
   Página: Préstamos (activos + historial)
   ============================================================ */
TP.pageTitle = 'Préstamos';
TP.pageSub   = 'Herramientas fuera del taller';
TP.navId     = 'prestamos';

let tabPrestamos = 'activos';

TP.onReady = function () {
  const act  = TP.activos();
  const hist = TP.getHistPrest();

  const $v = TP.$('#view');
  $v.innerHTML = `
    <div class="tabs">
      <button class="tab ${tabPrestamos === 'activos' ? 'active' : ''}" data-tab="activos">Activos (${act.length})</button>
      <button class="tab ${tabPrestamos === 'historial' ? 'active' : ''}" data-tab="historial">Historial (${hist.length})</button>
    </div>
    <div id="prest-body"></div>`;

  TP.$$('.tab').forEach(t => t.onclick = () => { tabPrestamos = t.dataset.tab; TP.onReady(); });

  const body = TP.$('#prest-body');

  if (tabPrestamos === 'activos') {
    if (!act.length) {
      body.innerHTML = `<div class="empty"><div class="em">🤝</div><h3>No hay préstamos activos</h3><p>Todas tus herramientas están en el taller. Cuando prestes alguna, aparecerá aquí con su fecha de devolución.</p></div>`;
      return;
    }
    body.innerHTML = `<div class="list">${act.map(h => {
      const d = h.prestamo.fechaPrevista ? TP.diasHasta(h.prestamo.fechaPrevista) : null;
      const venc = d !== null && d < 0;
      const proximo = d !== null && d >= 0 && d <= 3;
      return `
      <div class="row" style="${venc ? 'border-color:var(--danger)' : proximo ? 'border-color:var(--warning)' : ''}">
        <div class="tool-ico">${TP.iconoCat(h.categoria)}</div>
        <div class="row-main">
          <div class="row-title">${TP.esc(h.nombre)}</div>
          <div class="row-sub">
            <b>${TP.esc(h.prestamo.persona)}</b>${h.prestamo.telefono ? ' · ' + TP.esc(h.prestamo.telefono) : ''}
            · Prestada el ${TP.fmtFecha(h.prestamo.fecha)}
          </div>
          <div class="row-sub" style="${venc ? 'color:var(--danger);font-weight:700' : proximo ? 'color:var(--warning);font-weight:700' : ''}">
            ${venc ? `⏰ Vencida hace ${Math.abs(d)} días (${TP.fmtFecha(h.prestamo.fechaPrevista)})`
                   : d === 0 ? '📅 Devolución prevista para hoy'
                   : `📅 Devolución prevista: ${TP.fmtFecha(h.prestamo.fechaPrevista)} (en ${d} días)`}
          </div>
          ${h.prestamo.notas ? `<div class="row-sub" style="font-style:italic">${TP.esc(h.prestamo.notas)}</div>` : ''}
        </div>
        <div class="row-actions">
          <button class="btn btn-sm btn-success" onclick="TP.devolver('${h.id}')">↩️ Devolver</button>
          <button class="btn btn-sm btn-ghost" onclick="TP.verDetalle('${h.id}')">ℹ️</button>
        </div>
      </div>`;
    }).join('')}</div>`;
  } else {
    if (!hist.length) {
      body.innerHTML = `<div class="empty"><div class="em">📜</div><h3>Sin historial todavía</h3><p>Aquí se registrarán todas las devoluciones con sus fechas y observaciones.</p></div>`;
      return;
    }
    body.innerHTML = `<div class="list">${hist.map(p => `
      <div class="row">
        <div class="tool-ico" style="background:var(--success-soft)">↩️</div>
        <div class="row-main">
          <div class="row-title">${TP.esc(p.herramienta || '(eliminada)')}</div>
          <div class="row-sub"><b>${TP.esc(p.persona)}</b> · Prestada ${TP.fmtFecha(p.fecha_prestamo)} → Devuelta ${TP.fmtFecha(p.fecha_devolucion)}</div>
          ${p.retraso ? `<div class="row-sub" style="color:var(--danger)">⏰ Con ${p.retraso} días de retraso</div>` : ''}
          ${p.notas ? `<div class="row-sub" style="font-style:italic">${TP.esc(p.notas)}</div>` : ''}
        </div>
        <div class="row-actions">
          <button class="btn btn-sm btn-ghost" onclick="TP.borrarHistorial('${p.id}')" title="Eliminar registro" style="color:var(--danger)">🗑️</button>
        </div>
      </div>`).join('')}</div>`;
  }
};

TP.borrarHistorial = function (id) {
  TP.dbRun('DELETE FROM prestamos WHERE id = ? AND activo = 0', [id]);
  TP.onReady();
  TP.toast('Registro eliminado');
};

TP.boot();