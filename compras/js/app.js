import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------- Helpers ---------- */
export function h(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

export function weekStart(d = null) {
  const dt = d ? new Date(d + 'T00:00:00') : new Date();
  const day = dt.getDay();              // 0=dom, 1=lun...
  const diff = (day === 0 ? -6 : 1 - day);
  dt.setDate(dt.getDate() + diff);
  return dt.toISOString().slice(0, 10);
}

export function addDays(ymd, n) {
  const d = new Date(ymd + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmt(n) {
  if (n == null) return '';
  const num = Number(n);
  if (Number.isInteger(num)) return String(num);
  return num.toFixed(2).replace('.', ',').replace(/,?0+$/, '');
}

export function diaEs(ymd) {
  const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  return dias[new Date(ymd + 'T00:00:00').getDay()];
}

export function fmtFecha(ymd) {
  const d = new Date(ymd + 'T00:00:00');
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

export function money(n) {
  return Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/* ---------- Navegación común (rutas relativas) ---------- */
export function renderHeader(active) {
  const items = [
    { key: 'calendario',   href: 'index.html',        label: '📅 Calendario' },
    { key: 'menus',        href: 'menus.html',        label: '📖 Menús' },
    { key: 'ingredientes', href: 'ingredientes.html', label: '🥕 Ingredientes' },
    { key: 'lista',        href: 'lista.html',        label: '🛒 Lista de la compra' },
  ];
  const header = document.createElement('header');
  header.innerHTML = `
    <h1>🍽️ Planificador de comidas</h1>
    <nav>
      ${items.map(i => `<a href="${i.href}" class="${active === i.key ? 'active' : ''}">${i.label}</a>`).join('')}
    </nav>`;
  document.body.insertBefore(header, document.body.firstChild);
}

/* ---------- Toast global ---------- */
export function toast(msg, error = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (error ? ' error' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => t.remove(), 2200);
}

/* ---------- Regenerar lista de la compra ---------- */
export async function regenerarLista(semana) {
  // 1. Borrar ítems automáticos de esa semana
  {
    const { error } = await sb.from('compras_lista')
      .delete()
      .eq('semana_inicio', semana)
      .eq('manual', false);
    if (error) throw error;
  }

  // 2. Traer calendario de la semana con menús e ingredientes anidados
  const desde = semana;
  const hasta = addDays(semana, 6);
  const { data: cal, error: errCal } = await sb.from('compras_calendario')
    .select(`
      comensales,
      compras_menus (
        raciones,
        compras_menu_ingredientes ( ingrediente_id, cantidad )
      )
    `)
    .gte('fecha', desde)
    .lte('fecha', hasta);
  if (errCal) throw errCal;

  // 3. Agregar cantidades
  const agg = {};
  for (const row of (cal || [])) {
    const raciones = row.compras_menus?.raciones || 1;
    const factor   = (row.comensales || 1) / raciones;
    for (const mi of (row.compras_menus?.compras_menu_ingredientes || [])) {
      agg[mi.ingrediente_id] = (agg[mi.ingrediente_id] || 0) + Number(mi.cantidad) * factor;
    }
  }

  const ids = Object.keys(agg).map(Number);
  if (ids.length === 0) return { insertados: 0 };

  // 4. Coger tienda de cada ingrediente
  const { data: ings, error: errIng } = await sb.from('compras_ingredientes')
    .select('id, tienda_id')
    .in('id', ids);
  if (errIng) throw errIng;
  const tiendaMap = Object.fromEntries((ings || []).map(i => [i.id, i.tienda_id]));

  // 5. Insertar
  const rows = ids.map(id => ({
    ingrediente_id: id,
    cantidad:       Math.round(agg[id] * 100) / 100,
    tienda_id:      tiendaMap[id] ?? null,
    semana_inicio:  semana,
    manual:         false,
  }));
  const { error: errIns } = await sb.from('compras_lista').insert(rows);
  if (errIns) throw errIns;
  return { insertados: rows.length };
}