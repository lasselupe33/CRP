import { crpRouter } from './server/routes'
import { environment } from './utils'
import { initializeCRP } from './crp'
import { handleUncaughtException } from './server/utils'

import express = require('express')
import gracefulShutdown = require('http-graceful-shutdown')

environment['--skipParsingIfPossible'] = true

const PORT = Number(process.env.PORT || 3000)

async function start (): Promise<void> {
  // Will initialize map creation process if necessary
  await initializeCRP()

  const app = express()

  app.use('/', crpRouter)
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Listening on port ${PORT}`)
  }).on('error', (err) => {
    console.error(err)
  })

  const shutdown = gracefulShutdown(server)

  /* eslint-disable @typescript-eslint/no-misused-promises */
  process.on('SIGTERM', async () => {
    await shutdown()
    process.exit(1)
  })
  process.on('uncaughtException', async (err): Promise<void> => handleUncaughtException(shutdown, err))
  process.on('unhandledRejection', async (reason): Promise<void> => handleUncaughtException(shutdown, reason))
  /* eslint-enable @typescript-eslint/no-misused-promises */
}

start()
  .catch((err) => { console.error(err) })
