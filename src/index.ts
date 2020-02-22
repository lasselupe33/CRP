import { resolvePath, prependFile } from './utils'

import inquirer = require('inquirer')
import fs = require('fs-extra')
import execa = require('execa')

async function exec (): Promise<void> {
  // EXTRACT POSSIBLE FOLDERS FOR MAPS
  const folders = fs.readdirSync(resolvePath('data'), { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)

  const folderQuestion = {
    type: 'list',
    name: 'folder',
    message: 'Specify desired map (Should be positioned within the data folder)',
    choices: folders
  }

  const { folder } = await inquirer.prompt([folderQuestion])

  // EXTRACT DESIRED MAP
  const possibleMaps = fs.readdirSync(resolvePath(['data', folder]))
    .filter(map => map.endsWith('.osm') || map.endsWith('.bz2'))

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
    console.log('Compiling CRP')
    const compiling = await execa.command('sh run.sh compile CRP', { cwd: resolvePath('CRP') })

    if (compiling.exitCode !== 0) {
      throw new Error('Failed to compile CRP')
    }
  }

  let shouldSkipParse = false

  if (fs.existsSync(resolvePath(['data', folder, `${map}.graph`]))) {
    const { skipParse } = await inquirer.prompt([{ type: 'confirm', name: 'skipParse', message: 'Do you want to skip parsing?', default: 'Y' }])

    shouldSkipParse = skipParse
  }

  if (!shouldSkipParse) {
    const parse = execa.command(`sh run.sh parse ${resolvePath(['data', folder])} ${map}`, { cwd: resolvePath('CRP') })

    if (parse.stdout && parse.stderr) {
      parse.stdout.pipe(process.stdout)
      parse.stderr.pipe(process.stderr)
    }

    await parse
      .catch(() => { console.log('parsing errored') })
  }

  // As taken from CRP: k = 1.03·n/U.
  const nodes = Number(fs.readFileSync(resolvePath(['data', folder, `${map}.graph.vertices`])))
  const topLevelK = Math.round(1.03 * nodes / 2 ** 8)
  const partitionFile = resolvePath(['data', folder, 'partition_2__14'])

  let shouldSkipPartitioning = false

  if (fs.existsSync(partitionFile)) {
    const { skipPartitioning } = await inquirer.prompt([{ type: 'confirm', name: 'skipPartitioning', message: 'Do you want to skip partitioning?', default: 'Y' }])
    shouldSkipPartitioning = skipPartitioning
  }

  if (!shouldSkipPartitioning) {
    const buffonPath = resolvePath(['KaHIP_Buffoon', 'src', 'optimized', 'buffoon'])
    const metisGraph = resolvePath(['data', folder, `${map}.metis.graph`])

    const partitioner = execa.command(`mpirun -n 4 ${buffonPath} ${metisGraph} --k ${topLevelK} --preconfiguration=strong --max_num_threads=4`)

    if (partitioner.stdout && partitioner.stderr) {
      partitioner.stdout.pipe(process.stdout)
      partitioner.stderr.pipe(process.stderr)
    }

    await partitioner
      .catch(() => { console.log('partitioner errored') })

    await execa.command(`cp ${resolvePath(['lib', `tmppartition${topLevelK}`])} ${partitionFile}`)
    prependFile(partitionFile, `1\n${topLevelK}\n${nodes}\n`)
  }

  let shouldskipPreparse = false

  const overlayFile = resolvePath(['data', folder, `${map}.overlay`])

  if (fs.existsSync(overlayFile)) {
    const { skipPreparse } = await inquirer.prompt([{ type: 'confirm', name: 'skipPreparse', message: 'Do you want to skip preparsing?', default: 'Y' }])
    shouldskipPreparse = skipPreparse
  }

  if (!shouldskipPreparse) {
    const preparse = execa.command(`sh run.sh precalc ${resolvePath(['data', folder])} ${map} ${partitionFile}`, { cwd: resolvePath('CRP') })

    if (preparse.stdout && preparse.stderr) {
      preparse.stdout.pipe(process.stdout)
      preparse.stderr.pipe(process.stderr)
    }

    await preparse
      .catch(() => { console.log('preparsing errored') })
  }

  let shouldSkipCustomization = false
  const metricsFolder = resolvePath(['data', folder, 'metrics'])
  const { metrics } = await inquirer.prompt([{ type: 'list', name: 'metrics', choices: ['dist', 'all'] }])

  if (fs.existsSync(metricsFolder)) {
    const { skipCustomization } = await inquirer.prompt([{ type: 'confirm', name: 'skipCustomization', message: 'Do you want to skip customization?', default: 'Y' }])
    shouldSkipCustomization = skipCustomization
  }

  if (!shouldSkipCustomization) {
    fs.mkdirsSync(metricsFolder)
    const customization = execa.command(`sh run.sh customization ${resolvePath(['data', folder])} ${map} ${metrics}`, { cwd: resolvePath('CRP') })

    if (customization.stdout && customization.stderr) {
      customization.stdout.pipe(process.stdout)
      customization.stderr.pipe(process.stderr)
    }

    await customization
      .catch(() => { console.log('customization errored') })
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
