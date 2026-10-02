// ============================================
// Diseñador de pista de pádel interactiva (SVG)
// ============================================

const SVG_NS = 'http://www.w3.org/2000/svg'

// ⬇️ NUEVAS CONSTANTES (pista oficial 20m × 10m)
// Court interior va de (50,50) a (850,450) en el viewBox 900×500
const COURT = {
  xMin: 55,           // borde izquierdo jugable (con margen de pared)
  xMax: 845,          // borde derecho jugable
  yMin: 55,           // borde superior jugable
  yMax: 445,          // borde inferior jugable
  centerX: 450,       // posición de la red
  centerY: 250,       // centro longitudinal del campo
  netX: 450           // X donde está la red
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
  const hint = document.getElementById('hint-trayectoria')

  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tipo = btn.dataset.tipo
      if (tipo === 'trayectoria') {
        iniciarModoTrayectoria()
      } else {
        // ⬇️ CAMBIO: colocar los nuevos elementos en el centro de la pista
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
}

// ... (resto igual: iniciarModoTrayectoria, cancelarTrayectoria,
//      finalizarTrayectoria, actualizarPreview, agregarElemento,
//      crearTrayectoria, iniciarArrastre, soltarElemento,
//      seleccionar, deseleccionar, getSvgPoint) ...

// ============================================
// MOVER ELEMENTO — actualizado con nuevos límites
// ============================================
function moverElemento(e) {
  if (!arrastrando) return
  const elem = elementos.get(arrastrando)
  if (!elem) return

  const svg = document.getElementById('pista-svg')
  const svgP = getSvgPoint(e, svg)

  // ⬇️ CAMBIO: clamp dentro del court oficial (con pequeño margen)
  elem.x = Math.max(COURT.xMin, Math.min(COURT.xMax, svgP.x - offsetX))
  elem.y = Math.max(COURT.yMin, Math.min(COURT.yMax, svgP.y - offsetY))

  const rot = elem.tipo === 'trayectoria' ? 0 : elem.rotacion
  elem.element.setAttribute('transform',
    `translate(${elem.x}, ${elem.y}) rotate(${rot})`)

  const rectSel = document.getElementById('seleccion-rect')
  if (rectSel) rectSel.setAttribute('transform', elem.element.getAttribute('transform'))
}

// ============================================
// RESTO DEL ARCHIVO IGUAL
// ============================================
// Copia tal cual el resto de funciones que ya tenías:
//   - iniciarModoTrayectoria()
//   - cancelarTrayectoria()
//   - finalizarTrayectoria()
//   - actualizarPreview()
//   - agregarElemento()
//   - crearTrayectoria()
//   - iniciarArrastre()
//   - soltarElemento()
//   - seleccionar() / deseleccionar()
//   - getSvgPoint()
//   - obtenerDatosPista() / cargarDesdeDatos()