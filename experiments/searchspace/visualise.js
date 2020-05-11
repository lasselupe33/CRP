const coords = window.data
const query = window.query
const meta = generateMeta()

const canvas = document.createElement('canvas')
canvas.width = window.innerWidth
canvas.height = window.innerHeight
canvas.style.background = 'rgba(0, 0, 0, 0.01)'
document.body.appendChild(canvas)

const levelColors = [
  'black',
  'red',
  'yellow',
  'green',
  'blue'
]

const ctx = canvas.getContext('2d')
ctx.lineWidth = 1

function generateMeta () {
  const meta = {
    lat: {
      min: Infinity,
      max: -Infinity
    },
    lon: {
      min: Infinity,
      max: -Infinity
    }
  }

  for (const coord of coords) {
    meta.lat.min = Math.min(meta.lat.min, coord.lat)
    meta.lat.max = Math.max(meta.lat.max, coord.lat)

    meta.lon.min = Math.min(meta.lon.min, coord.lon)
    meta.lon.max = Math.max(meta.lon.max, coord.lon)
  }

  meta.lat.min = Math.min(meta.lat.min, query.start.lat)
  meta.lat.max = Math.max(meta.lat.max, query.start.lat)

  meta.lon.min = Math.min(meta.lon.min, query.start.lon)
  meta.lon.max = Math.max(meta.lon.max, query.start.lon)

  meta.lat.min = Math.min(meta.lat.min, query.end.lat)
  meta.lat.max = Math.max(meta.lat.max, query.end.lat)

  meta.lon.min = Math.min(meta.lon.min, query.end.lon)
  meta.lon.max = Math.max(meta.lon.max, query.end.lon)
  console.log(meta)

  return meta
}

function normalizeCoordinate ({ lat, lon }) {
  return {
    x: ((lat - meta.lat.min) / (meta.lat.max - meta.lat.min)) * window.innerWidth,
    y: ((lon - meta.lon.min) / (meta.lon.max - meta.lon.min)) * window.innerHeight
  }
}

function drawCoordinate (coord, size, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(normalizeCoordinate(coord).x, normalizeCoordinate(coord).y, size, 2 * Math.PI, 0, false)
  ctx.closePath()
  ctx.fill()
}

console.log(query)
coords.forEach((coord) => { drawCoordinate(coord, 2, levelColors[coord.lvl]) })
drawCoordinate(query.start, 10, 'purple')
drawCoordinate(query.end, 10, 'purple')

const legend = document.createElement('div')

legend.style.cssText = `
  position: fixed;
  top: 15px;
  left: 15px;
  background: white;

  padding: 0 15px;
  border: 1px solid grey;
`

for (let i = 0; i < levelColors.length; i++) {
  const wrapper = document.createElement('div')
  const l = document.createElement('span')
  const color = document.createElement('i')

  l.innerHTML = `Level ${i}:`

  wrapper.style.cssText = `
    display: flex;
    align-items: center;
    margin: 10px 0;
  `

  l.style.cssText = `
    font-family: helvetica;
    font-size: 16px;
  `

  color.style.cssText = `
    display: block;
    width: 15px;
    height: 15px;

    margin-left: 8px;
    border-radius: 50%;
    background-color: ${levelColors[i]};
  `

  wrapper.appendChild(l)
  wrapper.appendChild(color)
  legend.appendChild(wrapper)
}

document.body.appendChild(legend)
