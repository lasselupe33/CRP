import { setCtx } from '../onQueryResult'
import { writeToCRP, environment } from '../../utils'
import { cClient } from '../../crp'
import { Writable } from 'stream'
import axios from 'axios'

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
      // After the first run we want to update metric
      if (currentRun === 0) {
        axios(`http://localhost:3000/update/${folder}/${map}/${environment['--metric']}`)
          .then(() => {
            writeToCRP(stream, 'update')
          })
          .catch((err) => { console.error(err) })
      } else if (currentRun === 1) {
        // After we've updated our metric, then we want to run our quieries again!
        writeToCRP(stream, 'test')
        writeToCRP(stream, 'no')
        writeToCRP(stream, String(environment['--testAmount']))
        writeToCRP(stream, 'no')
        writeToCRP(stream, 'no')
      } else {
        if (environment['--exitOnEnd']) {
          writeToCRP(stream, 'exit')
          writeToCRP(stream, '')
        }
      }

      currentRun++
      break
  }
}

function setStream (newStream: Writable | null): void {
  if (newStream) {
    stream = newStream
  }
}

export async function updateMetricTest (_folder: string, _map: string): Promise<void> {
  setCtx({ onStreamedToken })
  folder = _folder
  map = _map
  await cClient(folder, map, setStream)
}
