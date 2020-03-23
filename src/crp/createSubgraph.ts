import { resolvePath, environment } from '../utils'
import { initializeCRP } from './initializeCRP'
import execa = require('execa')
import fs = require('fs-extra')

export async function createSubGraph (vertices: number): Promise<void> {
  const outputPath = resolvePath(['data', 'scale', `${vertices.toString()}v-${environment['--avgDegree']}avg`])
  const mapName = 'generated.osm'

  // No need to attempt to recreate a subgraph that already exists..
  if (fs.existsSync(outputPath)) {
    return
  }

  fs.ensureDirSync(outputPath)

  fs.writeFileSync(`${outputPath}/${mapName}`, 'tmp file')
  const create = execa.command(`sh run.sh parse ${outputPath} ${mapName} ${vertices} ${environment['--avgDegree']}`, { cwd: resolvePath('CRP') })

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
