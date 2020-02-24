import { resolvePath } from '../utils'
import execa = require('execa')

export async function cClient (folder: string, map: string, metric: string, onData: (chunk: Buffer) => void): Promise<void> {
  const test = execa.command(`sh run.sh client ${resolvePath(['data', folder])} ${map} ${metric}`, { cwd: resolvePath('CRP') })

  if (test.stdout && test.stderr && test.stdin) {
    process.stdin.pipe(test.stdin)
    test.stdout.on('data', onData)
    test.stderr.pipe(process.stderr)
  }

  await test
    .catch(() => { console.log('test errored') })
}
