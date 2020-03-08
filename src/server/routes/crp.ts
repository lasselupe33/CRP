import { customize } from '../../crp'
import express = require('express')
const router = express.Router()

router.get('/update/:folder/:map/:metric', async (req, res) => {
  const { map, folder, metric } = req.params

  await customize(folder, map, metric)

  res.status(200).end()
})

export default router
