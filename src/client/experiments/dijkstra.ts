import { setCtx } from '../onQueryResult'
import { cClient } from '../../crp'
import { environment, writeToCRP, asyncTimeout, getMaps, deleteFile, resolvePath } from '../../utils'
import { Writable } from 'stream'
import { generatePairs } from '../../utils/generatePairs'
import fs = require('fs-extra')
import path = require('path')

const delimiter = '------------------------------------------------------------'
const maps = ['germanyplus']

let currMapIndex = 0
let currentClientIndex = 0

let phase: string = 'extract'
let stream: Writable
let fixedVerticesPath: string

let folder: string
let map: string

const fixedData: {
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

function resetFixedData (): void {
  fixedData.bottomLeft = []
  fixedData.bottomRight = []
  fixedData.topLeft = []
  fixedData.topRight = []
}

const schema = {
  query: {
    time: 0,
    dijkTime: 0,
    correct: 0,
    total: 0
  },
  fixed: {
    time: 0,
    dijkTime: 0,
    correct: 0,
    total: 0
  }
}

const meta = (() => {
  // @ts-ignore
  const data: { [key: string]: typeof schema } = {}

  for (let i = 0; i < maps.length; i++) {
    // @ts-ignore
    data[i] = JSON.parse(JSON.stringify(schema))
  }

  return data
})()

/**
 * Will be called to start the query test on
 */
function onStreamedToken (token: string): void {
  switch (token) {
    // Once the C++ client has been prepared, then immedieately start the
    // visualization test
    case '[PREPARED]':
      deleteFile(fixedVerticesPath)
      writeToCRP(stream, 'extractEdges')
      writeToCRP(stream, String(environment['--verticesToExtract'] || environment['--testAmount']))
      break

    case '[FINISHED]':
      if (currentClientIndex === 0) {
        setTimeout(() => {
          fs.ensureDirSync(path.dirname(fixedVerticesPath))
          fs.writeFileSync(fixedVerticesPath, JSON.stringify(fixedData, null, 2))
          console.log('Generated vertices')

          phase = 'query'
          writeToCRP(stream, 'test') // Specify we desire to test
          writeToCRP(stream, 'no') // No output of visuablisation data
          writeToCRP(stream, String(environment['--testAmount']))
          writeToCRP(stream, 'no') // Fixed vertices
          writeToCRP(stream, 'yes') // Dijkstra
        }, 100)
      } else if (currentClientIndex === 1) {
        setTimeout(() => {
          phase = 'query-fixed'
          console.log('Finished query without fixed')
          writeToCRP(stream, 'test') // Specify we desire to test
          writeToCRP(stream, 'no') // No output of visuablisation data
          writeToCRP(stream, String(environment['--testAmount']))
          writeToCRP(stream, 'yes') // Fixed vertices
          writeToCRP(stream, 'yes') // Dijkstra

          generatePairs(folder, environment['--testAmount'], fixedVerticesPath).then((pairs) => {
            for (let i = 0; i < pairs.length; i++) {
              writeToCRP(stream, pairs[i].src)
              writeToCRP(stream, pairs[i].dest)
            }
          }).catch((err) => { console.error(err) })
        }, 100)
      } else {
        console.log('Finished query with fixed')

        setTimeout(() => {
          // Reset phase for next iteration
          phase = 'extract'
          writeToCRP(stream, 'exit')
          writeToCRP(stream, '\n\n')
        }, 100)
      }

      currentClientIndex++
      break
  }
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
  if (phase !== 'extract') {
    return
  }

  if (token.includes('start__')) {
    currentCorner = token.split('__')[1] as Corners
    return
  }

  switch (currentCorner) {
    case Corners.bottomLeft:
      fixedData.bottomLeft.push(token)
      break

    case Corners.bottomRight:
      fixedData.bottomRight.push(token)
      break

    case Corners.topLeft:
      fixedData.topLeft.push(token)
      break

    case Corners.topRight:
      fixedData.topRight.push(token)
      break
  }
}

/**
 * Will continously receive tokens from the C++ input as soon as they're available
 */
function onEnd (data: string): void {
  switch (phase) {
    case 'query-fixed':
    case 'query': {
      console.log(data)
      const timeString = /Bi Took (.*) ms. Avg = (.*) ms./gm.exec(data)
      const dijkTimeString = /Dijkstra Took (.*) ms. Avg = (.*) ms./gm.exec(data)
      const correctnessString = /Correct: (.*)\/(.*)/gm.exec(data)

      if (timeString) {
        meta[currMapIndex][phase === 'query-fixed' ? 'fixed' : 'query'].time = Number(timeString[2])
      }

      if (dijkTimeString) {
        meta[currMapIndex][phase === 'query-fixed' ? 'fixed' : 'query'].dijkTime = Number(dijkTimeString[2])
      }

      if (correctnessString) {
        meta[currMapIndex][phase === 'query-fixed' ? 'fixed' : 'query'].correct = Number(correctnessString[1])
        meta[currMapIndex][phase === 'query-fixed' ? 'fixed' : 'query'].total = Number(correctnessString[2])
      }
      break
    }
  }
}

async function designPoint (): Promise<void> {
  console.log(delimiter)
  console.log(`Parsing results for ${folder}`)
  console.log(delimiter)

  await cClient(folder, map, setStream)
  await asyncTimeout()

  console.log(delimiter)
  console.log(`Results for ${folder}`)
  console.log(delimiter)

  console.log('Random Query')
  console.log()
  console.log(`CRP, Avg: ${meta[currMapIndex].query.time.toFixed(2)}ms`)
  console.log(`Dijkstra, Avg: ${meta[currMapIndex].query.dijkTime.toFixed(2)}ms`)
  console.log()
  console.log(`Correctness: ${meta[currMapIndex].query.correct}/${meta[currMapIndex].query.total} (${meta[currMapIndex].query.correct / meta[currMapIndex].query.total * 100}%)`)
  console.log(delimiter)
  console.log('Worst case queries')
  console.log()
  console.log(`CRP, Avg: ${meta[currMapIndex].fixed.time.toFixed(2)}ms`)
  console.log(`Dijkstra, Avg: ${meta[currMapIndex].fixed.dijkTime.toFixed(2)}ms`)
  console.log()
  console.log(`Correctness: ${meta[currMapIndex].fixed.correct}/${meta[currMapIndex].fixed.total} (${meta[currMapIndex].fixed.correct / meta[currMapIndex].fixed.total * 100}%)`)
  console.log(delimiter)
}

function setStream (newStream: Writable | null): void {
  if (newStream) {
    stream = newStream
  }
}

export async function dijkstraTest (): Promise<void> {
  setCtx({ onEnd, onStreamedToken, handleToken, disableLogging: true })

  for (let i = 0; i < maps.length; i++) {
    currentClientIndex = 0
    currMapIndex = i
    folder = maps[currMapIndex]
    map = getMaps(folder)[0]
    fixedVerticesPath = resolvePath(['experiments', 'dijkstra', `vertices.${folder}.json`])
    resetFixedData()

    await designPoint()
  }

  process.exit(0)
}
