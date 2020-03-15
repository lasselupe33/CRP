/* eslint-disable @typescript-eslint/no-floating-promises */
import { setCtx } from '../onQueryResult'
import { writeToCRP, environment, resolvePath } from '../../utils'
import { cClient } from '../../crp'
import { Writable } from 'stream'
import { generatePairs } from '../../utils/generatePairs'
import VisualiserCallbacks from './visualiser'

import fs = require('fs-extra')

let stream: Writable
let map: string
let folder: string
let onWrittenEdges: () => void
const onEndPromise = new Promise((resolve) => { onWrittenEdges = resolve })

let currentRun = 0
const data: {
  topLeft: string[]
  topRight: string[]
  bottomLeft: string[]
  bottomRight: string[]
} = {
  topLeft: [],
  topRight: [],
  bottomLeft: [],
  bottomRight: []
}

/**
 * Will continously receive tokens from the C++ input as soon as they're available
 */
function onStreamedToken (token: string): void {
  switch (token) {
    case '[PREPARED]':
      writeToCRP(stream, 'extractEdges')
      writeToCRP(stream, String(environment['--testAmount']))

      break

    case '[FINISHED]':
      if (currentRun === 0) {
        // We finished extracting edges, save them now..
        onEndPromise.then(() => {
          setCtx({
            onStreamedToken,
            handleToken: VisualiserCallbacks.handleToken,
            onEnd: VisualiserCallbacks.onEnd,
            onStart: VisualiserCallbacks.onStart
          })

          writeToCRP(stream, 'fixed-test')
          writeToCRP(stream, 'yes')
          writeToCRP(stream, String(environment['--testAmount']))

          generatePairs(environment['--testAmount']).then((pairs) => {
            for (let i = 0; i < pairs.length; i++) {
              writeToCRP(stream, pairs[i].src)
              writeToCRP(stream, pairs[i].dest)
            }
          })
        })
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

async function onEnd (): Promise<void> {
  await fs.writeFile(resolvePath(['experiments', 'traffic', 'edges.json']), JSON.stringify(data, null, 2))
  onWrittenEdges()
}

enum Corners {
  topLeft = 'Top-left',
  topRight = 'Top-right',
  bottomLeft = 'Bottom-left',
  bottomRight = 'Bottom-right'
}

let currentCorner: Corners

/**
 * Handles a single token from a stream of relevant tokens received from the C++
 * client, once the END_STRING has been received
 *
 * A token is considered relevant once it is within START_STRING and PAUSE_STRING
 */
function handleToken (token: string, delimiter?: string): void {
  if (token.includes('start__')) {
    currentCorner = token.split('__')[1] as Corners
    return
  }

  switch (currentCorner) {
    case Corners.bottomLeft:
      data.bottomLeft.push(token)
      break

    case Corners.bottomRight:
      data.bottomRight.push(token)
      break

    case Corners.topLeft:
      data.topLeft.push(token)
      break

    case Corners.topRight:
      data.topRight.push(token)
      break
  }
}

function setStream (newStream: Writable | null): void {
  if (newStream) {
    stream = newStream
  }
}

export async function trafficTest (_folder: string, _map: string): Promise<void> {
  setCtx({ onStreamedToken, handleToken, onEnd, onStart: VisualiserCallbacks.onStart })
  folder = _folder
  map = _map
  await cClient(folder, map, setStream)
}
