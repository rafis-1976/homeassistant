// ============================================
// Sidebar compartido en todas las páginas
// ============================================
export function renderNav(activa) {
  const paginas = [
    { id: 'dashboard',   label: '📊 Dashboard',    href: 'dashboard.html' },
    { id: 'calendario',  label: '📅 Calendario',   href: 'calendario.html' },
    { id: 'alumnos',     label: '👥 Alumnos',      href: 'alumnos.html' },
    { id: 'ejercicios',  label: '🎾 Ejercicios',   href: 'ejercicios.html' },
    { id: 'progreso',    label: '📈 Progreso',     href: 'progreso.html' },
    { id: 'faltas',      label: '⚠️ Faltas',       href: 'faltas.html' },
    { id: 'precios',     label: '💰 Precios',      href: 'precios.html' },
    { id: 'anulaciones', label: '🚫 Anulaciones',  href: 'anulaciones.html' },
  ]

  const nav = document.querySelector('.sidebar')
  if (!nav) return

  nav.innerHTML = `
    <div class="nav-brand">🎾 Padel Manager</div>
    <ul class="nav-links">
      ${paginas.map(p => `
        <li>
          <a href="${p.href}" class="${p.id === activa ? 'active' : ''}">${p.label}</a>
        </li>
      `).join('')}
    </ul>
  `
}