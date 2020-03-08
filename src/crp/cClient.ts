import { resolvePath, environment } from '../utils'
import { onQueryResult } from '../client/onQueryResult'
import { Writable } from 'stream'
import execa = require('execa')

export async function cClient (folder: string, map: string, setStream?: (stream: Writable | null) => void): Promise<void> {
  const test = execa.command(`sh run.sh client ${resolvePath(['data', folder])} ${map} ${environment['--metric']}`, { cwd: resolvePath('CRP') })

  if (test.stdout && test.stderr && test.stdin) {
    if (setStream) {
      setStream(test.stdin)
    }

    process.stdin.pipe(test.stdin)
    test.stdout.on('data', onQueryResult)
    test.stderr.pipe(process.stderr)
  }

  await test
    .catch(() => { console.log('test errored') })
}
