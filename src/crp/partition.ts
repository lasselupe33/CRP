import { resolvePath, prependFile, environment, asyncTimeout } from '../utils'
import { onQueryResult } from '../client/onQueryResult'

import execa = require('execa')
import fs = require('fs-extra')

interface Config {
  withOutputStream?: boolean
  partitioner?: string
  configuration?: string
  L?: number[]
}

const levelSizes = [2 ** 20, 2 ** 18, 2 ** 16, 2 ** 14, 2 ** 12, 2 ** 10, 2 ** 8]
const delta = 1.03

function getLevels (nodes: number, LConfig: number[]): number[] {
  return LConfig
    .map((levelSize) => Math.round(delta * nodes / levelSize))
    .filter((levelCells) => levelCells >= 3)
}

export async function partition (folder: string, map: string, { withOutputStream = false, partitioner = 'buffoon', configuration = 'fast', L = levelSizes }: Config = {}): Promise<void> {
  const nodes = Number(fs.readFileSync(resolvePath(['data', folder, `${map}.graph.vertices`])))
  const levels = getLevels(nodes, L)

  if (levels.length === 0) {
    levels.push(1)
  }

  let generatedPartitionPath: string
  const partitionFile = resolvePath(['data', folder, 'partition'])
  const metisGraph = resolvePath(['data', folder, `${map}.metis.graph`])
  let command: execa.ExecaChildProcess<string>

  switch (partitioner) {
    case 'kaffpa': {
      const kaffpaPath = resolvePath(['KaHIP', 'deploy', 'kaffpa'])
      command = execa.command(`${kaffpaPath} ${metisGraph} --k=${levels[levels.length - 1]} --preconfiguration=${configuration}`)
      generatedPartitionPath = resolvePath(['lib', `tmppartition${levels[levels.length - 1]}`])

      break
    }

    case 'metis': {
      const metisPath = resolvePath(['metis-5.1.0', 'build', 'Darwin-x86_64', 'programs', 'gpmetis'])
      const ncuts = configuration === 'strong' ? 100 : 1
      const niter = configuration === 'strong' ? 10000 : 10

      command = execa.command(`${metisPath} -ncuts=${ncuts} -niter=${niter} ${metisGraph} ${levels[levels.length - 1]}`)
      generatedPartitionPath = resolvePath(['data', folder, `${map}.metis.graph.part.${levels[levels.length - 1]}`])

      break
    }

    case 'buffoon':
    default: {
      const buffonPath = resolvePath(['KaHIP_Buffoon', 'src', 'optimized', 'buffoon'])
      generatedPartitionPath = resolvePath(['lib', `tmppartition${levels[levels.length - 1]}`])
      command = execa.command(`mpirun -n ${environment['--maxThreads']} ${buffonPath} ${metisGraph} --k ${levels[levels.length - 1]} --preconfiguration=${configuration} --max_num_threads=${environment['--maxThreads']}`)
      break
    }
  }

  if (command.stdout && command.stderr) {
    if (withOutputStream) {
      onQueryResult('[TO_CLIENT_BEGIN]\n')
      command.stdout.on('data', onQueryResult)
      command.stdout.on('close', () => { onQueryResult('[END_CLIENT]\n') })
    } else {
      command.stdout.pipe(process.stdout)
      command.stderr.pipe(process.stderr)
    }
  }

  await command
    .catch((err) => { console.log('partitioner errored', err) })

  await execa.command(`mv ${generatedPartitionPath} ${partitionFile}`)
  prependFile(partitionFile, `${levels.length}\n${levels.map((cells) => `${cells}`).join('\n')}\n${nodes}\n`)
  await asyncTimeout()
}
