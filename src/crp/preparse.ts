import { resolvePath, asyncTimeout } from '../utils'
import { onQueryResult } from '../client/onQueryResult'

import execa = require('execa')

interface Config {
  withOutputStream?: boolean
}

export async function preparse (folder: string, map: string, { withOutputStream = false }: Config = {}): Promise<void> {
  const preparse = execa.command(`sh run.sh precalc ${resolvePath(['data', folder])} ${map} ${resolvePath(['data', folder, 'partition'])}`, { cwd: resolvePath('CRP') })

  if (preparse.stdout && preparse.stderr) {
    if (withOutputStream) {
      onQueryResult('[TO_CLIENT_BEGIN]\n')
      preparse.stdout.on('data', onQueryResult)
      preparse.stdout.on('close', () => { onQueryResult('[END_CLIENT]\n') })
    } else {
      preparse.stdout.pipe(process.stdout)
      preparse.stderr.pipe(process.stderr)
    }
  }

  await preparse
    .catch(() => { console.log('preparsing errored') })
  await asyncTimeout()
}
