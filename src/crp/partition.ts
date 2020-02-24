import { resolvePath, prependFile } from '../utils'

import execa = require('execa')
import fs = require('fs-extra')

const levelSizes = [2 ** 8, 2 ** 11, 2 ** 14, 2 ** 17, 2 ** 20]
const delta = 1.03

function getLevels (nodes: number): number[] {
  return levelSizes
    .map((levelSize) => Math.round(delta * nodes / levelSize))
    .filter((levelCells) => levelCells > 3)
}

export async function partition (folder: string, map: string): Promise<void> {
  const nodes = Number(fs.readFileSync(resolvePath(['data', folder, `${map}.graph.vertices`])))
  const levels = getLevels(nodes)

  const partitionFile = resolvePath(['data', folder, 'partition'])

  const buffonPath = resolvePath(['KaHIP_Buffoon', 'src', 'optimized', 'buffoon'])
  const metisGraph = resolvePath(['data', folder, `${map}.metis.graph`])

  const partitioner = execa.command(`mpirun -n 4 ${buffonPath} ${metisGraph} --k ${levels[0]} --preconfiguration=strong --max_num_threads=4`)

  if (partitioner.stdout && partitioner.stderr) {
    partitioner.stdout.pipe(process.stdout)
    partitioner.stderr.pipe(process.stderr)
  }

  await partitioner
    .catch(() => { console.log('partitioner errored') })

  await execa.command(`cp ${resolvePath(['lib', `tmppartition${levels[0]}`])} ${partitionFile}`)
  prependFile(partitionFile, `${levels.length}\n${levels.map((cells) => `${cells}`).join('\n')}\n${nodes}\n`)
}
