import { Writable } from 'stream'
import { setCtx, onQueryResult } from '../onQueryResult'
import { cClient } from '../../crp'
import { randomUpdate } from './increment_randomUpdate'
import { environment, asyncTimeout, writeToCRP } from '../../utils'
import { sameCellUpdate } from './increment_sameCell'
import { wholeLevelUpdate } from './increment_wholeLevel'

const delimiter = '------------------------------------------------------------'

let folder: string
let map: string
let stream: Writable

interface RandomData {
  percent: number
  avgTime: number
  arcs: number
}

interface SameCellData {
  cellIndex: number
  avgTime: number
  arcs: number
}

interface LevelData {
  level: number
  avgTime: number
  boundaryArcs: number
}

export const meta = {
  default: 0,
  random: [] as RandomData[],
  sameCell: [] as SameCellData[],
  wholeLevel: [] as LevelData[]
}

/**
 * Will be called to start the query test on
 */
function onStreamedToken (token: string, delimiter?: string): void {
  process.stdout.write(`${token}${delimiter}`)
  switch (token) {
    // Once the C++ client has been prepared, then immedieately start the
    // visualization test
    case '[PREPARED]':
      onQueryResult('[FINISHED]')
      break
  }
}

async function onEnd (data: string): Promise<void> {
  const normalUpdateTime = /^Metric update took (.*) ms.$/gm.exec(data)
  const edgesRegex = /^Reading graph with (.*) vertices and (.*) edges/gm.exec(data)
  const edges = edgesRegex ? Number(edgesRegex[2]) : environment['--maxArcs']

  if (normalUpdateTime && normalUpdateTime[1]) {
    meta.default = Number(normalUpdateTime[1])
  }

  setCtx({ onStreamedToken: undefined, onEnd: undefined })

  await randomUpdate(folder, stream, edges)
  await asyncTimeout(10)
  await sameCellUpdate(folder, stream)
  await asyncTimeout(10)
  await wholeLevelUpdate(folder, stream)
  printData()
  writeToCRP(stream, 'exit')
  writeToCRP(stream, '\n\n')
  process.exit(0)
}

function setStream (newStream: Writable | null): void {
  if (newStream) {
    stream = newStream
  }
}

export async function incrementTest (_folder: string, _map: string): Promise<void> {
  folder = _folder
  map = _map

  setCtx({ onStreamedToken, onEnd, disableLogging: true })
  await cClient(folder, map, setStream)
}

function printData (): void {
  console.log(delimiter)
  console.log(`Results for ${folder}`)
  console.log(`Updated metrics ${environment['--testAmount']} times in each design point`)
  console.log(delimiter)

  console.log('Baseline metric update')
  console.log()
  console.log(`${meta.default.toFixed(2)}ms`)
  console.log(delimiter)

  console.log('Fixed percentage of edges')
  meta.random.forEach((point) => {
    console.log()
    console.log(`Arcs altered: ${point.arcs} (${point.percent}%)`)
    console.log(`Avg time to update metric: ${point.avgTime.toFixed(2)}ms`)
  })
  console.log(delimiter)

  console.log('Same cell updates')
  meta.sameCell.forEach((point) => {
    console.log()
    console.log(`Affected cellIndex: ${point.cellIndex}`)
    console.log(`Arcs altered: ${point.arcs}`)
    console.log(`Avg time to update metric: ${point.avgTime.toFixed(2)}ms`)
  })
  console.log(delimiter)

  console.log('Whole level updates')
  meta.wholeLevel.forEach((point) => {
    console.log()
    console.log(`Affected level: ${point.level}`)
    console.log(`Boundary arcs altered: ${point.boundaryArcs}`)
    console.log(`Avg time to update metric: ${point.avgTime.toFixed(2)}ms`)
  })
  console.log(delimiter)
}
