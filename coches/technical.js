/* technical.js — Sección "Datos técnicos" (documentos, datos y enlaces) */
(function () {
  'use strict';

  const TABLE  = 'technical_data';
  const BUCKET = 'technical-docs';
  const MAX_MB = 20;

  let client = null, user = null, items = [], bound = false;

  const $   = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));

  /* ---------- cliente Supabase (reutiliza el de config.js si existe) ---------- */
  function getClient() {
    if (client) return client;

    const cands = [];
    try { if (typeof supabaseClient !== 'undefined') cands.push(supabaseClient); } catch (e) {}
    try { if (typeof sb !== 'undefined') cands.push(sb); } catch (e) {}
    cands.push(window.sb, window.supabaseClient, window.db, window.supabaseDB);

    for (const c of cands) {
      if (c && typeof c.from === 'function' && c.storage && c.auth) { client = c; return client; }
    }

    const url = window.SUPABASE_URL || window.SUPABASE_URL_;
    const key = window.SUPABASE_ANON_KEY || window.SUPABASE_KEY;
    if (url && key && window.supabase && typeof window.supabase.createClient === 'function') {
      client = window.supabase.createClient(url, key);
    }
    return client;
  }

  /* ---------- estado ---------- */
  function setStatus(msg, isError) {
    const el = $('td-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('is-error', !!isError);
  }

  function syncFields() {
    const t = $('td-type').value;
    $('td-field-dato').hidden      = t !== 'dato';
    $('td-field-enlace').hidden    = t !== 'enlace';
    $('td-field-documento').hidden = t !== 'documento';
  }

  /* ---------- carga ---------- */
  async function load() {
    if (!client || !user) return;
    setStatus('Cargando…');
    const { data, error } = await client
      .from(TABLE)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) { setStatus('Error al cargar: ' + error.message, true); return; }
    items = data || [];
    await render();
    setStatus('');
  }

  /* ---------- render ---------- */
  async function render() {
    const list = $('td-list');

    // URLs firmadas para los documentos (bucket privado)
    const docPaths = items.filter(i => i.type === 'documento').map(i => i.value);
    const urls = {};
    if (docPaths.length && client) {
      const { data } = await client.storage.from(BUCKET).createSignedUrls(docPaths, 3600);
      (data || []).forEach(d => { if (d && d.signedUrl) urls[d.path] = d.signedUrl; });
    }

    // datalist de etiquetas
    const tags = [...new Set(items.map(i => i.tag).filter(Boolean))].sort();
    $('td-tags').innerHTML = tags.map(t => `<option value="${esc(t)}">`).join('');

    if (!items.length) {
      list.innerHTML = `<p class="td-empty">Todavía no has añadido nada. Sube un documento, guarda un dato o pega un enlace.</p>`;
      return;
    }

    const groups = [
      ['documento', '📄 Documentos'],
      ['dato',      '🔧 Datos técnicos'],
      ['enlace',    '🔗 Enlaces']
    ];

    list.innerHTML = groups.map(([type, label]) => {
      const rows = items.filter(i => i.type === type);
      if (!rows.length) return '';

      const html = rows.map(it => {
        let main = '';
        if (it.type === 'enlace') {
          main = `<a class="td-link" href="${esc(it.value)}" target="_blank" rel="noopener noreferrer">Abrir enlace ↗</a>`;
        } else if (it.type === 'documento') {
          const u = urls[it.value];
          main = u
            ? `<a class="td-link" href="${esc(u)}" target="_blank" rel="noopener noreferrer">Descargar ⬇</a>`
            : `<span class="td-muted">Archivo no disponible</span>`;
        } else {
          main = `<span class="td-value">${esc(it.value)}</span>`;
        }

        return `<div class="td-item">
          <div class="td-item-main">
            <div class="td-item-title">${esc(it.title)}</div>
            ${it.tag   ? `<div class="td-item-tag">🚗 ${esc(it.tag)}</div>` : ''}
            ${it.notes ? `<div class="td-item-notes">${esc(it.notes)}</div>` : ''}
            ${it.file_name ? `<div class="td-item-notes">${esc(it.file_name)}</div>` : ''}
            ${main}
          </div>
          <button type="button" class="btn ghost sm td-del" data-id="${esc(it.id)}">Eliminar</button>
        </div>`;
      }).join('');

      return `<div class="td-group"><h3>${label}</h3>${html}</div>`;
    }).join('');
  }

  /* ---------- guardar ---------- */
  async function onSubmit(e) {
    e.preventDefault();
    if (!client || !user) { setStatus('Sesión no disponible.', true); return; }

    const type    = $('td-type').value;
    const title   = $('td-title').value.trim();
    const tag     = $('td-tag').value.trim();
    const notes   = $('td-notes').value.trim();
    const btn     = $('td-submit');

    if (!title) { setStatus('El título es obligatorio.', true); return; }

    let value = '', file_name = null, uploadedPath = null;

    if (type === 'dato') {
      value = $('td-value').value.trim();
      if (!value) { setStatus('Escribe el dato a guardar.', true); return; }

    } else if (type === 'enlace') {
      value = $('td-url').value.trim();
      if (!/^https?:\/\/\S+$/i.test(value)) {
        setStatus('La URL debe empezar por http:// o https://', true); return;
      }

    } else {
      const file = $('td-file').files[0];
      if (!file) { setStatus('Selecciona un archivo.', true); return; }
      if (file.size > MAX_MB * 1024 * 1024) {
        setStatus(`El archivo supera los ${MAX_MB} MB.`, true); return;
      }

      btn.disabled = true;
      setStatus('Subiendo archivo…');

      const safe = file.name.replace(/[^\w.\-]+/g, '_');
      uploadedPath = `${user.id}/${Date.now()}-${safe}`;

      const { error: upErr } = await client.storage
        .from(BUCKET)
        .upload(uploadedPath, file, { upsert: false, contentType: file.type || 'application/octet-stream' });

      if (upErr) {
        btn.disabled = false;
        setStatus('Error al subir: ' + upErr.message, true);
        return;
      }
      value = uploadedPath;
      file_name = file.name;
    }

    setStatus('Guardando…');
    const { error } = await client.from(TABLE).insert({
      user_id: user.id,
      type,
      title,
      tag: tag || null,
      notes: notes || null,
      value,
      file_name
    });

    btn.disabled = false;

    if (error) {
      if (uploadedPath) await client.storage.from(BUCKET).remove([uploadedPath]);
      setStatus('Error al guardar: ' + error.message, true);
      return;
    }

    $('td-form').reset();
    syncFields();
    setStatus('Guardado ✓');
    setTimeout(() => setStatus(''), 2000);
    await load();
  }

  /* ---------- eliminar ---------- */
  async function removeItem(id) {
    const it = items.find(i => i.id === id);
    if (!it || !client || !user) return;
    if (!confirm(`¿Eliminar «${it.title}»?`)) return;

    const { error } = await client.from(TABLE)
      .delete().eq('id', id).eq('user_id', user.id);

    if (error) { setStatus('Error al eliminar: ' + error.message, true); return; }

    if (it.type === 'documento' && it.value) {
      await client.storage.from(BUCKET).remove([it.value]);
    }
    await load();
  }

  /* ---------- arranque ---------- */
  function bindUI() {
    if (bound) return;
    bound = true;
    $('td-type').addEventListener('change', syncFields);
    $('td-form').addEventListener('submit', onSubmit);
    $('td-list').addEventListener('click', (e) => {
      const btn = e.target.closest('.td-del');
      if (btn) removeItem(btn.dataset.id);
    });
    syncFields();
  }

  async function init() {
    const c = getClient();
    if (!c) { console.warn('[technical] Cliente Supabase no disponible'); return; }

    bindUI();

    const { data } = await c.auth.getSession();
    user = data && data.session ? data.session.user : null;

    if (user) { await load(); }

    c.auth.onAuthStateChange((_evt, session) => {
      const next = session ? session.user : null;
      const changed = (next && next.id) !== (user && user.id);
      user = next;
      if (user) { if (changed) load(); }
      else { items = []; $('td-list').innerHTML = ''; setStatus(''); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();