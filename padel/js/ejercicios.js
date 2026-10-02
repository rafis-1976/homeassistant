// ============================================
// Diseñador de pista de pádel interactiva (SVG)
// ============================================

const SVG_NS = 'http://www.w3.org/2000/svg'

// Pista oficial 20m × 10m dentro de viewBox 900×500
// Court jugable: (50,50) → (850,450)
const COURT = {
  xMin: 85,
  xMax: 855,
  yMin: 85,
  yMax: 455,
  centerX: 470,
  centerY: 270,
  netX: 470
}

let contadorIds = 0
const elementos = new Map()
let elementoSeleccionado = null
let arrastrando = null
let offsetX = 0
let offsetY = 0

let modo = 'idle'
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
      if (tipo === 'trayectoria') {
        iniciarModoTrayectoria()
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
    if (modo === 'trayectoria') {
      e.stopPropagation()
      const pt = getSvgPoint(e, svg)
      puntosTrayectoria.push(pt)
      actualizarPreview()
      return
    }
    const esFondo = e.target === svg ||
                    (e.target.tagName === 'rect' && !e.target.closest('[data-id]'))
    if (esFondo) deseleccionar()
  })

  svg.addEventListener('contextmenu', (e) => {
    if (modo === 'trayectoria') {
      e.preventDefault()
      finalizarTrayectoria()
    }
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modo === 'trayectoria') cancelarTrayectoria()
  })

  // Soporte táctil
  activarSoporteTactil(svg)
}

// ============================================
// Modo trayectoria
// ============================================
function iniciarModoTrayectoria() {
  cancelarTrayectoria()
  modo = 'trayectoria'
  puntosTrayectoria = []

  const svg = document.getElementById('pista-svg')
  svg.classList.add('drawing')
  document.getElementById('capa-elementos').style.pointerEvents = 'none'
  document.getElementById('hint-trayectoria').classList.add('visible')

  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'))
  document.querySelector('.tool-btn[data-tipo="trayectoria"]')?.classList.add('active')
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
  if (puntosTrayectoria.length < 2) {
    cancelarTrayectoria()
    return
  }
  crearTrayectoria(puntosTrayectoria)
  cancelarTrayectoria()
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

  const d = puntosTrayectoria.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', d)
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', '#e8ff3a')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-dasharray', '5,3')
  path.setAttribute('opacity', '0.8')
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
// Crear elementos
// ============================================
function agregarElemento(tipo, x, y) {
  const capa = document.getElementById('capa-elementos')
  const id = `elem-${++contadorIds}`

  const g = document.createElementNS(SVG_NS, 'g')
  g.setAttribute('data-id', id)
  g.setAttribute('data-tipo', tipo)
  g.classList.add('elemento-pista')
  g.style.cursor = 'grab'

  const use = document.createElementNS(SVG_NS, 'use')
  const mapaIconos = {
    'jugador-azul':  '#icon-jugador-azul',
    'jugador-rojo':  '#icon-jugador-rojo',
    'carro-bolas':   '#icon-carro',
    'cono':          '#icon-cono',
    'seta':          '#icon-escalera',
    'pelota':        '#icon-pelota',
    'flecha-recta':  '#icon-flecha'
  }
  if (mapaIconos[tipo]) use.setAttribute('href', mapaIconos[tipo])
  g.appendChild(use)

  g.addEventListener('mousedown', (e) => iniciarArrastre(e, id))
  g.addEventListener('click', (e) => { e.stopPropagation(); seleccionar(id) })

  capa.appendChild(g)
  elementos.set(id, { tipo, x, y, rotacion: 0, element: g })
}

// ============================================
// Trayectoria con pelota animada
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

  const ball = document.createElementNS(SVG_NS, 'g')
  const ballCircle = document.createElementNS(SVG_NS, 'circle')
  ballCircle.setAttribute('r', '5')
  ballCircle.setAttribute('fill', '#e8ff3a')
  ballCircle.setAttribute('stroke', '#8a9900')
  ballCircle.setAttribute('stroke-width', '1')
  const seam1 = document.createElementNS(SVG_NS, 'path')
  seam1.setAttribute('d', 'M -4,-3 Q -1,0 -4,3')
  seam1.setAttribute('fill', 'none')
  seam1.setAttribute('stroke', '#8a9900')
  seam1.setAttribute('stroke-width', '0.8')
  const seam2 = document.createElementNS(SVG_NS, 'path')
  seam2.setAttribute('d', 'M 4,-3 Q 1,0 4,3')
  seam2.setAttribute('fill', 'none')
  seam2.setAttribute('stroke', '#8a9900')
  seam2.setAttribute('stroke-width', '0.8')
  ball.appendChild(ballCircle)
  ball.appendChild(seam1)
  ball.appendChild(seam2)

  const animate = document.createElementNS(SVG_NS, 'animateMotion')
  animate.setAttribute('dur', '2.5s')
  animate.setAttribute('repeatCount', 'indefinite')
  animate.setAttribute('path', d)
  ball.appendChild(animate)

  g.appendChild(ball)

  g.addEventListener('mousedown', (e) => iniciarArrastre(e, id))
  g.addEventListener('click', (e) => { e.stopPropagation(); seleccionar(id) })

  capa.appendChild(g)
  elementos.set(id, { tipo: 'trayectoria', element: g, puntos, x: 0, y: 0, rotacion: 0 })
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

  const rot = elem.tipo === 'trayectoria' ? 0 : elem.rotacion
  elem.element.setAttribute('transform',
    `translate(${elem.x}, ${elem.y}) rotate(${rot})`)

  const rectSel = document.getElementById('seleccion-rect')
  if (rectSel) rectSel.setAttribute('transform', elem.element.getAttribute('transform'))
}

