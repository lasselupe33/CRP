import { resolvePath, prependFile, environment } from '../utils'

import execa = require('execa')
import fs = require('fs-extra')

const levelSizes = [2 ** 20, 2 ** 17, 2 ** 14, 2 ** 11, 2 ** 8]
const delta = 1.03

function getLevels (nodes: number): number[] {
  return levelSizes
    .map((levelSize) => Math.round(delta * nodes / levelSize))
    .filter((levelCells) => levelCells > 3)
}

export async function partition (folder: string, map: string): Promise<void> {
  const nodes = Number(fs.readFileSync(resolvePath(['data', folder, `${map}.graph.vertices`])))
  const levels = getLevels(nodes)

  if (levels.length === 0) {
    levels.push(1)
  }

  const partitionFile = resolvePath(['data', folder, 'partition'])

  const buffonPath = resolvePath(['KaHIP_Buffoon', 'src', 'optimized', 'buffoon'])
  const metisGraph = resolvePath(['data', folder, `${map}.metis.graph`])

  const partitioner = execa.command(`mpirun -n ${environment['--maxThreads']} ${buffonPath} ${metisGraph} --k ${levels[levels.length - 1]} --preconfiguration=fast --max_num_threads=${environment['--maxThreads']}`)

  if (partitioner.stdout && partitioner.stderr) {
    partitioner.stdout.pipe(process.stdout)
    partitioner.stderr.pipe(process.stderr)
  }

  await partitioner
    .catch(() => { console.log('partitioner errored') })

  await execa.command(`cp ${resolvePath(['lib', `tmppartition${levels[levels.length - 1]}`])} ${partitionFile}`)
  prependFile(partitionFile, `${levels.length}\n${levels.map((cells) => `${cells}`).join('\n')}\n${nodes}\n`)
}
