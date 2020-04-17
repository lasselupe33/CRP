import { resolvePath, asyncTimeout } from '../utils'
import { onQueryResult } from '../client/onQueryResult'
import fs = require('fs-extra')
import execa = require('execa')

interface Config {
  withOutputStream?: boolean
}

export async function customize (folder: string, map: string, metric: string, { withOutputStream = false }: Config = {}): Promise<void> {
  const metricsFolder = resolvePath(['data', folder, 'metrics'])

  fs.mkdirsSync(metricsFolder)
  const customization = execa.command(`sh run.sh customization ${resolvePath(['data', folder])} ${map} ${metric}`, { cwd: resolvePath('CRP') })

  if (customization.stdout && customization.stderr) {
    if (withOutputStream) {
      onQueryResult('[TO_CLIENT_BEGIN]\n')
      customization.stdout.on('data', onQueryResult)
      customization.stdout.on('close', () => { onQueryResult('[END_CLIENT]\n') })
    } else {
      customization.stdout.pipe(process.stdout)
      customization.stderr.pipe(process.stderr)
    }
  }

  await customization
    .catch(() => { console.log('customization errored') })
  await asyncTimeout(10)
}
