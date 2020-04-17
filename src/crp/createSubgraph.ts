import { resolvePath, environment, asyncTimeout } from '../utils'
import { onQueryResult } from '../client/onQueryResult'
import execa = require('execa')
import fs = require('fs-extra')

interface Options {
  withOutputStream?: boolean
}

export async function createSubGraph (vertices: number, { withOutputStream = false }: Options = {}): Promise<{ folder: string, map: string }> {
  const outputPath = resolvePath(['data', 'scale', `${vertices.toString()}v-${environment['--avgDegree']}avg`])
  const mapName = 'generated.osm'

  // No need to attempt to recreate a subgraph that already exists..
  if (fs.existsSync(outputPath)) {
    return {
      folder: outputPath,
      map: mapName
    }
  }

  fs.ensureDirSync(outputPath)

  fs.writeFileSync(`${outputPath}/${mapName}`, 'tmp file')
  const create = execa.command(`sh run.sh parse ${outputPath} ${mapName} ${vertices} ${environment['--avgDegree']}`, { cwd: resolvePath('CRP') })

  if (create.stdout && create.stderr) {
    if (withOutputStream) {
      onQueryResult('[TO_CLIENT_BEGIN]\n')
      create.stdout.on('data', onQueryResult)
      create.stdout.on('close', () => { onQueryResult('[END_CLIENT]\n') })
    } else {
      create.stdout.pipe(process.stdout)
      create.stderr.pipe(process.stderr)
    }
  }

  await create
    .catch((err) => { console.log('parsing errored', err) })
  await asyncTimeout()

  return {
    folder: outputPath,
    map: mapName
  }
}
