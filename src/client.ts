import { compile, cClient } from './crp'
import { getFolders, getMaps } from './utils'
import { onQueryResult } from './client/onQueryResult'

import inquirer = require('inquirer')

async function client (): Promise<void> {
  const { recompile } = await inquirer.prompt([{ type: 'confirm', name: 'recompile', message: 'Do you want to compile C++ Client?' }])

  if (recompile) {
    await compile('Client')
  }

  const folders = getFolders()

  const folderQuestion = {
    type: 'list',
    name: 'folder',
    message: 'Specify desired map (Should be positioned within the data folder)',
    choices: folders
  }

  const { folder } = await inquirer.prompt([folderQuestion])
  const map = getMaps(folder)[0]

  await cClient(folder, map, 'dist', onQueryResult)
}

client()
  .catch((err) => { console.error(err) })
