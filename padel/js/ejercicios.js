// ============================================
// Diseñador de pista de pádel interactiva (SVG)
// ============================================

const SVG_NS = 'http://www.w3.org/2000/svg'

const COURT = {
  xMin: 85,
  xMax: 855,
  yMin: 85,
  yMax: 455,
  centerX: 470,
  centerY: 270,
  netX: 470
}

// Mapa de iconos con rotación inicial por tipo
const MAPA_ICONOS = {
  'jugador-azul-0':   { icon: '#icon-jugador-azul', rot: 0 },
  'jugador-azul-90':  { icon: '#icon-jugador-azul', rot: 90 },
  'jugador-azul-180': { icon: '#icon-jugador-azul', rot: 180 },
  'jugador-azul-270': { icon: '#icon-jugador-azul', rot: 270 },
  'jugador-rojo-0':   { icon: '#icon-jugador-rojo', rot: 0 },
  'jugador-rojo-90':  { icon: '#icon-jugador-rojo', rot: 90 },
  'jugador-rojo-180': { icon: '#icon-jugador-rojo', rot: 180 },
  'jugador-rojo-270': { icon: '#icon-jugador-rojo', rot: 270 },
  'carro-bolas':      { icon: '#icon-carro',        rot: 0 },
  'cono':             { icon: '#icon-cono',         rot: 0 },
  'escalera':         { icon: '#icon-escalera',     rot: 0 },
  'pelota':           { icon: '#icon-pelota',       rot: 0 },
  'flecha-recta':     { icon: '#icon-flecha',       rot: 0 }
}

let contadorIds = 0
const elementos = new Map()
let elementoSeleccionado = null
let arrastrando = null
let offsetX = 0
let offsetY = 0

let modo = 'idle' // 'idle' | 'trayectoria' | 'globo'
let puntosTrayectoria = []
let previewGroup = null

// ============================================
// Inicialización
// ============================================
export function inicializarPista(svgId) {
  const svg = document.getElementById(svgId)
  const capa = document.getElementById('capa-elementos')

  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tipo = btn.dataset.tipo
      if (tipo === 'trayectoria' || tipo === 'globo') {
        iniciarModoTrayectoria(tipo)
      } else {
        agregarElemento(tipo, COURT.centerX, COURT.centerY)
      }
    })
  })

  document.getElementById('btn-limpiar').addEventListener('click', () => {
    if (confirm('¿Limpiar toda la pista?')) {
      capa.innerHTML = ''
      elementos.clear()
      deseleccionar()
      cancelarTrayectoria()
    }
  })

  svg.addEventListener('click', (e) => {
    if (modo === 'trayectoria' || modo === 'globo') {
      e.stopPropagation()
      const pt = getSvgPoint(e, svg)
      puntosTrayectoria.push(pt)
      actualizarPreview()
      if (modo === 'globo' && puntosTrayectoria.length === 2) {
        finalizarTrayectoria()
      }
      return
    }
    const esFondo = e.target === svg ||
                    (e.target.tagName === 'rect' && !e.target.closest('[data-id]'))
    if (esFondo) deseleccionar()
  })

  svg.addEventListener('contextmenu', (e) => {
    if (modo === 'trayectoria' || modo === 'globo') {
      e.preventDefault()
      finalizarTrayectoria()
    }
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modo !== 'idle') cancelarTrayectoria()
    if ((e.key === 'Delete' || e.key === 'Backspace') && elementoSeleccionado) {
      const activo = document.activeElement
      const escribiendo = activo && (activo.tagName === 'INPUT' || activo.tagName === 'TEXTAREA')
      if (!escribiendo) {
        e.preventDefault()
        eliminarElemento(elementoSeleccionado)
      }
    }
  })

  activarSoporteTactil(svg)
}

