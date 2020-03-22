import { resolvePath, getFolders, getMaps, environment } from '../utils'
import { initializeCRP } from './initializeCRP'
import execa = require('execa')
import fs = require('fs-extra')
import path = require('path')

export async function createSubGraph (vertices: number): Promise<void> {
  const files: Array<{
    path: string
    map: string
    vertices: number
  }> = []
  const folders = getFolders()

  for (const folder of folders) {
    const maps = getMaps(folder)

    for (const map of maps) {
      const verticesPath = resolvePath(['data', folder, `${map}.graph.vertices`])

      if (fs.existsSync(verticesPath)) {
        const nodes = Number(fs.readFileSync(verticesPath))
        files.push({
          map,
          path: resolvePath(['data', folder]),
          vertices: nodes
        })
      }
    }
  }

  const best = files.reduce((prev, curr) => (curr.vertices < prev.vertices && curr.vertices > vertices) || prev.vertices < vertices ? curr : prev)
  const outputPath = resolvePath(['data', best.path, `vertices-${vertices.toString()}`])

  // No need to attempt to recreate a subgraph that already exists..
  if (fs.existsSync(outputPath)) {
    return
  }

  fs.ensureDirSync(outputPath)

  fs.writeFileSync(`${outputPath}/${best.map}`, 'tmp file')
  const create = execa.command(`sh run.sh parse ${best.path} ${best.map} ${vertices} ${outputPath} ${best.vertices}`, { cwd: resolvePath('CRP') })

  if (create.stdout && create.stderr) {
    create.stdout.pipe(process.stdout)
    create.stderr.pipe(process.stderr)
  }

  await create
    .catch((err) => { console.log('parsing errored', err) })

  // Now that we've extract our base subgraph, begin parsing the actual map
  const prevEnv = { ...environment }
  environment['--skipParsingIfPossible'] = true
  environment['--folder'] = outputPath
  await initializeCRP()
  environment['--skipParsingIfPossible'] = prevEnv['--skipParsingIfPossible']
  environment['--folder'] = prevEnv['--folder']
}
