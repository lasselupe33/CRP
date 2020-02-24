import { resolvePath } from '../utils'
import execa = require('execa')

export async function compile (target: string): Promise<void> {
  console.log(`Compiling ${target}`)
  const compiling = await execa.command(`sh run.sh compile ${target}`, { cwd: resolvePath('CRP') })

  if (compiling.exitCode !== 0) {
    throw new Error(`Failed to compile ${target}`)
  }
}