// ============================================
// Modo dibujar (trayectoria o globo)
// ============================================
function iniciarModoTrayectoria(tipo) {
  cancelarTrayectoria()
  modo = tipo
  puntosTrayectoria = []

  const svg = document.getElementById('pista-svg')
  svg.classList.add('drawing')
  document.getElementById('capa-elementos').style.pointerEvents = 'none'

  const hint = document.getElementById('hint-trayectoria')
  if (hint) {
    hint.innerHTML = tipo === 'globo'
      ? '<strong>Globo (lob):</strong> toca inicio y fin del globo · <strong>Esc</strong> cancela'
      : '<strong>Trayectoria:</strong> toca para puntos · <strong>clic derecho</strong> termina · <strong>Esc</strong> cancela'
    hint.classList.add('visible')
  }

  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'))
  document.querySelector(`.tool-btn[data-tipo="${tipo}"]`)?.classList.add('active')
}

function cancelarTrayectoria() {
  modo = 'idle'
  puntosTrayectoria = []
  if (previewGroup) {
    previewGroup.remove()
    previewGroup = null
  }
  const svg = document.getElementById('pista-svg')
  if (svg) svg.classList.remove('drawing')
  const capa = document.getElementById('capa-elementos')
  if (capa) capa.style.pointerEvents = 'auto'
  document.getElementById('hint-trayectoria')?.classList.remove('visible')
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'))
}

function finalizarTrayectoria() {
  if (modo === 'globo') {
    if (puntosTrayectoria.length >= 2) {
      crearGlobo(puntosTrayectoria[0], puntosTrayectoria[1])
    }
    cancelarTrayectoria()
    return
  }

  if (puntosTrayectoria.length >= 2) {
    crearTrayectoria([...puntosTrayectoria])
  }
  cancelarTrayectoria()
}

function calcularControlGlobo(p1, p2) {
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
  return { x: mid.x, y: mid.y - dist * 0.4 }
}

function actualizarPreview() {
  const capa = document.getElementById('capa-elementos')
  if (!previewGroup) {
    previewGroup = document.createElementNS(SVG_NS, 'g')
    previewGroup.classList.add('preview-trayectoria')
    capa.appendChild(previewGroup)
  }
  previewGroup.innerHTML = ''

  if (puntosTrayectoria.length === 0) return

  let d
  if (modo === 'globo' && puntosTrayectoria.length >= 2) {
    const p1 = puntosTrayectoria[0]
    const p2 = puntosTrayectoria[1]
    const ctrl = calcularControlGlobo(p1, p2)
    d = `M ${p1.x} ${p1.y} Q ${ctrl.x} ${ctrl.y} ${p2.x} ${p2.y}`
  } else {
    d = puntosTrayectoria.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  }

  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', d)
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', '#e8ff3a')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-dasharray', '5,3')
  path.setAttribute('opacity', '0.85')
  previewGroup.appendChild(path)

  puntosTrayectoria.forEach((p, i) => {
    const c = document.createElementNS(SVG_NS, 'circle')
    c.setAttribute('cx', p.x)
    c.setAttribute('cy', p.y)
    c.setAttribute('r', i === 0 ? '4' : '3')
    c.setAttribute('fill', '#e8ff3a')
    c.setAttribute('stroke', '#8a9900')
    c.setAttribute('stroke-width', '0.8')
    previewGroup.appendChild(c)
  })
}

// ============================================
// Crear elementos (con posición inicial en el centro)
// ============================================
function agregarElemento(tipo, x, y) {
  const capa = document.getElementById('capa-elementos')
  const info = MAPA_ICONOS[tipo]
  if (!info) return

  const id = `elem-${++contadorIds}`

  const g = document.createElementNS(SVG_NS, 'g')
  g.setAttribute('data-id', id)
  g.setAttribute('data-tipo', tipo)
  g.classList.add('elemento-pista')
  g.style.cursor = 'grab'
  g.setAttribute('transform', `translate(${x}, ${y}) rotate(${info.rot})`)

  const use = document.createElementNS(SVG_NS, 'use')
  use.setAttribute('href', info.icon)
  g.appendChild(use)

  g.addEventListener('mousedown', (e) => iniciarArrastre(e, id))
  g.addEventListener('click', (e) => { e.stopPropagation(); seleccionar(id) })
  g.addEventListener('dblclick', (e) => { e.stopPropagation(); eliminarElemento(id) })
  g.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    e.stopPropagation()
    eliminarElemento(id)
  })

  capa.appendChild(g)
  elementos.set(id, { tipo, x, y, rotacion: info.rot, element: g })

  seleccionar(id)
}

