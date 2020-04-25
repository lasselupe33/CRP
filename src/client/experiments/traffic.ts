/* eslint-disable @typescript-eslint/no-floating-promises */
import { setCtx } from '../onQueryResult'
import { writeToCRP, environment, resolvePath } from '../../utils'
import { cClient } from '../../crp'
import { Writable } from 'stream'

import path = require('path')
import fs = require('fs-extra')
import open = require('open')

const delimiter = '------------------------------------------------------------'

let stream: Writable
let map: string
let folder: string
let updateFilePath: string
let verticesPath: string

const intervalInMinutes = 15
let currentTime = 0

let phase: string = 'generate'
let trafficPaths: Array<{ src: string, dest: string}>

const visualisationData: Array<Array<{ lat: number, lon: number }>> = []
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

const output = {
  generate: {
    avgUpdateTime: 0,
    updates: [] as number[],
    maxCongestions: [] as number[],
    updatedEdges: [] as number[]
  },
  client: {
    avgQuery: 0,
    times: [] as number[]
  }
}

function runClient (): void {
  setTimeout(() => {
    writeToCRP(stream, 'trafficQuery')
    writeToCRP(stream, String(environment['--testAmount']))
    writeToCRP(stream, String(currentTime))
    writeToCRP(stream, 'yes') // Fixed vertices
  }, 100)
}

function generateNewTraffic (currentTime: number): void {
  // update metric
  setTimeout(() => {
    writeToCRP(stream, 'generateTraffic')
    writeToCRP(stream, String(environment['--cars']))
    writeToCRP(stream, String(environment['--testAmount']))
    writeToCRP(stream, String(currentTime + 30))
    writeToCRP(stream, updateFilePath)
    writeToCRP(stream, 'yes')
  }, 100)
}

/**
 * Will continously receive tokens from the C++ input as soon as they're available
 */
function onStreamedToken (token: string): void {
  switch (token) {
    case '[PREPARED]':
      console.log('Extracting edges...')
      writeToCRP(stream, 'extractEdges')
      writeToCRP(stream, String(environment['--verticesToExtract'] || environment['--testAmount']))
      break

    case '[FINISHED]':
      // During our first run we need to generate our paths
      if (!trafficPaths) {
        setTimeout(() => {
          setCtx({ onEnd, onStreamedToken: undefined })

          fs.ensureDirSync(path.dirname(verticesPath))
          fs.writeFileSync(verticesPath, JSON.stringify(data, null, 2))

          generateNewTraffic(currentTime)
        }, 100)
      }

      break
  }
}

function onEnd (data: string): void {
  switch (phase) {
    case 'client': {
      if (data.includes('[FINSINHED_JOURNEY]')) {
        writeToCRP(stream, 'exit')
        // writeVisualisation()
        logData()
        return
      } else {
        const timeString = /^Took (.*) ms. Avg = (.*) ms.$/gm.exec(data)

        if (timeString && timeString[2]) {
          output.client.times.push(Number(timeString[2]))
          output.client.avgQuery = output.client.times.reduce((acc, curr) => curr + acc) / output.client.times.length
        }
        // extractVisualisation(data)
      }

      // Generate new traffic
      phase = 'generate'
      currentTime += intervalInMinutes
      console.log(`Generating traffic with T=${currentTime}`)
      generateNewTraffic(currentTime)
      break
    }

    case 'generate': {
      const congestionString = /^Max Volume at edge (.*) at (.*) minutes. Congestion=(.*)$/gm.exec(data)
      const updateString = /^Updated weights in (.*)ms.$/gm.exec(data)
      const updatedEdgesString = /^Populating edges with cars... altered (.*) edges$/gm.exec(data)

      if (updateString && updateString[1]) {
        output.generate.updates.push(Number(updateString[1]))
        output.generate.avgUpdateTime = output.generate.updates.reduce((acc, curr) => curr + acc) / output.generate.updates.length
      }

      if (congestionString && congestionString[3]) {
        output.generate.maxCongestions.push(Number(congestionString[3]))
      }

      if (updatedEdgesString && updatedEdgesString[1]) {
        output.generate.updatedEdges.push(Number(updatedEdgesString[1]))
      }

      // Continue on client
      phase = 'client'
      console.log(`Running client with T=${currentTime}`)
      runClient()

      break
    }
  }
}

