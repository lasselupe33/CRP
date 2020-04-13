import { compile, cClient } from './crp'
import { getFolders, getMaps, environment } from './utils'
import { visualiserTest, updateMetricTest, trafficTest, scalingTest, partitionersTest, overlayTest } from './client/experiments'

import inquirer = require('inquirer')

async function client (): Promise<void> {
  if (environment['--recompile']) {
    await compile('Client')
  }

  const folders = getFolders()

  const folderQuestion = {
    type: 'list',
    name: 'folder',
    message: 'Specify desired map (Should be positioned within the data folder)',
    choices: folders
  }

  const folder = environment['--folder'] || (await inquirer.prompt([folderQuestion])).folder as string
  const map = getMaps(folder)[0]

  switch (environment['--experiment']) {
    case 'traffic':
      await trafficTest(folder, map)
      break

    case 'visualise':
      await visualiserTest(folder, map)
      break

    case 'updateMetric':
      await updateMetricTest(folder, map)
      break

    case 'scale':
      await scalingTest(folder, map)
      break

    case 'partitioners':
      await partitionersTest(folder, map)
      break

    case 'overlay':
      await overlayTest(folder, map)
      break

    default:
      await cClient(folder, map)
  }
}

client()
  .catch((err) => { console.error(err) })
