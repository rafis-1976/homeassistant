function cardHerramienta(h) {
  const est  = h.prestamo ? 'prestada' : (h.estado === 'averiada' ? 'averiada' : 'disponible');
  const venc = h.prestamo && h.prestamo.fechaPrevista && TP.diasHasta(h.prestamo.fechaPrevista) < 0;

  // Miniatura: si tiene foto, la mostramos; si no, el icono de la categoría
  const miniatura = h.fotoUrl
    ? `<div class="tool-ico" style="padding:0;overflow:hidden">
         <img src="${TP.esc(h.fotoUrl)}" alt="" loading="lazy"
              style="width:100%;height:100%;object-fit:cover"
              onerror="this.parentElement.innerHTML='${TP.iconoCat(h.categoria)}';this.parentElement.style.fontSize='20px'">
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