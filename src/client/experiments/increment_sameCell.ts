import { setCtx } from '../onQueryResult'
import { environment, writeToCRP, resolvePath } from '../../utils'
import { Writable } from 'stream'
import { meta } from './increment'

let currentCellIndex = 0
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
    test()
  } else {
    const avgTimeString = /Updated weights in (.*)ms./gm.exec(data)
    const arcsString = /Found (.*) edges to update./gm.exec(data)

    if (avgTimeString && avgTimeString[1] && arcsString && arcsString[1]) {
      const res = {
        cellIndex: currentCellIndex,
        avgTime: Number(avgTimeString[1]),
        arcs: Number(arcsString[1])
      }

      console.log(res)
      meta.sameCell.push(res)
    }

    // Continue!
    currentCellIndex++
    if (currentCellIndex < environment['--sameCellsToCheck']) {
      nextPhase = 'extract'
      extractArcs(currentCellIndex)
    } else {
      onFinishCb()
    }
  }
}

function extractArcs (cellIndex: number): void {
  updateFilePath = resolvePath(['data', folder, 'partials', `sameCell_${cellIndex}`])

  writeToCRP(stream, 'getAllArcsInCell')
  writeToCRP(stream, updateFilePath)
  writeToCRP(stream, String(cellIndex))
}

function test (): void {
  setTimeout(() => {
    writeToCRP(stream, 'partialUpdateWeights')
    writeToCRP(stream, String(environment['--testAmount']))
    writeToCRP(stream, updateFilePath)
  }, 100)
}

export async function sameCellUpdate (_folder: string, _stream: Writable): Promise<void> {
  folder = _folder
  stream = _stream

  setCtx({ onEnd })
  extractArcs(currentCellIndex)

  await finsihPromise
}
