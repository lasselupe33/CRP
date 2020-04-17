import { resolvePath, environment } from '../utils'
import { onQueryResult } from '../client/onQueryResult'
import { Writable } from 'stream'
import { waitForUserInput } from '../utils/waitForUserInput'
import execa = require('execa')

const CPU_CLOCK_GHZ = 3.1
const MOBILE_CPU = 2.0
const THROTTLE_PERCENT = Math.round(MOBILE_CPU / CPU_CLOCK_GHZ * 100)
const GB = 1024 * 1024 * 1024

export async function cClient (folder: string, map: string, setStream?: (stream: Writable | null) => void): Promise<void> {
  const test = execa.command(`sh run.sh client ${resolvePath(['data', folder])} ${map} ${environment['--metric']}`, { cwd: resolvePath('CRP'), maxBuffer: GB })

  if (environment['--throttleClient']) {
    console.log('In order to enable throttling, please run the command below in another terminal')
    console.log(`sudo ${resolvePath('cputhrottle')} ${test.pid + 1} ${THROTTLE_PERCENT}`)
    await waitForUserInput()
  }

  if (test.stdout && test.stderr && test.stdin) {
    if (setStream) {
      setStream(test.stdin)
    }

    process.stdin.pipe(test.stdin)
    test.stdout.on('data', onQueryResult)
    test.stderr.pipe(process.stderr)
  }

  await test
    .catch((err) => { console.error('test errored', err) })
}
