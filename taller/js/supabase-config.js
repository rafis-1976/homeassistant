/* ============================================================
   TallerPro — supabase-config.js  (v3.1 con fotos)
   ============================================================ */
(function () {
  const TP = window.TP = {};

  /* ============ 1. CONFIGURACIÓN ============ */
  const SUPABASE_URL      = 'https://mwzhyozqmsqmfpgtzeek.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13emh5b3pxbXNxbWZwZ3R6ZWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMjE3ODEsImV4cCI6MjEwNTc5Nzc4MX0.U03Ec0QqhWznmy9_pyyjvp0yS9vzuPy9FY01UvfZDs0';
  const BUCKET_FOTOS      = 'taller-fotos';   // ← NUEVO

  /* ============ 2. Cliente ============ */
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
  TP.BUCKET_FOTOS = BUCKET_FOTOS;

  /* ============ 3. Utilidades ============ */
  // ...igual que antes...

  /* ============ NUEVO: subida y compresión de fotos ============ */

  /**
   * Comprime una imagen en el navegador antes de subirla.
   * Reduce a maxWidth px de ancho y la exporta como JPEG con calidad 0.85.
   */
  TP.comprimirImagen = function (file, maxWidth = 1280, calidad = 0.85) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) { reject(new Error('No es una imagen')); return; }
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth) {
            height = Math.round(height * maxWidth / width);
            width = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(blob => {
            if (!blob) { reject(new Error('No se pudo comprimir la imagen')); return; }
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
          }, 'image/jpeg', calidad);
        };
        img.onerror = () => reject(new Error('Imagen inválida'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Error leyendo el archivo'));
      reader.readAsDataURL(file);
    });
  };

  /**
   * Sube un archivo al bucket y devuelve la URL pública.
   * Si `rutaAntigua` es una URL del mismo bucket, borra el archivo anterior.
   */
  TP.subirFoto = async function (file, rutaAntigua = null) {
    // 1. Comprimir (reduce de 4-8 MB a ~150-300 KB)
    const comprimida = await TP.comprimirImagen(file);

    // 2. Nombre único: <timestamp>-<random>.jpg
    const ext  = 'jpg';
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `${Date.now()}-${rand}.${ext}`;

    // 3. Subir
    const { error } = await sb.storage
      .from(BUCKET_FOTOS)
      .upload(path, comprimida, { cacheControl: '3600', upsert: false, contentType: 'image/jpeg' });
    if (error) throw new Error('Error subiendo foto: ' + error.message);

    // 4. Borrar la antigua (si pertenece a este bucket)
    if (rutaAntigua) {
      const viejo = TP.extraerRutaBucket(rutaAntigua);
      if (viejo) await sb.storage.from(BUCKET_FOTOS).remove([viejo]);
    }

    // 5. Obtener URL pública
    const { data } = sb.storage.from(BUCKET_FOTOS).getPublicUrl(path);
    return data.publicUrl;
  };

  /**
   * Extrae la ruta interna de un bucket a partir de su URL pública.
   * Ej: "https://x.supabase.co/storage/v1/object/public/taller-fotos/1712-abc.jpg"
   *     → "1712-abc.jpg"
   */
  TP.extraerRutaBucket = function (url) {
    if (!url) return null;
    const marca = `/storage/v1/object/public/${BUCKET_FOTOS}/`;
    const i = url.indexOf(marca);
    return i === -1 ? null : url.slice(i + marca.length);
  };

  /**
   * Borra una foto por URL (usado al eliminar una herramienta).
   */
  TP.borrarFoto = async function (url) {
    const ruta = TP.extraerRutaBucket(url);
    if (!ruta) return;
    await sb.storage.from(BUCKET_FOTOS).remove([ruta]);
  };

  /* ============ 4-7. (Config, toast, modal, helpers) ============ */
  // ...igual que antes...
  // IMPORTANTE: actualizar mapHerramienta para incluir foto:

  TP.mapHerramienta = function (h, prest) {
    if (!h) return null;
    return {
      id: h.id, nombre: h.nombre, categoria: h.categoria,
      marca: h.marca, modelo: h.modelo, serie: h.serie,
      cantidad: h.cantidad, precio: h.precio,
      fechaCompra: h.fecha_compra, ubicacion: h.ubicacion,
      estado: h.estado, notas: h.notas, creado: h.creado,
      fotoUrl: h.foto_url || '',        // ← NUEVO
      prestamo: prest ? {
        id: prest.id, persona: prest.persona, telefono: prest.telefono,
        fecha: prest.fecha_prestamo, fechaPrevista: prest.fecha_prevista,
        notas: prest.notas
      } : null
    };
  };

  /* ============ 8. Formulario con foto ============ */

  function formHerramienta(h = {}) {
    const prestada = !!h.prestamo;
    const foto = h.fotoUrl || '';
    return `
    <div class="form-grid">
      <label class="full">Nombre de la herramienta *
        <input id="f-nombre" value="${TP.esc(h.nombre || '')}" placeholder="Ej: Taladro percutor 18V" maxlength="80">
      </label>

      <label class="full">Foto
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <div id="f-foto-preview" style="
            width:110px;height:110px;border-radius:12px;overflow:hidden;
            background:var(--surface-2);display:grid;place-items:center;
            border:1px solid var(--border);flex-shrink:0">
            ${foto
              ? `<img src="${TP.esc(foto)}" style="width:100%;height:100%;object-fit:cover">`
              : '<span style="font-size:32px;opacity:.4">📷</span>'}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <input id="f-foto" type="file" accept="image/*" capture="environment" style="display:none">
            <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('f-foto').click()">
              📷 Hacer foto / elegir
            </button>
            ${foto ? `<button type="button" class="btn btn-ghost btn-sm" id="f-foto-quitar" style="color:var(--danger)">
                        🗑️ Quitar foto
                      </button>` : ''}
            <span class="hint" style="font-size:11px">La imagen se comprime antes de subirla</span>
          </div>
        </div>
        <input type="hidden" id="f-foto-url" value="${TP.esc(foto)}">
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

  /**
   * Se llama tras inyectar el HTML del modal para conectar
   * el input file con la previsualización.
   */
  function wireFormFoto() {
    const input = $('#f-foto');
    const preview = $('#f-foto-preview');
    const urlInput = $('#f-foto-url');
    if (!input || !preview) return;

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      // Previsualización instantánea (sin subir aún)
      const reader = new FileReader();
      reader.onload = e => {
        preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
      };
      reader.readAsDataURL(file);
      // Marcamos que hay una foto nueva pendiente de subir
      preview.dataset.nueva = '1';
      preview.dataset.nombreArchivo = file.name;
    };

    const quitar = $('#f-foto-quitar');
    if (quitar) {
      quitar.onclick = () => {
        urlInput.value = '';
        input.value = '';
        preview.innerHTML = '<span style="font-size:32px;opacity:.4">📷</span>';
        preview.dataset.nueva = '';
        preview.dataset.eliminar = '1';
      };
    }
  }

  /**
   * Procesa la foto del formulario antes de guardar:
   *  - Si hay un archivo nuevo, lo sube y devuelve la nueva URL.
   *  - Si se marcó "eliminar", borra la del bucket y devuelve ''.
   *  - Si no hay cambios, devuelve la URL actual.
   */
  async function resolverFoto(herramientaOriginal = {}) {
    const urlInput = $('#f-foto-url');
    const preview = $('#f-foto-preview');
    if (!urlInput) return '';

    const urlActual = urlInput.value || '';
    const nueva = preview?.dataset?.nueva === '1';
    const eliminar = preview?.dataset?.eliminar === '1';
    const input = $('#f-foto');

    if (eliminar && !nueva) {
      // Solo borrar si la actual pertenecía al bucket
      if (urlActual) await TP.borrarFoto(urlActual).catch(() => {});
      return '';
    }

    if (nueva && input?.files?.[0]) {
      const nuevaUrl = await TP.subirFoto(input.files[0], urlActual || null);
      return nuevaUrl;
    }

    return urlActual;
  }

  /* ============ 9. Nueva / Editar con foto ============ */

  TP.nuevaHerramienta = function () {
    TP.showModal({
      title: 'Nueva herramienta',
      body: formHerramienta({ cantidad: 1, estado: 'disponible' }),
      saveText: 'Añadir al inventario',
      onSave: async () => {
        const d = leerFormulario({});
        if (!d) return false;

        const btn = $('#modalSave'); const txt = btn.textContent;
        btn.disabled = true; btn.textContent = 'Guardando…';

        try {
          // Subir foto (si hay)
          const fotoUrl = await resolverFoto({});

          await sb.from('taller_categorias').upsert({ nombre: d.categoria });
          if (d.ubicacion) await sb.from('taller_ubicaciones').upsert({ nombre: d.ubicacion });

          const { error } = await sb.from('taller_herramientas').insert({
            id: TP.uid('h'),
            nombre: d.nombre, categoria: d.categoria,
            marca: d.marca, modelo: d.modelo, serie: d.serie,
            cantidad: d.cantidad, precio: d.precio,
            fecha_compra: d.fechaCompra || null,
            ubicacion: d.ubicacion, estado: d.estado, notas: d.notas,
            foto_url: fotoUrl
          });
          if (error) throw error;

          await TP.log('alta', `Añadida «${d.nombre}» al inventario`);
          await TP.refresh();
          TP.toast('Herramienta añadida');
        } catch (err) {
          console.error(err);
          TP.toast('Error: ' + err.message, 'err');
          btn.disabled = false; btn.textContent = txt;
          return false;
        } finally {
          btn.disabled = false; btn.textContent = txt;
        }
      },
      afterRender: wireFormFoto   // ← nuevo hook
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

        const btn = $('#modalSave'); const txt = btn.textContent;
        btn.disabled = true; btn.textContent = 'Guardando…';

        try {
          const fotoUrl = await resolverFoto(h);

          const { error } = await sb.from('taller_herramientas').update({
            nombre: d.nombre, categoria: d.categoria, marca: d.marca,
            modelo: d.modelo, serie: d.serie, cantidad: d.cantidad,
            precio: d.precio, fecha_compra: d.fechaCompra || null,
            ubicacion: d.ubicacion, estado: d.estado, notas: d.notas,
            foto_url: fotoUrl
          }).eq('id', id);
          if (error) throw error;

          await TP.log('edicion', `Editada «${d.nombre}»`);
          await TP.refresh();
          TP.toast('Cambios guardados');
        } catch (err) {
          console.error(err);
          TP.toast('Error: ' + err.message, 'err');
          btn.disabled = false; btn.textContent = txt;
          return false;
        } finally {
          btn.disabled = false; btn.textContent = txt;
        }
      },
      afterRender: wireFormFoto
    });
  };

  /* ============ 10. Eliminar (también borra la foto) ============ */

  TP.eliminarHerramienta = async function (id) {
    const h = await TP.getH(id);
    if (!h) return;
    TP.showModal({
      title: 'Eliminar herramienta',
      body: `<p style="font-size:14.5px;line-height:1.6">¿Seguro que quieres eliminar <b>${TP.esc(h.nombre)}</b>?</p>
             <p style="margin-top:10px;color:var(--text-2);font-size:13px">También se eliminarán sus préstamos y su foto. Esta acción no se puede deshacer.</p>`,
      saveText: 'Sí, eliminar',
      onSave: async () => {
        // Borrar foto primero (best-effort)
        if (h.fotoUrl) await TP.borrarFoto(h.fotoUrl).catch(() => {});
        const { error } = await sb.from('taller_herramientas').delete().eq('id', id);
        if (error) { TP.toast('Error: ' + error.message, 'err'); return false; }
        await TP.log('baja', `Eliminada «${h.nombre}»`);
        await TP.refresh();
        TP.toast('Herramienta eliminada');
      }
    });
  };

  /* ============ 11. Modal: hook afterRender ============ */

  let modalSaveHandler = null;
  let modalAfterRender = null;

  TP.showModal = function ({ title, body, saveText = 'Guardar', onSave, hideSave = false, afterRender = null }) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = body;
    $('#modalSave').textContent = saveText;
    $('#modalSave').style.display = hideSave ? 'none' : '';
    modalSaveHandler = onSave;
    modalAfterRender = afterRender;
    $('#overlay').classList.add('open');
    if (typeof modalAfterRender === 'function') {
      try { modalAfterRender(); } catch (e) { console.error(e); }
    }
    setTimeout(() => {
      const f = $('#modalBody input:not([type=file]), #modalBody select, #modalBody textarea');
      if (f) f.focus();
    }, 60);
  };

  TP.closeModal = function () {
    $('#overlay').classList.remove('open');
    modalSaveHandler = null;
    modalAfterRender = null;
  };

  // El resto del wireModal, CRUD, shell, boot... igual que antes.

  /* ============ (todo lo demás del archivo sigue igual) ============ */
  // ... shell, boot, descargas ...
})();