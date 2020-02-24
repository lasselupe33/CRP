import { resolvePath } from '../utils'

import execa = require('execa')

export async function preparse (folder: string, map: string): Promise<void> {
  const preparse = execa.command(`sh run.sh precalc ${resolvePath(['data', folder])} ${map} ${resolvePath(['data', folder, 'partition'])}`, { cwd: resolvePath('CRP') })

  if (preparse.stdout && preparse.stderr) {
    preparse.stdout.pipe(process.stdout)
    preparse.stderr.pipe(process.stderr)
  }

  await preparse
    .catch(() => { console.log('preparsing errored') })
}
