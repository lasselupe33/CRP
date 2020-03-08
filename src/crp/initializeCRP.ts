import { resolvePath, getFolders, getMaps, environment } from '../utils'
import { preparse } from './preparse'
import { compile } from './compile'
import { parseOSM } from './parseOSM'
import { partition } from './partition'
import { customize } from './customize'

import inquirer = require('inquirer')
import fs = require('fs-extra')

export async function initializeCRP (): Promise<void> {
  // Determine what map we should be working with
  const folders = getFolders()

  const folderQuestion = {
    type: 'list',
    name: 'folder',
    message: 'Specify desired map (Should be positioned within the data folder)',
    choices: folders
  }

  const folder = environment['--folder'] || (await inquirer.prompt([folderQuestion])).folder as string

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

  // Should we compile our C++ CRP Implementation?
  const skipCompile =
    environment['--skipParsingIfPossible'] ||
    (await inquirer.prompt([{ type: 'confirm', name: 'skipCompile', message: 'Do you want to skip compiling of CRP?', default: false }])).skipCompile as string

  if (!skipCompile) {
    await compile('CRP')
  }

  // Should we parse OSM data?
  let shouldSkipParse = false

  if (fs.existsSync(resolvePath(['data', folder, `${map}.graph`]))) {
    shouldSkipParse =
      environment['--skipParsingIfPossible'] ||
      (await inquirer.prompt([{ type: 'confirm', name: 'skipParse', message: 'Do you want to skip parsing?', default: 'Y' }])).skipParse
  }

  if (!shouldSkipParse) {
    await parseOSM(folder, map)
  }

  // Should we generate a partition?
  const partitionFile = resolvePath(['data', folder, 'partition'])

  let shouldSkipPartitioning = false

  if (fs.existsSync(partitionFile)) {
    shouldSkipPartitioning =
      environment['--skipParsingIfPossible'] ||
      (await inquirer.prompt([{ type: 'confirm', name: 'skipPartitioning', message: 'Do you want to skip partitioning?', default: 'Y' }])).skipPartitioning
  }

  if (!shouldSkipPartitioning) {
    await partition(folder, map)
  }

  let shouldskipPreparse = false

  // Should we do our preparsing?
  const overlayFile = resolvePath(['data', folder, `${map}.overlay`])

  if (fs.existsSync(overlayFile)) {
    shouldskipPreparse =
      environment['--skipParsingIfPossible'] ||
      (await inquirer.prompt([{ type: 'confirm', name: 'skipPreparse', message: 'Do you want to skip preparsing?', default: 'Y' }])).skipPreparse
  }

  if (!shouldskipPreparse) {
    await preparse(folder, map)
  }

  // Should we do our customization?
  let shouldSkipCustomization = false
  const metricsFolder = resolvePath(['data', folder, 'metrics'])

  if (fs.existsSync(metricsFolder)) {
    shouldSkipCustomization =
      environment['--skipParsingIfPossible'] ||
      (await inquirer.prompt([{ type: 'confirm', name: 'skipCustomization', message: 'Do you want to skip customization?', default: 'Y' }])).skipCustomization
  }

  if (!shouldSkipCustomization) {
    await customize(folder, map, 'all')
  }
}
