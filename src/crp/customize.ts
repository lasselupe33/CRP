import { resolvePath } from '../utils'
import fs = require('fs-extra')
import execa = require('execa')

export async function customize (folder: string, map: string, metric: string): Promise<void> {
  const metricsFolder = resolvePath(['data', folder, 'metrics'])

  fs.mkdirsSync(metricsFolder)
  const customization = execa.command(`sh run.sh customization ${resolvePath(['data', folder])} ${map} ${metric}`, { cwd: resolvePath('CRP') })

  if (customization.stdout && customization.stderr) {
    customization.stdout.pipe(process.stdout)
    customization.stderr.pipe(process.stderr)
  }

  await customization
    .catch(() => { console.log('customization errored') })
}
