const { meta, paths } = window.data

const canvas = document.createElement('canvas')
canvas.width = window.innerWidth
canvas.height = window.innerHeight
canvas.style.background = 'rgba(0, 0, 0, 0.01)'
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
  if (path === null) {
    return
  }

  let prevCoord
  const color = `rgb(${Math.round(Math.random() * 255)}, ${Math.round(Math.random() * 255)}, ${Math.round(Math.random() * 255)})`
  ctx.strokeStyle = color
  ctx.fillStyle = color

  ctx.beginPath()
  ctx.arc(normalizeCoordinate(path[0]).x, normalizeCoordinate(path[0]).y, 4, 2 * Math.PI, 0, false)
  ctx.closePath()
  ctx.fill()

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
