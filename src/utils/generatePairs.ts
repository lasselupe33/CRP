import { resolvePath } from './resolvePath'
import fs = require('fs-extra');

export async function generatePairs (folder: string, count: number): Promise<Array<{src: string, dest: string}>> {
  const pairs: Array<{ src: string, dest: string }> = []

  const edges: {
    topLeft: string[]
    topRight: string[]
    bottomLeft: string[]
    bottomRight: string[]
  } = JSON.parse(await fs.readFile(resolvePath(['experiments', 'traffic', `vertices.${folder}.json`]), 'utf-8'))

  for (let i = 0; i < count; i++) {
    const src = edges.topLeft[Math.floor(Math.random() * edges.topLeft.length)]
    const dest = edges.bottomRight[Math.floor(Math.random() * edges.bottomRight.length)]

    pairs.push({ src, dest })
  }

  return pairs
}