// ============================================
// Trayectoria (línea con pelota animada)
// ============================================
function crearTrayectoria(puntos) {
  const capa = document.getElementById('capa-elementos')
  const id = `elem-${++contadorIds}`

  const d = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const g = document.createElementNS(SVG_NS, 'g')
  g.setAttribute('data-id', id)
  g.setAttribute('data-tipo', 'trayectoria')
  g.classList.add('elemento-pista')
  g.style.cursor = 'grab'

  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', d)
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', '#e8ff3a')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-dasharray', '6,3')
  path.setAttribute('marker-end', 'url(#flecha-end)')
  g.appendChild(path)
  g.appendChild(crearPelotaAnimada(d))

  g.addEventListener('mousedown', (e) => iniciarArrastre(e, id))
  g.addEventListener('click', (e) => { e.stopPropagation(); seleccionar(id) })
  g.addEventListener('dblclick', (e) => { e.stopPropagation(); eliminarElemento(id) })
  g.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    e.stopPropagation()
    eliminarElemento(id)
  })

  capa.appendChild(g)
  elementos.set(id, {
    tipo: 'trayectoria',
    element: g,
    puntos,
    x: 0, y: 0, rotacion: 0
  })

  seleccionar(id)
}

// ============================================
// Globo (curva alta con pelota animada)
// ============================================
function crearGlobo(p1, p2) {
  const capa = document.getElementById('capa-elementos')
  const id = `elem-${++contadorIds}`

  const ctrl = calcularControlGlobo(p1, p2)
  const d = `M ${p1.x} ${p1.y} Q ${ctrl.x} ${ctrl.y} ${p2.x} ${p2.y}`

  const g = document.createElementNS(SVG_NS, 'g')
  g.setAttribute('data-id', id)
  g.setAttribute('data-tipo', 'globo')
  g.classList.add('elemento-pista')
  g.style.cursor = 'grab'

  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', d)
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', '#e8ff3a')
  path.setAttribute('stroke-width', '2.5')
  path.setAttribute('stroke-dasharray', '6,3')
  path.setAttribute('marker-end', 'url(#flecha-end)')
  g.appendChild(path)
  g.appendChild(crearPelotaAnimada(d))

  g.addEventListener('mousedown', (e) => iniciarArrastre(e, id))
  g.addEventListener('click', (e) => { e.stopPropagation(); seleccionar(id) })
  g.addEventListener('dblclick', (e) => { e.stopPropagation(); eliminarElemento(id) })
  g.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    e.stopPropagation()
    eliminarElemento(id)
  })

  capa.appendChild(g)
  elementos.set(id, {
    tipo: 'globo',
    element: g,
    p1, p2, ctrl,
    x: 0, y: 0, rotacion: 0
  })

  seleccionar(id)
}

// ============================================
// Pelota animada (compartida)
// ============================================
function crearPelotaAnimada(pathD) {
  const ball = document.createElementNS(SVG_NS, 'g')

  const ballCircle = document.createElementNS(SVG_NS, 'circle')
  ballCircle.setAttribute('r', '3.5')
  ballCircle.setAttribute('fill', '#e8ff3a')
  ballCircle.setAttribute('stroke', '#8a9900')
  ballCircle.setAttribute('stroke-width', '0.7')

  const seam1 = document.createElementNS(SVG_NS, 'path')
  seam1.setAttribute('d', 'M -3,-1.5 Q -1.2,0 -3,1.5')
  seam1.setAttribute('fill', 'none')
  seam1.setAttribute('stroke', '#8a9900')
  seam1.setAttribute('stroke-width', '0.5')

  const seam2 = document.createElementNS(SVG_NS, 'path')
  seam2.setAttribute('d', 'M 3,-1.5 Q 1.2,0 3,1.5')
  seam2.setAttribute('fill', 'none')
  seam2.setAttribute('stroke', '#8a9900')
  seam2.setAttribute('stroke-width', '0.5')

  ball.appendChild(ballCircle)
  ball.appendChild(seam1)
  ball.appendChild(seam2)

  const animate = document.createElementNS(SVG_NS, 'animateMotion')
  animate.setAttribute('dur', '2.5s')
  animate.setAttribute('repeatCount', 'indefinite')
  animate.setAttribute('path', pathD)
  ball.appendChild(animate)

  return ball
}

