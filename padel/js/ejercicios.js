// ============================================
// Diseñador de pista de pádel interactiva (SVG)
// ============================================

let contadorIds = 0
const elementos = new Map()
let elementoSeleccionado = null
let arrastrando = null
let offsetX = 0
let offsetY = 0

export function inicializarPista(svgId) {
  const svg = document.getElementById(svgId)

  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => agregarElemento(btn.dataset.tipo, 200, 100))
  })

  document.getElementById('btn-limpiar').addEventListener('click', () => {
    if (confirm('¿Limpiar toda la pista?')) {
      document.getElementById('capa-elementos').innerHTML = ''
      elementos.clear()
      deseleccionar()
    }
  })

  svg.addEventListener('click', (e) => {
    if (e.target === svg || (e.target.tagName === 'rect' && !e.target.dataset.id)) {
      deseleccionar()
    }
  })

  return { svg }
}

function agregarElemento(tipo, x, y) {
  const capa = document.getElementById('capa-elementos')
  const id = `elem-${++contadorIds}`

  let element
  switch(tipo) {
    case 'jugador-azul':  element = crearJugador(x, y, '#3a8fbf', '#1a3a5c'); break
    case 'jugador-rojo':  element = crearJugador(x, y, '#c0392b', '#7a1a1a'); break
    case 'carro-bolas':   element = crearCarroBolas(x, y); break
    case 'cono':          element = crearCono(x, y); break
    case 'seta':          element = crearSeta(x, y); break
    case 'flecha-recta':  element = crearFlechaRecta(x, y); break
    case 'flecha-curva':  element = crearFlechaCurva(x, y); break
    default: return
  }

  element.setAttribute('data-id', id)
  element.setAttribute('data-tipo', tipo)
  element.style.cursor = 'grab'

  element.addEventListener('mousedown', (e) => iniciarArrastre(e, id))
  element.addEventListener('click', (e) => { e.stopPropagation(); seleccionar(id) })

  capa.appendChild(element)
  elementos.set(id, { tipo, x, y, rotacion: 0, element })
}

// ============================================
// Creadores de iconos
// ============================================

function crearJugador(x, y, colorPrincipal, colorBorde) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  g.setAttribute('transform', `translate(${x}, ${y})`)

  const circulo = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  circulo.setAttribute('r', 10)
  circulo.setAttribute('fill', colorPrincipal)
  circulo.setAttribute('stroke', colorBorde)
  circulo.setAttribute('stroke-width', 2)

  const raqueta = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
  raqueta.setAttribute('cx', 10); raqueta.setAttribute('cy', -8)
  raqueta.setAttribute('rx', 5); raqueta.setAttribute('ry', 8)
  raqueta.setAttribute('fill', 'none')
  raqueta.setAttribute('stroke', colorBorde)
  raqueta.setAttribute('stroke-width', 1.5)
  raqueta.setAttribute('transform', 'rotate(30, 10, -8)')

  const texto = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  texto.setAttribute('text-anchor', 'middle')
  texto.setAttribute('y', 3)
  texto.setAttribute('font-size', '9')
  texto.setAttribute('fill', 'white')
  texto.setAttribute('font-weight', 'bold')
  texto.textContent = 'J'

  g.append(circulo, raqueta, texto)
  return g
}

function crearCarroBolas(x, y) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  g.setAttribute('transform', `translate(${x}, ${y})`)

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('x', -12); rect.setAttribute('y', -8)
  rect.setAttribute('width', 24); rect.setAttribute('height', 16)
  rect.setAttribute('rx', 3)
  rect.setAttribute('fill', '#8a9ba8')
  rect.setAttribute('stroke', '#5a6b78')
  rect.setAttribute('stroke-width', 1.5)

  for (let i = 0; i < 6; i++) {
    const bola = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    bola.setAttribute('cx', -8 + (i % 3) * 8)
    bola.setAttribute('cy', -4 + Math.floor(i / 3) * 8)
    bola.setAttribute('r', 3)
    bola.setAttribute('fill', '#e8ff3a')
    g.appendChild(bola)
  }
  g.appendChild(rect)
  return g
}

function crearCono(x, y) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  g.setAttribute('transform', `translate(${x}, ${y})`)
  const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  poly.setAttribute('points', '0,-12 -8,8 8,8')
  poly.setAttribute('fill', '#e67e22')
  poly.setAttribute('stroke', '#b35c00')
  poly.setAttribute('stroke-width', 1.5)
  const base = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
  base.setAttribute('cy', 8); base.setAttribute('rx', 10); base.setAttribute('ry', 3)
  base.setAttribute('fill', '#b35c00')
  g.append(poly, base)
  return g
}

