import { resolvePath, getFolders, getMaps } from './utils'
import { parseOSM, compile, partition, customize } from './crp'
import { preparse } from './crp/preparse'

import inquirer = require('inquirer')
import fs = require('fs-extra')
import execa = require('execa')

async function exec (): Promise<void> {
  // EXTRACT POSSIBLE FOLDERS FOR MAPS
  const folders = getFolders()

  const folderQuestion = {
    type: 'list',
    name: 'folder',
    message: 'Specify desired map (Should be positioned within the data folder)',
    choices: folders
  }

  const { folder } = await inquirer.prompt([folderQuestion])

  // EXTRACT DESIRED MAP
  const possibleMaps = getMaps(folder)

  let map = possibleMaps[0]

  if (possibleMaps.length > 1) {
    const mapQuestion = {
      type: 'list',
      name: 'selectedMap',
      message: 'Specify desired map source',
      choices: possibleMaps
    }

    const { selectedMap } = await inquirer.prompt([mapQuestion])
    map = selectedMap
  }

  const { skipCompile } = await inquirer.prompt([{ type: 'confirm', name: 'skipCompile', message: 'Do you want to skip compiling of CRP?', default: false }])

  if (!skipCompile) {
    await compile('CRP')
  }

  let shouldSkipParse = false

  if (fs.existsSync(resolvePath(['data', folder, `${map}.graph`]))) {
    const { skipParse } = await inquirer.prompt([{ type: 'confirm', name: 'skipParse', message: 'Do you want to skip parsing?', default: 'Y' }])

    shouldSkipParse = skipParse
  }

  if (!shouldSkipParse) {
    await parseOSM(folder, map)
  }

  // As taken from CRP: k = 1.03·n/U.
  const partitionFile = resolvePath(['data', folder, 'partition'])

  let shouldSkipPartitioning = false

  if (fs.existsSync(partitionFile)) {
    const { skipPartitioning } = await inquirer.prompt([{ type: 'confirm', name: 'skipPartitioning', message: 'Do you want to skip partitioning?', default: 'Y' }])
    shouldSkipPartitioning = skipPartitioning
  }

  if (!shouldSkipPartitioning) {
    await partition(folder, map)
  }

  let shouldskipPreparse = false

  const overlayFile = resolvePath(['data', folder, `${map}.overlay`])

  if (fs.existsSync(overlayFile)) {
    const { skipPreparse } = await inquirer.prompt([{ type: 'confirm', name: 'skipPreparse', message: 'Do you want to skip preparsing?', default: 'Y' }])
    shouldskipPreparse = skipPreparse
  }

  if (!shouldskipPreparse) {
    await preparse(folder, map)
  }

  let shouldSkipCustomization = false
  const metricsFolder = resolvePath(['data', folder, 'metrics'])
  const { metrics } = await inquirer.prompt([{ type: 'list', name: 'metrics', choices: ['dist', 'time', 'hop', 'all'] }])

  if (fs.existsSync(metricsFolder)) {
    const { skipCustomization } = await inquirer.prompt([{ type: 'confirm', name: 'skipCustomization', message: 'Do you want to skip customization?', default: 'Y' }])
    shouldSkipCustomization = skipCustomization
  }

  if (!shouldSkipCustomization) {
    await customize(folder, map, metrics)
  }

  // RUN TESTS
  const { skipRecompile } = await inquirer.prompt([{ type: 'confirm', name: 'skipRecompile', message: 'Do you want to skip compiling of tests?', default: 'Y' }])

  if (!skipRecompile) {
    console.log('Compiling QueryTest')
    const compiling = await execa.command('sh run.sh compile QueryTest', { cwd: resolvePath('CRP') })

    if (compiling.exitCode !== 0) {
      throw new Error('Failed to compile CRP')
    }
  }

  const { amount } = await inquirer.prompt([{ type: 'number', name: 'amount', message: 'Please select amount of times to run test', default: 1000 }])
  const test = execa.command(`sh run.sh querytest ${amount} ${resolvePath(['data', folder])} ${map} ${metrics}`, { cwd: resolvePath('CRP') })

  if (test.stdout && test.stderr) {
    test.stdout.pipe(process.stdout)
    test.stderr.pipe(process.stderr)
  }

  await test
    .catch(() => { console.log('test errored') })
}

exec()
  .catch((err) => console.error(err))
