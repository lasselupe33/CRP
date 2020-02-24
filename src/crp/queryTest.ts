import { resolvePath } from '../utils'
import inquirer = require('inquirer')
import execa = require('execa')

export async function queryTest (folder: string, map: string, metric: string): Promise<void> {
  const { amount } = await inquirer.prompt([{ type: 'number', name: 'amount', message: 'Please select amount of times to run test', default: 1000 }])
  const test = execa.command(`sh run.sh querytest ${amount} ${resolvePath(['data', folder])} ${map} ${metric}`, { cwd: resolvePath('CRP') })

  if (test.stdout && test.stderr && test.stdin) {
    process.stdin.pipe(test.stdin)
    test.stdout.pipe(process.stdout)
    test.stderr.pipe(process.stderr)
  }

  await test
    .catch(() => { console.log('test errored') })
}
