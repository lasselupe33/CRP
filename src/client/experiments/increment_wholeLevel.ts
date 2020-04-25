import { setCtx } from '../onQueryResult'
import { environment, writeToCRP, resolvePath } from '../../utils'
import { Writable } from 'stream'
import { meta } from './increment'
import fs = require('fs-extra')

let currentLevelIndex = 1
let nextPhase = 'extract'

let folder: string
let stream: Writable
let onFinishCb: () => void
let updateFilePath: string

const finsihPromise = new Promise((resolve) => {
  onFinishCb = resolve
})

/**
 * Will continously receive tokens from the C++ input as soon as they're available
 */
function onEnd (data: string): void {
  if (nextPhase === 'extract') {
    nextPhase = 'test'

    setTimeout(() => {
      const writtenFile = fs.readFileSync(updateFilePath, 'utf8')
      const exceededTopLevel = writtenFile === '0\n'
      if (exceededTopLevel) {
        onFinishCb()
      } else {
        test()
      }
    }, 100)
  } else {
    const avgTimeString = /Updated weights in (.*)ms./gm.exec(data)
    const arcsString = /Found (.*) edges to update./gm.exec(data)

    if (avgTimeString && avgTimeString[1] && arcsString && arcsString[1]) {
      const res = {
        level: currentLevelIndex,
        avgTime: Number(avgTimeString[1]),
        boundaryArcs: Number(arcsString[1])
      }

      console.log(res)
      meta.wholeLevel.push(res)
    }

    // Continue!
    currentLevelIndex++
    nextPhase = 'extract'
    extractArcs(currentLevelIndex)
  }
}

function extractArcs (level: number): void {
  updateFilePath = resolvePath(['data', folder, 'partials', `wholeLevel_${level}`])

  writeToCRP(stream, 'getDiffArcsOnLevel')
  writeToCRP(stream, updateFilePath)
  writeToCRP(stream, String(level))
}

function test (): void {
  setTimeout(() => {
    writeToCRP(stream, 'partialUpdateWeights')
    writeToCRP(stream, String(environment['--testAmount']))
    writeToCRP(stream, updateFilePath)
  }, 100)
}

export async function wholeLevelUpdate (_folder: string, _stream: Writable): Promise<void> {
  folder = _folder
  stream = _stream

  setCtx({ onEnd })
  extractArcs(currentLevelIndex)

  await finsihPromise
}
