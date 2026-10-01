/* ============================================================
   Página: Panel (Dashboard)
   ============================================================ */
TP.pageTitle = 'Panel';
TP.pageSub   = 'Resumen de tu taller';
TP.navId     = 'dashboard';

function iconoAct(t) {
  return { alta:'➕', edicion:'✏️', baja:'🗑️', prestamo:'🤝', devolucion:'↩️', sistema:'💾' }[t] || '•';
}

TP.onReady = function () {
  const total = TP.dbGet('SELECT COUNT(*) AS c FROM herramientas').c;
  const und   = TP.dbGet('SELECT COALESCE(SUM(cantidad),0) AS c FROM herramientas').c;
  const prest = TP.dbGet('SELECT COUNT(*) AS c FROM prestamos WHERE activo = 1').c;
  const aver  = TP.dbGet("SELECT COUNT(*) AS c FROM herramientas WHERE estado = 'averiada'").c;
  const disp  = TP.dbGet(`SELECT COUNT(*) AS c FROM herramientas h
                          LEFT JOIN prestamos p ON p.herramienta_id = h.id AND p.activo = 1
                          WHERE p.id IS NULL AND h.estado = 'disponible'`).c;
  const valor = TP.dbGet('SELECT COALESCE(SUM(precio * cantidad),0) AS v FROM herramientas').v;

  const venc = TP.vencidos();

  const cats = TP.dbAll(`
    SELECT categoria AS c, COUNT(*) AS n FROM herramientas
    GROUP BY categoria ORDER BY n DESC LIMIT 7`);
  const maxCat = Math.max(1, ...cats.map(x => x.n));

  const porEst = TP.dbAll(`
    SELECT CASE WHEN p.id IS NOT NULL THEN 'prestada' ELSE h.estado END AS est, COUNT(*) AS n
    FROM herramientas h
    LEFT JOIN prestamos p ON p.herramienta_id = h.id AND p.activo = 1
    GROUP BY est`);
  const estMap = { disponible: 0, prestada: 0, averiada: 0 };
  porEst.forEach(r => estMap[r.est] = r.n);

  const ubis = TP.dbAll(`
    SELECT COALESCE(NULLIF(ubicacion,''),'Sin ubicación') AS u, COUNT(*) AS n
    FROM herramientas GROUP BY u ORDER BY n DESC LIMIT 8`);
  const maxU = Math.max(1, ...ubis.map(x => x.n));

  const acts = TP.dbAll('SELECT * FROM actividad ORDER BY fecha DESC LIMIT 7');

  let alertas = '';
  venc.forEach(h => {
    alertas += `<div class="alert alert-d"><span>⏰</span><div><b>Préstamo vencido:</b> ${TP.esc(h.nombre)} — ${TP.esc(h.prestamo.persona)} (${Math.abs(TP.diasHasta(h.prestamo.fechaPrevista))} días de retraso)</div></div>`;
  });
  if (aver > 0) alertas += `<div class="alert alert-d"><span>🔴</span><div><b>${aver} herramienta${aver > 1 ? 's' : ''} averiada${aver > 1 ? 's' : ''}</b> — revisa el estado en el inventario</div></div>`;

  const $v = TP.$('#view');
  $v.innerHTML = `
    <div class="stats">
      <div class="stat" style="--accent:var(--primary)">
        <div class="stat-label">🔧 Referencias</div>
        <div class="stat-value">${total}</div>
        <div class="stat-sub">${und} unidades en total</div>
      </div>
      <div class="stat" style="--accent:var(--success)">
        <div class="stat-label">✅ Disponibles</div>
        <div class="stat-value">${disp}</div>
        <div class="stat-sub">listas para usar</div>
      </div>
      <div class="stat" style="--accent:var(--info)">
        <div class="stat-label">🤝 Prestadas</div>
        <div class="stat-value">${prest}</div>
        <div class="stat-sub">${venc.length ? `<span style="color:var(--danger);font-weight:700">${venc.length} vencida(s)</span>` : 'fuera del taller'}</div>
      </div>
      <div class="stat" style="--accent:var(--danger)">
        <div class="stat-label">🔴 Averiadas</div>
        <div class="stat-value">${aver}</div>
        <div class="stat-sub">fuera de servicio</div>
      </div>
      <div class="stat" style="--accent:#7c3aed">
        <div class="stat-label">💰 Valor inventario</div>
        <div class="stat-value" style="font-size:22px">${TP.fmtMoney(valor)}</div>
        <div class="stat-sub">valor estimado</div>
      </div>
    </div>
    ${alertas ? `<div style="margin-bottom:22px">${alertas}</div>` : ''}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">
      <div class="card card-pad">
        <div class="card-title">📊 Herramientas por categoría</div>
        ${cats.length ? cats.map(({ c, n }) => `
          <div class="bar-row">
            <div class="bar-label">${TP.iconoCat(c)} ${TP.esc(c)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${(n / maxCat) * 100}%"></div></div>
            <div class="bar-val">${n}</div>
          </div>`).join('') : '<p style="color:var(--text-2);font-size:13px">Sin datos</p>'}
      </div>
      <div class="card card-pad">
        <div class="card-title">🎯 Estado del inventario</div>
        ${Object.entries(estMap).map(([k, n]) => {
          const pct = total ? (n / total) * 100 : 0;
          const col = { disponible: 'var(--success)', prestada: 'var(--info)', averiada: 'var(--danger)' }[k];
          return `<div class="bar-row">
            <div class="bar-label">${TP.ESTADOS[k].label}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${col}"></div></div>
            <div class="bar-val">${n}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="card card-pad">
        <div class="card-title">🕓 Actividad reciente</div>
        ${acts.length ? acts.map(a => `
          <div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px">
            <span style="opacity:.7">${iconoAct(a.tipo)}</span>
            <div style="flex:1;min-width:0">
              <div style="word-break:break-word">${TP.esc(a.texto)}</div>
              <div style="font-size:11.5px;color:var(--text-2);margin-top:1px">${new Date(a.fecha).toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          </div>`).join('') : '<p style="color:var(--text-2);font-size:13px">Sin actividad registrada</p>'}
      </div>
      <div class="card card-pad">
        <div class="card-title">📍 Herramientas por ubicación</div>
        ${ubis.length ? ubis.map(({ u, n }) => `
          <div class="bar-row">
            <div class="bar-label">📍 ${TP.esc(u)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${(n / maxU) * 100}%;background:var(--info)"></div></div>
            <div class="bar-val">${n}</div>
          </div>`).join('') : '<p style="color:var(--text-2);font-size:13px">Sin datos</p>'}
      </div>
    </div>`;
};

TP.boot();