function extractVisualisation (data: string): void {
  const vertices = data
    .split('[CAR_PATH_START]\n')[1]
    .split('\n[CAR_PATH_END]')[0]
    .split(' ')

  const parsedCoordinates: Array<{ lat: number, lon: number }> = []
  for (const vertexString of vertices) {
    if (vertexString === '') {
      continue
    }

    const [lat, lon] = vertexString.split(',')

    parsedCoordinates.push({
      lat: Number(lat),
      lon: Number(lon)
    })
  }

  visualisationData.push(parsedCoordinates)
}

function writeVisualisation (): void {
  const meta = {
    lat: {
      min: Infinity,
      max: -Infinity
    },
    lon: {
      min: Infinity,
      max: -Infinity
    }
  }

  for (const path of visualisationData) {
    for (const coordinate of path) {
      if (coordinate.lat < meta.lat.min) {
        meta.lat.min = coordinate.lat
      } else if (coordinate.lat > meta.lat.max) {
        meta.lat.max = coordinate.lat
      }

      if (coordinate.lon < meta.lon.min) {
        meta.lon.min = coordinate.lon
      } else if (coordinate.lon > meta.lon.max) {
        meta.lon.max = coordinate.lon
      }
    }
  }

  const toWrite = {
    meta,
    paths: visualisationData
  }
  const fileData = `window.data = ${JSON.stringify(toWrite, null, 2)}`
  fs.writeFileSync(resolvePath(['experiments', 'visualiser', 'data.js']), fileData)
  open(resolvePath(['experiments', 'visualiser', 'index.html']), { app: 'google chrome' })
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

function logData (): void {
  console.log(delimiter)
  console.log(delimiter)
  console.log('Results')
  console.log(`Using time interval: ${intervalInMinutes} minutes.`)
  console.log(`On each interval the query update is rerun ${environment['--testAmount']} times.`)
  console.log(`Traffic simulation was based on ${environment['--cars']} cars, driving from and to the same edges of the map, 50% of the cars rerouted at each time interval`)
  console.log(delimiter)
  console.log('Generator')
  console.log()
  console.log(`Amount of updated edges at each time interval: ${output.generate.updatedEdges}`)
  console.log(`Max congestion factor at each time interval: ${output.generate.maxCongestions.map((it) => it.toFixed(2))}`)
  console.log(delimiter)
  console.log('Metric update')
  console.log()
  console.log(`Avg metric update time: ${output.generate.avgUpdateTime.toFixed(2)}ms`)
  console.log(`Metric update at each time interval: ${output.generate.updates.map((it) => `${it.toFixed(2)}ms`)}`)
  console.log(delimiter)
  console.log('Query')
  console.log()
  console.log(`Avg query time ${output.client.avgQuery.toFixed(2)}ms.`)
  console.log(`Avg query time at each time interval: ${output.client.times.map((it) => `${it.toFixed(2)}ms.`)}`)
}

export async function trafficTest (_folder: string, _map: string): Promise<void> {
  setCtx({ onStreamedToken, handleToken })
  folder = _folder
  map = _map
  verticesPath = resolvePath(['experiments', 'traffic', `vertices.${folder}.json`])
  updateFilePath = resolvePath(['data', folder, `trafficUpdate.${environment['--metric']}`])

  console.log(delimiter)
  console.log(`Generating results for traffic simulation on ${folder}.`)
  console.log(`Using ${intervalInMinutes} minutes as interval`)
  console.log(delimiter)
  await cClient(folder, map, setStream)
}
