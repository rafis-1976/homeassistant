/* ============================================================
   TallerPro — supabase-config.js
   Cliente Supabase + CRUD + Shell
   Tablas con prefijo "taller_"
   ============================================================ */
(function () {
  const TP = window.TP = {};

  /* ============ 1. CONFIGURACIÓN (RELLENA ESTO) ============ */
  const SUPABASE_URL      = 'https://mwzhyozqmsqmfpgtzeek.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13emh5b3pxbXNxbWZwZ3R6ZWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMjE3ODEsImV4cCI6MjEwNTc5Nzc4MX0.U03Ec0QqhWznmy9_pyyjvp0yS9vzuPy9FY01UvfZDs0';

  /* ============ 2. Cliente Supabase ============ */
  if (typeof supabase === 'undefined' || !supabase.createClient) {
    document.addEventListener('DOMContentLoaded', () => {
      const l = document.getElementById('loader');
      if (!l) return;
      l.classList.add('err');
      document.getElementById('loaderTitle').textContent = 'Falta la librería de Supabase';
      document.getElementById('loaderMsg').textContent =
        'No se pudo cargar @supabase/supabase-js desde el CDN. Comprueba tu conexión a internet.';
    });
    return;
  }
  const sb = TP.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  /* ============ 3. Utilidades ============ */
  const $  = TP.$  = (s, r = document) => r.querySelector(s);
  const $$ = TP.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));

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

  /* ============ 4. Config local ============ */
  const LS_CFG = 'tallerpro_cfg_v3';
  TP.LS_CFG = LS_CFG;
  TP.ajustes = { taller: 'Mi Taller', tema: 'claro' };
  try { Object.assign(TP.ajustes, JSON.parse(localStorage.getItem(LS_CFG) || '{}')); } catch {}

  TP.saveCfg = () => localStorage.setItem(LS_CFG, JSON.stringify(TP.ajustes));
  TP.setTema = function (t) {
    TP.ajustes.tema = t; TP.saveCfg();
    document.documentElement.dataset.theme = t;
    const btn = $('#btnTheme'); if (btn) btn.textContent = t === 'oscuro' ? '☀️' : '🌙';
  };

  /* ============ 5. Toast ============ */
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

  /* ============ 6. Modal (con soporte async) ============ */
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
    $('#overlay').onclick = e => { if (e.target.id === 'overlay') TP.closeModal(); };
    $('#modalSave').onclick = async () => {
      if (typeof modalSaveHandler !== 'function') { TP.closeModal(); return; }
      const res = modalSaveHandler();
      const val = (res && typeof res.then === 'function') ? await res : res;
      if (val !== false) TP.closeModal();
    };
    document.addEventListener('keydown', e => { if (e.key === 'Escape') TP.closeModal(); });
  }

  /* ============ 7. Helpers de mapeo ============ */
  TP.mapHerramienta = function (h, prest) {
    if (!h) return null;
    return {
      id: h.id, nombre: h.nombre, categoria: h.categoria,
      marca: h.marca, modelo: h.modelo, serie: h.serie,
      cantidad: h.cantidad, precio: h.precio,
      fechaCompra: h.fecha_compra, ubicacion: h.ubicacion,
      estado: h.estado, notas: h.notas, creado: h.creado,
      prestamo: prest ? {
        id: prest.id, persona: prest.persona, telefono: prest.telefono,
        fecha: prest.fecha_prestamo, fechaPrevista: prest.fecha_prevista,
        notas: prest.notas
      } : null
    };
  };

  /* ============ 8. CRUD Supabase ============ */

  TP.getH = async function (id) {
    const { data, error } = await sb.from('taller_herramientas').select('*').eq('id', id).single();
    if (error) { console.error(error); return null; }
    const { data: prest } = await sb.from('taller_prestamos').select('*')
      .eq('herramienta_id', id).eq('activo', true).maybeSingle();
    return TP.mapHerramienta(data, prest);
  };

  TP.listH = async function () {
    const { data: herrs, error } = await sb.from('taller_herramientas').select('*').order('nombre');
    if (error) { console.error(error); return []; }
    const { data: prestamos } = await sb.from('taller_prestamos').select('*').eq('activo', true);
    const prestMap = {};
    (prestamos || []).forEach(p => { prestMap[p.herramienta_id] = p; });
    return (herrs || []).map(h => TP.mapHerramienta(h, prestMap[h.id] || null));
  };

  TP.activos = async function () {
    const { data, error } = await sb.from('taller_prestamos')
      .select('*, taller_herramientas ( nombre, categoria )')
      .eq('activo', true).order('fecha_prevista', { ascending: true });
    if (error) { console.error(error); return []; }
    return (data || []).map(p => ({
      id: p.herramienta_id,
      nombre: p.taller_herramientas?.nombre || '(eliminada)',
      categoria: p.taller_herramientas?.categoria || 'Otros',
      prestamo: {
        id: p.id, persona: p.persona, telefono: p.telefono,
        fecha: p.fecha_prestamo, fechaPrevista: p.fecha_prevista, notas: p.notas
      }
    }));
  };

  TP.getCats = async function () {
    const { data } = await sb.from('taller_categorias').select('nombre').order('nombre');
    return (data || []).map(r => r.nombre);
  };

  TP.getUbis = async function () {
    const { data } = await sb.from('taller_ubicaciones').select('nombre').order('nombre');
    return (data || []).map(r => r.nombre);
  };

  TP.getHistPrest = async function () {
    const { data } = await sb.from('taller_prestamos')
      .select('*, taller_herramientas ( nombre )')
      .eq('activo', false)
      .order('fecha_devolucion', { ascending: false });
    return (data || []).map(p => ({
      ...p,
      herramienta: p.taller_herramientas?.nombre || '(eliminada)'
    }));
  };

  TP.vencidos = async function () {
    const act = await TP.activos();
    return act.filter(h => h.prestamo.fechaPrevista && TP.diasHasta(h.prestamo.fechaPrevista) < 0);
  };

  TP.log = async function (tipo, texto) {
    await sb.from('taller_actividad').insert({ tipo, texto });
    const { data } = await sb.from('taller_actividad').select('id')
      .order('fecha', { ascending: false }).range(300, 999);
    if (data && data.length) {
      await sb.from('taller_actividad').delete().in('id', data.map(r => r.id));
    }
  };

  /* ============ 9. Formularios ============ */
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
        ${prestada ? '<span class="hint">Prestada a ' + TP.esc(h.prestamo.persona) + '</span>' : ''}
      </label>
      <label class="full">Notas
        <textarea id="f-notas" rows="3" placeholder="Accesorios, observaciones...">${TP.esc(h.notas || '')}</textarea>
      </label>
    </div>`;
  }

  function leerFormulario(h) {
    const nombre = $('#f-nombre').value.trim();
    if (!nombre) { TP.toast('El nombre es obligatorio', 'err'); return null; }
    return {
      nombre,
      categoria: ($('#f-categoria').value.trim()) || 'Otros',
      marca: $('#f-marca').value.trim(),
      modelo: $('#f-modelo').value.trim(),
      serie: $('#f-serie').value.trim(),
      cantidad: Math.max(1, parseInt($('#f-cantidad').value) || 1),
      precio: TP.num($('#f-precio').value),
      fechaCompra: $('#f-fechaCompra').value,
      ubicacion: $('#f-ubicacion').value.trim(),
      estado: h.prestamo ? h.estado : $('#f-estado').value,
      notas: $('#f-notas').value.trim()
    };
  }

  /* ============ 10. CRUD de herramientas ============ */
  TP.nuevaHerramienta = function () {
    TP.showModal({
      title: 'Nueva herramienta',
      body: formHerramienta({ cantidad: 1, estado: 'disponible' }),
      saveText: 'Añadir al inventario',
      onSave: async () => {
        const d = leerFormulario({});
        if (!d) return false;

        await sb.from('taller_categorias').upsert({ nombre: d.categoria });
        if (d.ubicacion) await sb.from('taller_ubicaciones').upsert({ nombre: d.ubicacion });

        const { error } = await sb.from('taller_herramientas').insert({
          id: TP.uid('h'),
          nombre: d.nombre, categoria: d.categoria,
          marca: d.marca, modelo: d.modelo, serie: d.serie,
          cantidad: d.cantidad, precio: d.precio,
          fecha_compra: d.fechaCompra || null,
          ubicacion: d.ubicacion, estado: d.estado, notas: d.notas
        });
        if (error) { TP.toast('Error: ' + error.message, 'err'); return false; }

        await TP.log('alta', `Añadida «${d.nombre}» al inventario`);
        await TP.refresh();
        TP.toast('Herramienta añadida');
      }
    });
  };

  TP.editarHerramienta = async function (id) {
    const h = await TP.getH(id);
    if (!h) return;
    TP.showModal({
      title: 'Editar herramienta',
      body: formHerramienta(h),
      saveText: 'Guardar cambios',
      onSave: async () => {
        const d = leerFormulario(h);
        if (!d) return false;
        const { error } = await sb.from('taller_herramientas').update({
          nombre: d.nombre, categoria: d.categoria, marca: d.marca,
          modelo: d.modelo, serie: d.serie, cantidad: d.cantidad,
          precio: d.precio, fecha_compra: d.fechaCompra || null,
          ubicacion: d.ubicacion, estado: d.estado, notas: d.notas
        }).eq('id', id);
        if (error) { TP.toast('Error: ' + error.message, 'err'); return false; }
        await TP.log('edicion', `Editada «${d.nombre}»`);
        await TP.refresh();
        TP.toast('Cambios guardados');
      }
    });
  };

  TP.eliminarHerramienta = async function (id) {
    const h = await TP.getH(id);
    if (!h) return;
    TP.showModal({
      title: 'Eliminar herramienta',
      body: `<p style="font-size:14.5px;line-height:1.6">¿Seguro que quieres eliminar <b>${TP.esc(h.nombre)}</b>?</p>
             <p style="margin-top:10px;color:var(--text-2);font-size:13px">También se eliminarán sus préstamos. Esta acción no se puede deshacer.</p>`,
      saveText: 'Sí, eliminar',
      onSave: async () => {
        const { error } = await sb.from('taller_herramientas').delete().eq('id', id);
        if (error) { TP.toast('Error: ' + error.message, 'err'); return false; }
        await TP.log('baja', `Eliminada «${h.nombre}»`);
        await TP.refresh();
        TP.toast('Herramienta eliminada');
      }
    });
  };

  TP.verDetalle = async function (id) {
    const h = await TP.getH(id);
    if (!h) return;
    const est = h.prestamo ? 'prestada' : (h.estado === 'averiada' ? 'averiada' : 'disponible');
    const { data: historial } = await sb.from('taller_prestamos').select('*')
      .eq('herramienta_id', id).eq('activo', false)
      .order('fecha_devolucion', { ascending: false });

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
      <div class="section-title" style="font-size:13.5px;margin-top:20px">📜 Historial de préstamos (${(historial || []).length})</div>
      ${(historial || []).length ? historial.map(p => `
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

  TP.prestar = async function (id) {
    const h = await TP.getH(id);
    if (!h) return;
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
            <textarea id="p-notas" rows="2" placeholder="Observaciones..."></textarea>
          </label>
        </div>`,
      saveText: 'Registrar préstamo',
      onSave: async () => {
        const persona = $('#p-persona').value.trim();
        if (!persona) { TP.toast('Indica el nombre de la persona', 'err'); return false; }
        const { error } = await sb.from('taller_prestamos').insert({
          herramienta_id: id, persona,
          telefono: $('#p-tel').value.trim(),
          fecha_prestamo: TP.hoy(),
          fecha_prevista: $('#p-fecha').value || TP.addDays(TP.hoy(), 7),
          notas: $('#p-notas').value.trim(),
          activo: true
        });
        if (error) { TP.toast('Error: ' + error.message, 'err'); return false; }
        await TP.log('prestamo', `«${h.nombre}» prestada a ${persona}`);
        await TP.refresh();
        TP.toast('Préstamo registrado');
      }
    });
  };

  TP.devolver = async function (id) {
    const h = await TP.getH(id);
    if (!h || !h.prestamo) return;
    const p = h.prestamo;
    const retraso = p.fechaPrevista ? TP.diasHasta(p.fechaPrevista) : 0;
    TP.showModal({
      title: 'Devolver herramienta',
      body: `
        <p style="font-size:14.5px;margin-bottom:14px">Devolución de <b>${TP.esc(h.nombre)}</b> por <b>${TP.esc(p.persona)}</b>.</p>
        ${retraso < 0 ? `<div class="alert alert-d"><span>⏰</span><div>Con <b>${Math.abs(retraso)} días</b> de retraso.</div></div>` : ''}
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
      onSave: async () => {
        const nuevoEstado = $('#d-estado').value;
        const obs = $('#d-notas').value.trim();
        const { error: e1 } = await sb.from('taller_prestamos').update({
          activo: false, fecha_devolucion: TP.hoy(),
          retraso: retraso < 0 ? Math.abs(retraso) : 0,
          notas: obs || p.notas
        }).eq('id', p.id);
        if (e1) { TP.toast('Error: ' + e1.message, 'err'); return false; }
        await sb.from('taller_herramientas').update({ estado: nuevoEstado }).eq('id', id);
        await TP.log('devolucion', `«${h.nombre}» devuelta por ${p.persona}`);
        await TP.refresh();
        TP.toast('Devolución registrada');
      }
    });
  };

  /* ============ 11. Shell ============ */
  TP.navItems = [
    { id: 'dashboard',    href: 'index.html',        icon: '📊', label: 'Panel' },
    { id: 'herramientas', href: 'herramientas.html', icon: '🔧', label: 'Herramientas' },
    { id: 'prestamos',    href: 'prestamos.html',    icon: '🤝', label: 'Préstamos', badge: true },
    { id: 'ubicaciones',  href: 'ubicaciones.html',  icon: '📍', label: 'Ubicaciones' },
    { id: 'ajustes',      href: 'ajustes.html',      icon: '⚙️', label: 'Ajustes' }
  ];

  TP.renderShell = function () {
    const navId = TP.navId || '';
    const navHtml = TP.navItems.map(item => `
      <a class="nav-item ${item.id === navId ? 'active' : ''}" href="${item.href}">
        <span class="ico">${item.icon}</span>${item.label}
        ${item.badge ? `<span class="badge" id="navBadge" style="display:none">0</span>` : ''}
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
            TallerPro · v3.0<br>
            <span class="db-badge">Supabase</span>
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

    TP.vencidos().then(v => {
      const badge = $('#navBadge');
      if (badge && v.length) { badge.style.display = ''; badge.textContent = v.length; }
    }).catch(() => {});
  };

  /* ============ 12. Refresh + Boot ============ */
  TP.onReady = null;
  TP.refresh = async function () {
    TP.renderShell();
    if (typeof TP.onReady === 'function') await TP.onReady();
  };

  TP.boot = async function () {
    try {
      const { error } = await sb.from('taller_herramientas').select('id').limit(1);
      if (error) throw new Error('No se pudo conectar a Supabase: ' + error.message);

      wireModal();
      await TP.refresh();
      $('#loader').style.display = 'none';
    } catch (err) {
      console.error(err);
      $('#loader').classList.add('err');
      $('#loaderTitle').textContent = 'Error de conexión';
      $('#loaderMsg').innerHTML = TP.esc(err.message) +
        '<br><br>Comprueba tu <b>SUPABASE_URL</b> y <b>SUPABASE_ANON_KEY</b> en <code>js/supabase-config.js</code>' +
        '<br><br><button class="btn btn-primary" onclick="location.reload()" style="margin-top:8px">Reintentar</button>';
    }
  };

  /* ============ 13. Descargas ============ */
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