// ============================================
// Arrastre
// ============================================
function iniciarArrastre(e, id) {
  e.preventDefault()
  e.stopPropagation()
  arrastrando = id
  const elem = elementos.get(id)
  if (!elem) return

  const svg = document.getElementById('pista-svg')
  const svgP = getSvgPoint(e, svg)
  offsetX = svgP.x - elem.x
  offsetY = svgP.y - elem.y

  document.addEventListener('mousemove', moverElemento)
  document.addEventListener('mouseup', soltarElemento)
}

function moverElemento(e) {
  if (!arrastrando) return
  const elem = elementos.get(arrastrando)
  if (!elem) return

  const svg = document.getElementById('pista-svg')
  const svgP = getSvgPoint(e, svg)

  elem.x = Math.max(COURT.xMin, Math.min(COURT.xMax, svgP.x - offsetX))
  elem.y = Math.max(COURT.yMin, Math.min(COURT.yMax, svgP.y - offsetY))

  const rot = (elem.tipo === 'trayectoria' || elem.tipo === 'globo') ? 0 : elem.rotacion
  elem.element.setAttribute('transform',
    `translate(${elem.x}, ${elem.y}) rotate(${rot})`)

  reposicionarControlesSeleccion(elem)
}

function soltarElemento() {
  arrastrando = null
  document.removeEventListener('mousemove', moverElemento)
  document.removeEventListener('mouseup', soltarElemento)
}