function crearSeta(x, y) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  g.setAttribute('transform', `translate(${x}, ${y})`)
  const sombrero = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
  sombrero.setAttribute('cy', -4); sombrero.setAttribute('rx', 10); sombrero.setAttribute('ry', 6)
  sombrero.setAttribute('fill', '#e74c3c')
  sombrero.setAttribute('stroke', '#a93226')
  sombrero.setAttribute('stroke-width', 1.5)
  const tallo = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  tallo.setAttribute('x', -3); tallo.setAttribute('y', -2)
  tallo.setAttribute('width', 6); tallo.setAttribute('height', 10)
  tallo.setAttribute('fill', '#f5f5dc')
  tallo.setAttribute('stroke', '#ccc')
  tallo.setAttribute('stroke-width', 1)
  g.append(sombrero, tallo)
  return g
}

function crearFlechaRecta(x, y) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  g.setAttribute('transform', `translate(${x}, ${y})`)
  const linea = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  linea.setAttribute('x1', 0); linea.setAttribute('y1', 0)
  linea.setAttribute('x2', 40); linea.setAttribute('y2', 0)
  linea.setAttribute('stroke', '#e8ff3a')
  linea.setAttribute('stroke-width', 3)
  linea.setAttribute('marker-end', 'url(#flecha-end)')
  asegurarMarcador()
  g.appendChild(linea)
  return g
}

function crearFlechaCurva(x, y) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  g.setAttribute('transform', `translate(${x}, ${y})`)
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', 'M 0,0 Q 20,-30 40,0')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', '#e8ff3a')
  path.setAttribute('stroke-width', 3)
  path.setAttribute('marker-end', 'url(#flecha-end)')
  asegurarMarcador()
  g.appendChild(path)
  return g
}

function asegurarMarcador() {
  const svg = document.getElementById('pista-svg')
  let defs = svg.querySelector('defs')
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    svg.insertBefore(defs, svg.firstChild)
  }
  if (defs.querySelector('#flecha-end')) return
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker')
  marker.setAttribute('id', 'flecha-end')
  marker.setAttribute('markerWidth', '10')
  marker.setAttribute('markerHeight', '7')
  marker.setAttribute('refX', '10')
  marker.setAttribute('refY', '3.5')
  marker.setAttribute('orient', 'auto')
  const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  poly.setAttribute('points', '0 0, 10 3.5, 0 7')
  poly.setAttribute('fill', '#e8ff3a')
  marker.appendChild(poly)
  defs.appendChild(marker)
}

// ============================================
// Arrastre
// ============================================

function iniciarArrastre(e, id) {
  e.preventDefault()
  arrastrando = id
  const elem = elementos.get(id)
  if (!elem) return

  const svg = document.getElementById('pista-svg')
  const pt = svg.createSVGPoint()
  pt.x = e.clientX; pt.y = e.clientY
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse())
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
  const pt = svg.createSVGPoint()
  pt.x = e.clientX; pt.y = e.clientY
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse())

  elem.x = Math.max(15, Math.min(385, svgP.x - offsetX))
  elem.y = Math.max(15, Math.min(185, svgP.y - offsetY))

  elem.element.setAttribute('transform',
    `translate(${elem.x}, ${elem.y}) rotate(${elem.rotacion})`)

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

  const bbox = elem.element.getBBox()
  const rectSel = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rectSel.setAttribute('id', 'seleccion-rect')
  rectSel.setAttribute('x', bbox.x - 4)
  rectSel.setAttribute('y', bbox.y - 4)
  rectSel.setAttribute('width', bbox.width + 8)
  rectSel.setAttribute('height', bbox.height + 8)
  rectSel.setAttribute('fill', 'none')
  rectSel.setAttribute('stroke', '#e8ff3a')
  rectSel.setAttribute('stroke-width', 2)
  rectSel.setAttribute('stroke-dasharray', '5,3')
  rectSel.setAttribute('transform', elem.element.getAttribute('transform'))
  document.getElementById('capa-elementos').appendChild(rectSel)

  document.getElementById('panel-propiedades').style.display = 'block'
  document.getElementById('prop-rotacion').value = elem.rotacion

  document.getElementById('prop-rotacion').oninput = (e) => {
    elem.rotacion = parseInt(e.target.value)
    elem.element.setAttribute('transform',
      `translate(${elem.x}, ${elem.y}) rotate(${elem.rotacion})`)
    rectSel.setAttribute('transform', elem.element.getAttribute('transform'))
  }

  document.getElementById('btn-eliminar-elemento').onclick = () => {
    elem.element.remove()
    elementos.delete(id)
    deseleccionar()
  }
}

function deseleccionar() {
  const rect = document.getElementById('seleccion-rect')
  if (rect) rect.remove()
  elementoSeleccionado = null
  document.getElementById('panel-propiedades').style.display = 'none'
}

// ============================================
// Exportar datos
// ============================================

export function obtenerDatosPista() {
  const datos = []
  elementos.forEach((valor, id) => {
    datos.push({
      id,
      tipo: valor.tipo,
      x: Math.round(valor.x * 100) / 100,
      y: Math.round(valor.y * 100) / 100,
      rotacion: valor.rotacion
    })
  })
  return datos
}