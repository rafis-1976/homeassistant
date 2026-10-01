/* ============================================================
   Página: Panel (Dashboard) — datos desde Supabase
   ============================================================ */
TP.pageTitle = 'Panel';
TP.pageSub   = 'Resumen de tu taller';
TP.navId     = 'dashboard';

function iconoAct(t) {
  return { alta:'➕', edicion:'✏️', baja:'🗑️', prestamo:'🤝', devolucion:'↩️', sistema:'💾' }[t] || '•';
}

TP.onReady = async function () {
  const $v = TP.$('#view');
  $v.innerHTML = '<p style="color:var(--text-2);padding:20px">Cargando datos…</p>';

  try {
    const [
      { data: herrs },
      { data: prestamos },
      { data: acts }
    ] = await Promise.all([
      TP.sb.from('taller_herramientas').select('*'),
      TP.sb.from('taller_prestamos').select('*').eq('activo', true),
      TP.sb.from('taller_actividad').select('*').order('fecha', { ascending: false }).limit(7)
    ]);

    const herramientas = herrs     || [];
    const prestActivos = prestamos || [];
    const actividad    = acts      || [];

    const prestMap = {};
    prestActivos.forEach(p => { prestMap[p.herramienta_id] = p; });

    const total = herramientas.length;
    const und   = herramientas.reduce((s, h) => s + (h.cantidad || 0), 0);
    const prest = prestActivos.length;
    const aver  = herramientas.filter(h => h.estado === 'averiada').length;
    const disp  = herramientas.filter(h => !prestMap[h.id] && h.estado === 'disponible').length;
    const valor = herramientas.reduce((s, h) => s + (h.precio || 0) * (h.cantidad || 0), 0);

    const venc = prestActivos.filter(p =>
      p.fecha_prevista && TP.diasHasta(p.fecha_prevista) < 0);

    const porCat = {};
    herramientas.forEach(h => { porCat[h.categoria] = (porCat[h.categoria] || 0) + 1; });
    const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const maxCat = Math.max(1, ...cats.map(c => c[1]));

    const estMap = { disponible: 0, prestada: 0, averiada: 0 };
    herramientas.forEach(h => {
      if (prestMap[h.id]) estMap.prestada++;
      else if (h.estado === 'averiada') estMap.averiada++;
      else estMap.disponible++;
    });

    const porUbi = {};
    herramientas.forEach(h => {
      const u = h.ubicacion || 'Sin ubicación';
      porUbi[u] = (porUbi[u] || 0) + 1;
    });
    const ubis = Object.entries(porUbi).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxU = Math.max(1, ...ubis.map(u => u[1]));

    let alertas = '';
    venc.forEach(p => {
      const h = herramientas.find(x => x.id === p.herramienta_id);
      alertas += `<div class="alert alert-d"><span>⏰</span><div><b>Préstamo vencido:</b> ${TP.esc(h?.nombre || '?')} — ${TP.esc(p.persona)} (${Math.abs(TP.diasHasta(p.fecha_prevista))} días de retraso)</div></div>`;
    });
    if (aver > 0)
      alertas += `<div class="alert alert-d"><span>🔴</span><div><b>${aver} herramienta${aver > 1 ? 's' : ''} averiada${aver > 1 ? 's' : ''}</b> — revisa el estado en el inventario</div></div>`;

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
          ${cats.length ? cats.map(([c, n]) => `
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
          ${actividad.length ? actividad.map(a => `
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
          ${ubis.length ? ubis.map(([u, n]) => `
            <div class="bar-row">
              <div class="bar-label">📍 ${TP.esc(u)}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${(n / maxU) * 100}%;background:var(--info)"></div></div>
              <div class="bar-val">${n}</div>
            </div>`).join('') : '<p style="color:var(--text-2);font-size:13px">Sin datos</p>'}
        </div>
      </div>`;
  } catch (err) {
    console.error(err);
    $v.innerHTML = `<div class="empty"><div class="em">⚠️</div><h3>Error al cargar</h3><p>${TP.esc(err.message)}</p></div>`;
  }
};

TP.boot();