// ============================================
// Selección + botón X de eliminar
// ============================================
function seleccionar(id) {
  deseleccionar()
  elementoSeleccionado = id
  const elem = elementos.get(id)
  if (!elem) return

  const panel = document.getElementById('panel-propiedades')
  const rotLabel = document.getElementById('rot-label')
  const slider = document.getElementById('prop-rotacion')
  const rotValor = document.getElementById('rot-valor')

  // Rectángulo de selección
  const bbox = elem.element.getBBox()
  const rectSel = document.createElementNS(SVG_NS, 'rect')
  rectSel.setAttribute('id', 'seleccion-rect')
  rectSel.setAttribute('x', bbox.x - 4)
  rectSel.setAttribute('y', bbox.y - 4)
  rectSel.setAttribute('width', bbox.width + 8)
  rectSel.setAttribute('height', bbox.height + 8)
  rectSel.setAttribute('fill', 'none')
  rectSel.setAttribute('stroke', '#e8ff3a')
  rectSel.setAttribute('stroke-width', '1.5')
  rectSel.setAttribute('stroke-dasharray', '4,3')
  rectSel.setAttribute('pointer-events', 'none')

  const transform = elem.element.getAttribute('transform') || 'translate(0,0)'
  rectSel.setAttribute('transform', transform)
  document.getElementById('capa-elementos').appendChild(rectSel)

  // Botón X de eliminar (más grande, sin rotar)
  const btnX = document.createElementNS(SVG_NS, 'g')
  btnX.setAttribute('id', 'btn-x-eliminar')
  btnX.style.cursor = 'pointer'
  btnX.style.pointerEvents = 'auto'

  const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/)
  const tx = match ? parseFloat(match[1]) : 0
  const ty = match ? parseFloat(match[2]) : 0
  btnX.setAttribute('transform', `translate(${tx}, ${ty})`)

  const cx = bbox.x + bbox.width + 10
  const cy = bbox.y - 10

  const circulo = document.createElementNS(SVG_NS, 'circle')
  circulo.setAttribute('cx', cx)
  circulo.setAttribute('cy', cy)
  circulo.setAttribute('r', 12)
  circulo.setAttribute('fill', '#c0392b')
  circulo.setAttribute('stroke', 'white')
  circulo.setAttribute('stroke-width', '2.5')
  circulo.setAttribute('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))')

  const halo = document.createElementNS(SVG_NS, 'circle')
  halo.setAttribute('cx', cx)
  halo.setAttribute('cy', cy)
  halo.setAttribute('r', 20)
  halo.setAttribute('fill', 'transparent')

  const texto = document.createElementNS(SVG_NS, 'text')
  texto.setAttribute('x', cx)
  texto.setAttribute('y', cy + 6)
  texto.setAttribute('text-anchor', 'middle')
  texto.setAttribute('font-size', '18')
  texto.setAttribute('font-weight', 'bold')
  texto.setAttribute('fill', 'white')
  texto.setAttribute('pointer-events', 'none')
  texto.setAttribute('font-family', 'sans-serif')
  texto.textContent = '×'

  btnX.appendChild(halo)
  btnX.appendChild(circulo)
  btnX.appendChild(texto)

  btnX.addEventListener('mousedown', (e) => e.stopPropagation())
  btnX.addEventListener('click', (e) => {
    e.stopPropagation()
    e.preventDefault()
    eliminarElemento(id)
  })
  btnX.addEventListener('touchstart', (e) => {
    e.stopPropagation()
    e.preventDefault()
    eliminarElemento(id)
  }, { passive: false })

  document.getElementById('capa-elementos').appendChild(btnX)

  // Panel de propiedades (solo elementos rotables)
  if (elem.tipo !== 'trayectoria' && elem.tipo !== 'globo') {
    rotLabel.style.display = 'block'
    slider.value = elem.rotacion
    rotValor.textContent = elem.rotacion + '°'

    slider.oninput = (ev) => {
      elem.rotacion = parseInt(ev.target.value)
      rotValor.textContent = elem.rotacion + '°'
      elem.element.setAttribute('transform',
        `translate(${elem.x}, ${elem.y}) rotate(${elem.rotacion})`)
      reposicionarControlesSeleccion(elem)
    }
  } else {
    rotLabel.style.display = 'none'
  }

  panel.style.display = 'block'

  document.getElementById('btn-eliminar-elemento').onclick = () => {
    eliminarElemento(id)
  }
}

function eliminarElemento(id) {
  const elem = elementos.get(id)
  if (!elem) return
  elem.element.remove()
  elementos.delete(id)
  deseleccionar()
}

function reposicionarControlesSeleccion(elem) {
  const rectSel = document.getElementById('seleccion-rect')
  const btnX = document.getElementById('btn-x-eliminar')
  if (!rectSel || !btnX) return

  const bbox = elem.element.getBBox()
  rectSel.setAttribute('x', bbox.x - 4)
  rectSel.setAttribute('y', bbox.y - 4)
  rectSel.setAttribute('width', bbox.width + 8)
  rectSel.setAttribute('height', bbox.height + 8)

  const transform = elem.element.getAttribute('transform') || 'translate(0,0)'
  rectSel.setAttribute('transform', transform)

  const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/)
  const tx = match ? parseFloat(match[1]) : 0
  const ty = match ? parseFloat(match[2]) : 0
  btnX.setAttribute('transform', `translate(${tx}, ${ty})`)

  const cx = bbox.x + bbox.width + 10
  const cy = bbox.y - 10

  const circulo = btnX.querySelector('circle:not([fill="transparent"])')
  const halo = btnX.querySelector('circle[fill="transparent"]')
  const texto = btnX.querySelector('text')
  if (circulo && texto) {
    circulo.setAttribute('cx', cx)
    circulo.setAttribute('cy', cy)
    texto.setAttribute('x', cx)
    texto.setAttribute('y', cy + 6)
  }
  if (halo) {
    halo.setAttribute('cx', cx)
    halo.setAttribute('cy', cy)
  }
}

