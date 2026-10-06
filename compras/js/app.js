import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------- Helpers ---------- */
export function h(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/** YYYY-MM-DD en hora LOCAL (sin desfase UTC) */
function fmtYMD(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Lunes de la semana (semana de lunes a domingo) */
export function weekStart(d = null) {
  const dt = d ? new Date(d + 'T00:00:00') : new Date();
  const day = dt.getDay();                 // 0=dom, 1=lun …
  const diff = (day === 0 ? -6 : 1 - day); // lunes como primer día
  dt.setDate(dt.getDate() + diff);
  return fmtYMD(dt);
}

export function addDays(ymd, n) {
  const d = new Date(ymd + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return fmtYMD(d);
}

/**
 * Formatea números con coma decimal (es-ES) y un máximo de 2 decimales.
 */
export function fmt(n) {
  if (n === null || n === undefined || n === '') return '';
  const num = Number(n);
  if (!isFinite(num)) return '';
  return num.toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
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
  if (n === null || n === undefined || n === '') return '';
  const num = Number(n);
  if (!isFinite(num)) return '';
  return num.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';
}

/* ---------- Navegación común (rutas relativas) ----------
   Cada item tiene:
     icono → se muestra siempre (y en móvil es lo único visible)
     label → texto completo (escritorio)
     short → abreviatura corta en móvil (opcional, oculta por defecto) */
export function renderHeader(active) {
  const items = [
    { key: 'calendario',   href: 'index.html',        icono: '📅', label: 'Calendario' },
    { key: 'menus',        href: 'menus.html',        icono: '📖', label: 'Menús' },
    { key: 'ingredientes', href: 'ingredientes.html', icono: '🥕', label: 'Ingredientes' },
    { key: 'lista',        href: 'lista.html',        icono: '🛒', label: 'Lista de la compra' },
    { key: 'recetas',      href: 'recetas.html',      icono: '🍽️', label: 'Recetas' },
  ];
  const header = document.createElement('header');
  header.innerHTML = `
    <h1 class="brand-title">Hacienda Ale y Rafa</h1>
    <nav>
      ${items.map(i => `
        <a href="${i.href}" class="${active === i.key ? 'active' : ''}"
           title="${i.label}" aria-label="${i.label}">
          <span class="nav-icono">${i.icono}</span>
          <span class="nav-texto">${i.label}</span>
        </a>`).join('')}
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