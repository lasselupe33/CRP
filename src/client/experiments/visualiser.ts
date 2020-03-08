import { setCtx } from '../onQueryResult'
import { resolvePath, writeToCRP, environment } from '../../utils'
import { cClient } from '../../crp'
import { Writable } from 'stream'

import open = require('open')
import fs = require('fs-extra')

let stream: Writable
let currPathIndex = -1
let paths: Array<Array<{ lat: number, lon: number }>> = []
let meta = setMeta()
let lat: number | undefined
let lon: number | undefined

function setMeta (): { lat: { min: number, max: number }, lon: { min: number, max: number } } {
  return {
    lat: {
      min: Infinity,
      max: -Infinity
    },
    lon: {
      min: Infinity,
      max: -Infinity
    }
  }
}

/**
 * Callback to be executed once we begin actually handling input from C++, by
 * receiving the START_STRING from std::in
 */
async function onStart (print: boolean): Promise<void> {
  if (!print) currPathIndex++

  return new Promise((resolve) => resolve)
}

/**
 * Callback to be executed once END_STRING has been recieved by C++ client
 */
async function onEnd (): Promise<void> {
  const toWrite = {
    meta,
    paths
  }

  const fileData = `window.data = ${JSON.stringify(toWrite)}`
  await fs.writeFile(resolvePath(['visualiser', 'data.js']), fileData)

  currPathIndex = -1
  paths = []
  meta = setMeta()
  lat = undefined
  lon = undefined

  await open(resolvePath(['visualiser', 'index.html']), { app: 'google chrome' })
}

/**
 * Handles a single token from a stream of relevant tokens received from the C++
 * client, once the END_STRING has been received
 *
 * A token is considered relevant once it is within START_STRING and PAUSE_STRING
 */
function handleToken (token: string, delimiter?: string): void {
  if (!lat) {
    lat = Number(token)

    meta.lat.min = Math.min(meta.lat.min, lat)
    meta.lat.max = Math.max(meta.lat.max, lat)
    return
  } else {
    lon = Number(token)

    meta.lon.min = Math.min(meta.lon.min, lon)
    meta.lon.max = Math.max(meta.lon.max, lon)
  }

  const vertex = {
    lat,
    lon
  }

  if (!paths[currPathIndex]) {
    paths[currPathIndex] = [vertex]
  } else {
    paths[currPathIndex].push(vertex)
  }

  lat = undefined
  lon = undefined
}

/**
 * Will continously receive tokens from the C++ input as soon as they're available
 */
function onStreamedToken (token: string): void {
  switch (token) {
    // Once the C++ client has been prepared, then immedieately start the
    // visualization test
    case '[PREPARED]':
      writeToCRP(stream, 'test') // Specify we desire to test
      writeToCRP(stream, 'yes') // Enforce output of visuablisation data
      writeToCRP(stream, String(environment['--testAmount']))
      break

    case '[FINISHED]':
      if (environment['--exitOnEnd']) {
        writeToCRP(stream, 'exit')
        writeToCRP(stream, '')
      }

      break
  }
}

function setStream (newStream: Writable | null): void {
  if (newStream) {
    stream = newStream
  }
}

export async function visualiserTest (folder: string, map: string): Promise<void> {
  setCtx({ onStart, handleToken, onStreamedToken, onEnd })
  await cClient(folder, map, setStream)
}