function soltarElemento() {
  arrastrando = null
  document.removeEventListener('mousemove', moverElemento)
  document.removeEventListener('mouseup', soltarElemento)
}

// ============================================
// Selección
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

  if (elem.tipo !== 'trayectoria') {
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
    rectSel.setAttribute('transform', elem.element.getAttribute('transform') || '')
    document.getElementById('capa-elementos').appendChild(rectSel)

    rotLabel.style.display = 'block'
    slider.value = elem.rotacion
    rotValor.textContent = elem.rotacion + '°'

    slider.oninput = (ev) => {
      elem.rotacion = parseInt(ev.target.value)
      rotValor.textContent = elem.rotacion + '°'
      elem.element.setAttribute('transform',
        `translate(${elem.x}, ${elem.y}) rotate(${elem.rotacion})`)
      rectSel.setAttribute('transform', elem.element.getAttribute('transform'))
    }
  } else {
    rotLabel.style.display = 'none'
  }

  panel.style.display = 'block'

  document.getElementById('btn-eliminar-elemento').onclick = () => {
    elem.element.remove()
    elementos.delete(id)
    deseleccionar()
  }
}

function deseleccionar() {
  document.getElementById('seleccion-rect')?.remove()
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
    // En modo trayectoria, permitir tap para añadir punto
    if (modo === 'trayectoria') {
      const touch = e.touches[0]
      const pt = getSvgPoint({ clientX: touch.clientX, clientY: touch.clientY }, svg)
      puntosTrayectoria.push(pt)
      actualizarPreview()
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
        id,
        tipo: 'trayectoria',
        puntos: valor.puntos.map(p => ({
          x: Math.round(p.x * 100) / 100,
          y: Math.round(p.y * 100) / 100
        })),
        dx: Math.round(valor.x * 100) / 100,
        dy: Math.round(valor.y * 100) / 100
      })
    } else {
      datos.push({
        id,
        tipo: valor.tipo,
        x: Math.round(valor.x * 100) / 100,
        y: Math.round(valor.y * 100) / 100,
        rotacion: valor.rotacion
      })
    }
  })
  return datos
}

// ============================================
// Reconstruir pista desde datos guardados
// ============================================
export function cargarDesdeDatos(datos) {
  const capa = document.getElementById('capa-elementos')
  capa.innerHTML = ''
  elementos.clear()
  deseleccionar()

  ;(datos || []).forEach(item => {
    if (item.tipo === 'trayectoria') {
      crearTrayectoria(item.puntos)
      const ids = Array.from(elementos.keys())
      const ultimo = elementos.get(ids[ids.length - 1])
      if (ultimo && (item.dx || item.dy)) {
        ultimo.x = item.dx || 0
        ultimo.y = item.dy || 0
        ultimo.element.setAttribute('transform',
          `translate(${ultimo.x}, ${ultimo.y})`)
      }
    } else {
      agregarElemento(item.tipo, item.x, item.y)
      const ids = Array.from(elementos.keys())
      const ultimo = elementos.get(ids[ids.length - 1])
      if (ultimo) {
        ultimo.rotacion = item.rotacion || 0
        ultimo.element.setAttribute('transform',
          `translate(${ultimo.x}, ${ultimo.y}) rotate(${ultimo.rotacion})`)
      }
    }
  })
}