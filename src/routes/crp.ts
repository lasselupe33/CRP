import { getFolders, getMaps, resolvePath } from '../utils'
import { customize, parseOSM } from '../crp'
import express = require('express')
const router = express.Router()

router.get('/maps', (req, res) => {
  res.json(getFolders())
})

router.get('/map/:map', (req, res) => {
  const { map: folder } = req.params
  const map = getMaps(folder)[0]

  res.sendFile(resolvePath(['data', folder, `${map}.graph.preparsed`]))
})

router.get('/overlay/:map', (req, res) => {
  const { map: folder } = req.params
  const map = getMaps(folder)[0]

  res.sendFile(resolvePath(['data', folder, `${map}.overlay`]))
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
