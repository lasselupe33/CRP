import { resolvePath } from './resolvePath'
import fs = require('fs-extra');

export async function generatePairs (folder: string, count: number, path?: string): Promise<Array<{src: string, dest: string}>> {
  const pairs: Array<{ src: string, dest: string }> = []

  const edges: {
    topLeft: string[]
    topRight: string[]
    bottomLeft: string[]
    bottomRight: string[]
  } = JSON.parse(await fs.readFile(path || resolvePath(['experiments', 'traffic', `vertices.${folder}.json`]), 'utf-8'))
  for (let i = 0; i < count; i++) {
    const src = edges.topRight[Math.floor(Math.random() * edges.topRight.length)]
    const dest = edges.bottomLeft[Math.floor(Math.random() * edges.bottomLeft.length)]

    pairs.push({ src, dest })
  }

  return pairs
}
