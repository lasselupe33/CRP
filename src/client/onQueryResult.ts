import { resolvePath } from '../utils'
import fs = require('fs-extra')

let isRelevantData = false

const START_STRING = '[TO_CLIENT_BEGIN]'
const END_STRING = '[TO_CLIENT_END]'
const END_CLIENT = '[END_CLIENT]'

let currPathIndex = -1
let paths: Array<Array<{lat: number, lon: number}>> = []
let meta = setMeta()
let queryResult: string = ''
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

async function end (): Promise<void> {
  const toWrite = {
    meta,
    paths
  }

  const fileData = `window.data = ${JSON.stringify(toWrite, null, 2)}`
  await fs.writeFile(resolvePath(['visualiser', 'data.js']), fileData)

  currPathIndex = -1
  paths = []
  meta = setMeta()
  lat = undefined
  lon = undefined
  queryResult = ''
  isRelevantData = false
}

function handleToken (print: boolean, token: string, delimiter?: string): void {
  switch (token) {
    case START_STRING:
      if (!print) currPathIndex++
      isRelevantData = true
      return

    case END_STRING:
      isRelevantData = false
      return

    case END_CLIENT:
      end()
        .catch((err) => { console.error(err) })
      return
  }

  if (isRelevantData) {
    if (print || token === '') {
      return
    }

    if (!lat) {
      lat = Number(token)

      if (lat === 0) {
        console.log(token)
      }

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
  } else if (print) {
    process.stdout.write(`${token}${delimiter}`)
  }
}

function parseQueryResult (): void {
  let token: string = ''
  let char: string = ''

  for (let i = 0; i < queryResult.length - 1; i++) {
    char = queryResult.charAt(i)

    if (char === ' ' || char === '\n') {
      handleToken(false, token, char)
      token = ''
    } else {
      token += char
    }
  }
}

export function onQueryResult (chunk: Buffer): void {
  const line = chunk.toString()
  queryResult += line

  let token: string = ''
  let char: string = ''

  for (let i = 0; i < line.length - 1; i++) {
    char = line.charAt(i)

    if (char === ' ' || char === '\n') {
      handleToken(true, token, char)
      token = ''
    } else {
      token += char
    }
  }

  handleToken(true, token, '\n')

  if (chunk.includes(END_CLIENT)) {
    parseQueryResult()
  }
}
