/* eslint-disable @typescript-eslint/no-floating-promises */
import { setCtx } from '../onQueryResult'
import { writeToCRP, environment, resolvePath } from '../../utils'
import { cClient } from '../../crp'
import { Writable } from 'stream'
import { generatePairs } from '../../utils/generatePairs'
import VisualiserCallbacks from './visualiser'

import path = require('path')
import fs = require('fs-extra')

let stream: Writable
let map: string
let folder: string
let updateFilePath: string

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

function runQueryTest (): void {
  setTimeout(() => {
    if (!environment['--skipVisualise']) {
      setCtx({
        onStreamedToken,
        handleToken: VisualiserCallbacks.handleToken,
        onEnd: VisualiserCallbacks.onEnd,
        onStart: VisualiserCallbacks.onStart
      })
    }

    writeToCRP(stream, 'test')
    writeToCRP(stream, environment['--skipVisualise'] ? 'no' : 'yes')
    writeToCRP(stream, '1') // Only run query once
    writeToCRP(stream, 'no')
    writeToCRP(stream, 'no')
  }, 100)
}

/**
 * Will continously receive tokens from the C++ input as soon as they're available
 */
function onStreamedToken (token: string): void {
  switch (token) {
    case '[PREPARED]':
      if (environment['--skipExtractingCorners']) {
        runQueryTest()
      } else {
        writeToCRP(stream, 'extractEdges')
        writeToCRP(stream, String(environment['--verticesToExtract'] || environment['--testAmount']))
      }
      break

    case '[FINISHED]':
      if (environment['--skipExtractingCorners'] && currentRun === 0) {
        currentRun++
      }

      if (currentRun === 1) {
        fs.unlinkSync(updateFilePath)
        // update metric
        writeToCRP(stream, 'generateTraffic')
        writeToCRP(stream, String(environment['--testAmount']))
        writeToCRP(stream, '1')
        writeToCRP(stream, updateFilePath)
        writeToCRP(stream, environment['--skipExtractingCorners'] ? 'no' : 'yes')

        if (!environment['--skipExtractingCorners']) {
          generatePairs(folder, environment['--testAmount']).then((pairs) => {
            for (let i = 0; i < pairs.length; i++) {
              writeToCRP(stream, pairs[i].src)
              writeToCRP(stream, pairs[i].dest)
            }
          })
        }
      } else if (currentRun === 2) {
        fs.unlinkSync(updateFilePath)
        // Tmp :-)
        writeToCRP(stream, 'generateTraffic')
        writeToCRP(stream, String(environment['--testAmount']))
        writeToCRP(stream, '6')
        writeToCRP(stream, updateFilePath)
        writeToCRP(stream, 'no')
      } else if (currentRun === 3) {
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
  const pth = resolvePath(['experiments', 'traffic', `vertices.${folder}.json`])
  await fs.ensureDir(path.dirname(pth))
  await fs.writeFile(pth, JSON.stringify(data, null, 2))

  // Now that we've extracted our entry points, begin running actual experiment!
  runQueryTest()
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
  updateFilePath = resolvePath(['data', folder, `trafficUpdate.${environment['--metric']}`])
  await cClient(folder, map, setStream)
}
