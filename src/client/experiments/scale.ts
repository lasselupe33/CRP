import { setCtx } from '../onQueryResult'
import { writeToCRP, environment } from '../../utils'
import { cClient, createSubGraph } from '../../crp'
import { Writable } from 'stream'

let stream: Writable
let map: string
let folder: string

let currentRun = 0

/**
 * Will continously receive tokens from the C++ input as soon as they're available
 */
function onStreamedToken (token: string): void {
  switch (token) {
    case '[PREPARED]':
      writeToCRP(stream, 'test')
      writeToCRP(stream, 'no')
      writeToCRP(stream, String(environment['--testAmount']))
      writeToCRP(stream, 'no')
      writeToCRP(stream, 'no')

      break

    case '[FINISHED]':

      currentRun++
      break
  }
}

function setStream (newStream: Writable | null): void {
  if (newStream) {
    stream = newStream
  }
}

export async function scaleTest (_folder: string, _map: string): Promise<void> {
  setCtx({ onStreamedToken })
  folder = _folder
  map = _map

  for (const scale of environment['--scales']) {
    console.log('Using subgraph of size', scale)
    await createSubGraph(scale)
  }

  // await cClient(folder, map, setStream)
}
