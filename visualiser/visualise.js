const { meta, paths } = window.data

const canvas = document.createElement('canvas')
canvas.width = window.innerWidth
canvas.height = window.innerHeight
canvas.style.background = 'rgba(0, 0, 0, 0.25)'
document.body.appendChild(canvas)

const ctx = canvas.getContext('2d')
ctx.lineWidth = 1

function normalizeCoordinate ({ lat, lon }) {
  return {
    x: ((lat - meta.lat.min) / (meta.lat.max - meta.lat.min)) * window.innerWidth,
    y: ((lon - meta.lon.min) / (meta.lon.max - meta.lon.min)) * window.innerHeight
  }
}

function drawEdge (from, to) {
  const a = normalizeCoordinate(from)
  const b = normalizeCoordinate(to)

  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

function drawPath (path) {
  let prevCoord
  const color = `rgba(${Math.round(Math.random() * 255)}, ${Math.round(Math.random() * 255)}, ${Math.round(Math.random() * 255)}, 1)`
  ctx.strokeStyle = color

  for (const coord of path) {
    if (!prevCoord) {
      prevCoord = coord
      continue
    }

    drawEdge(prevCoord, coord)
    prevCoord = coord
  }
}

paths.forEach(drawPath)
