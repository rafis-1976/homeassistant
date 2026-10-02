// ============================================
// Sidebar compartido con menú hamburguesa responsive
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

  const activaLabel = paginas.find(p => p.id === activa)?.label || 'Padel Manager'

  // Insertar topbar (visible solo en móvil) antes del sidebar
  const layout = document.querySelector('.layout')
  const sidebar = document.querySelector('.sidebar')
  if (!layout || !sidebar) return

  // Topbar
  const topbar = document.createElement('div')
  topbar.className = 'topbar'
  topbar.innerHTML = `
    <button class="hamburger" id="btn-hamburger" aria-label="Abrir menú">☰</button>
    <div class="topbar-title">${activaLabel}</div>
  `
  layout.insertBefore(topbar, sidebar)

  // Overlay
  const overlay = document.createElement('div')
  overlay.className = 'sidebar-overlay'
  overlay.id = 'sidebar-overlay'
  document.body.appendChild(overlay)

  // Contenido del sidebar
  sidebar.innerHTML = `
    <div class="nav-brand">🎾 Padel Manager</div>
    <ul class="nav-links">
      ${paginas.map(p => `
        <li>
          <a href="${p.href}" class="${p.id === activa ? 'active' : ''}">${p.label}</a>
        </li>
      `).join('')}
    </ul>
  `

  // Lógica del menú
  const btnHamburger = document.getElementById('btn-hamburger')

  function abrirMenu() {
    sidebar.classList.add('open')
    overlay.classList.add('visible')
    document.body.style.overflow = 'hidden'
  }
  function cerrarMenu() {
    sidebar.classList.remove('open')
    overlay.classList.remove('visible')
    document.body.style.overflow = ''
  }

  btnHamburger?.addEventListener('click', abrirMenu)
  overlay.addEventListener('click', cerrarMenu)

  // Cerrar al navegar
  sidebar.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', cerrarMenu)
  })

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarMenu()
  })

  // Cerrar al cambiar a desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) cerrarMenu()
  })
}