function deseleccionar() {
  document.getElementById('seleccion-rect')?.remove()
  document.getElementById('btn-x-eliminar')?.remove()
  elementoSeleccionado = null
  const panel = document.getElementById('panel-propiedades')
  if (panel) panel.style.display = 'none'
}

// ============================================
// Utilidades
// ============================================
function getSvgPoint(e, svg) {
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const p = pt.matrixTransform(svg.getScreenCTM().inverse())
  return { x: Math.round(p.x), y: Math.round(p.y) }
}

// ============================================
// Soporte táctil
// ============================================
function activarSoporteTactil(svg) {
  svg.addEventListener('touchstart', (e) => {
    if (e.target.closest('#btn-x-eliminar')) return

    if (modo === 'trayectoria' || modo === 'globo') {
      const touch = e.touches[0]
      const pt = getSvgPoint({ clientX: touch.clientX, clientY: touch.clientY }, svg)
      puntosTrayectoria.push(pt)
      actualizarPreview()
      if (modo === 'globo' && puntosTrayectoria.length === 2) {
        finalizarTrayectoria()
      }
      e.preventDefault()
      return
    }
    const target = e.target.closest('[data-id]')
    if (!target) return
    const id = target.getAttribute('data-id')
    const touch = e.touches[0]
    const fakeMouse = {
      preventDefault: () => e.preventDefault(),
      stopPropagation: () => e.stopPropagation(),
      clientX: touch.clientX,
      clientY: touch.clientY
    }
    iniciarArrastre(fakeMouse, id)
  }, { passive: false })

  svg.addEventListener('touchmove', (e) => {
    if (!arrastrando) return
    e.preventDefault()
    const touch = e.touches[0]
    moverElemento({ clientX: touch.clientX, clientY: touch.clientY })
  }, { passive: false })

  svg.addEventListener('touchend', () => {
    if (arrastrando) soltarElemento()
  })
}

// ============================================
// Exportar datos
// ============================================
export function obtenerDatosPista() {
  const datos = []
  elementos.forEach((valor, id) => {
    if (valor.tipo === 'trayectoria') {
      datos.push({
        id, tipo: 'trayectoria',
        puntos: valor.puntos.map(p => ({
          x: Math.round(p.x * 100) / 100,
          y: Math.round(p.y * 100) / 100
        })),
        dx: Math.round(valor.x * 100) / 100,
        dy: Math.round(valor.y * 100) / 100
      })
    } else if (valor.tipo === 'globo') {
      datos.push({
        id, tipo: 'globo',
        p1: { x: Math.round(valor.p1.x * 100) / 100, y: Math.round(valor.p1.y * 100) / 100 },
        p2: { x: Math.round(valor.p2.x * 100) / 100, y: Math.round(valor.p2.y * 100) / 100 },
        dx: Math.round(valor.x * 100) / 100,
        dy: Math.round(valor.y * 100) / 100
      })
    } else {
      datos.push({
        id, tipo: valor.tipo,
        x: Math.round(valor.x * 100) / 100,
        y: Math.round(valor.y * 100) / 100,
        rotacion: valor.rotacion
      })
    }
  })
  return datos
}

// ============================================
// Cargar desde datos guardados
// ============================================
export function cargarDesdeDatos(datos) {
  const capa = document.getElementById('capa-elementos')
  capa.innerHTML = ''
  elementos.clear()
  deseleccionar()

  ;(datos || []).forEach(item => {
    if (item.tipo === 'trayectoria') {
      crearTrayectoria(item.puntos)
    } else if (item.tipo === 'globo') {
      crearGlobo(item.p1, item.p2)
    } else {
      agregarElemento(item.tipo, item.x, item.y)
      const ids = Array.from(elementos.keys())
      const ultimo = elementos.get(ids[ids.length - 1])
      if (ultimo && item.rotacion) {
        ultimo.rotacion = item.rotacion
        ultimo.element.setAttribute('transform',
          `translate(${ultimo.x}, ${ultimo.y}) rotate(${ultimo.rotacion})`)
      }
    }
  })

  deseleccionar()
}