import { getFolders, getMaps, resolvePath } from '../utils'
import { customize, parseOSM } from '../crp'
import express = require('express')
import fs = require('fs-extra')
const router = express.Router()

const overlayCache: Map<string, string> = new Map()

router.get('/maps', (req, res) => {
  res.json(getFolders())
})

router.get('/overlay/:map', async (req, res) => {
  const { map: folder } = req.params
  const map = getMaps(folder)[0]

  if (!overlayCache.has(map)) {
    const overlay = await fs.readFile(resolvePath(['data', folder, `${map}.overlay`]), 'utf-8')
    overlayCache.set(map, overlay)
  }

  res.send(overlayCache.get(map))
})

router.post('parseOSM/:map', async (req, res) => {
  const { map: folder } = req.params
  const map = getMaps(folder)[0]

  await parseOSM(folder, map)
})

router.post('/customize/:map/:metric', async (req, res) => {
  const { map: folder, metric } = req.params

  const map = getMaps(folder)[0]
  await customize(folder, map, metric)

  res.status(204).send()
})

export default router
