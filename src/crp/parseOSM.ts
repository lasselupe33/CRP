import { resolvePath } from '../utils'
import execa = require('execa')

export async function parseOSM (folder: string, map: string): Promise<void> {
  const parse = execa.command(`sh run.sh parse ${resolvePath(['data', folder])} ${map}`, { cwd: resolvePath('CRP') })

  if (parse.stdout && parse.stderr) {
    parse.stdout.pipe(process.stdout)
    parse.stderr.pipe(process.stderr)
  }

  await parse
    .catch(() => { console.log('parsing errored') })
}
