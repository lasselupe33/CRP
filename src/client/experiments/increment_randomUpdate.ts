import { setCtx } from '../onQueryResult'
import { environment, writeToCRP, resolvePath, deleteFile } from '../../utils'
import { Writable } from 'stream'
import { meta } from './increment'
import fs = require('fs-extra')
import path = require('path')

const percentages = [1, 2, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
let currentPercentageIndex = 0

let folder: string
let stream: Writable
let maxEdges: number
let onFinishCb: () => void

const finsihPromise = new Promise((resolve) => {
  onFinishCb = resolve
})

/**
 * Will continously receive tokens from the C++ input as soon as they're available
 */
function onEnd (data: string): void {
  usedInts.clear()
  const avgTimeString = /Updated weights in (.*)ms./gm.exec(data)
  const arcsString = /Found (.*) edges to update./gm.exec(data)

  if (avgTimeString && avgTimeString[1] && arcsString && arcsString[1]) {
    const res = {
      percent: percentages[currentPercentageIndex],
      avgTime: Number(avgTimeString[1]),
      arcs: Number(arcsString[1])
    }

    console.log(res)
    meta.random.push(res)
  }

  // Continue!
  currentPercentageIndex++
  if (currentPercentageIndex < percentages.length) {
    designPoint(percentages[currentPercentageIndex])
  } else {
    onFinishCb()
  }
}

function designPoint (percentage: number): void {
  // GET THE TOTAL NUMBER OF ARCS
  const updateFilePath = resolvePath(['data', folder, 'partials', `random_update_${percentages[currentPercentageIndex]}`])
  fs.ensureDirSync(path.dirname(updateFilePath))

  const eArcs: number = (maxEdges * percentage / 100)

  writeUpdateFile(eArcs, updateFilePath)

  setTimeout(() => {
    writeToCRP(stream, 'partialUpdateWeights')
    writeToCRP(stream, String(environment['--testAmount']))
    writeToCRP(stream, updateFilePath)
  }, 100)
}

export async function randomUpdate (_folder: string, _stream: Writable, _maxEdges: number): Promise<void> {
  folder = _folder
  stream = _stream
  maxEdges = _maxEdges

  setCtx({ onEnd })
  designPoint(percentages[currentPercentageIndex])

  await finsihPromise
}

const usedInts: Set<number> = new Set()

// function uniqueRandomInt (max: number): number {
//   max = Math.floor(max)
//   let int = Math.floor(Math.random() * (max))

//   while (usedInts.has(int)) {
//     int = (int + 1) % max
//   }

//   usedInts.add(int)

//   return int
// }

function writeUpdateFile (eArcs: number, path: string): void {
  deleteFile(path)

  const stream = fs.createWriteStream(path)

  stream.write(`${Math.ceil(eArcs)}\n`)

  for (let j: number = Math.ceil(eArcs) - 1; j >= 0; j--) {
    stream.cork()
    stream.write(`${j} 42\n`)
    stream.uncork()
  }

  stream.close()
}
