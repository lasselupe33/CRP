import { setCtx, onQueryResult } from '../onQueryResult'
import { partition, customize, cClient, preparse } from '../../crp'
import { environment, writeToCRP, resolvePath, asyncTimeout } from '../../utils'
import { Writable } from 'stream'
import fs = require('fs-extra')

const delimiter = '--------------------------------'
const partitioners = ['buffoon-fast', 'buffoon-eco', 'buffoon-strong', 'kaffpa-fast', 'kaffpa-eco', 'kaffpa-strong', 'metis-fast', 'metis-strong']

const TRIALS_PER_DESIGNPOINT = 5

let currentParitioner = partitioners[0]
let currentPhase = 'partition'

let map: string
let folder: string
let stream: Writable

const schema = {
  construction: {
    times: [] as number[],
    avgTime: 0
  },
  customization: {
    times: [] as number[],
    avgTime: 0,
    weights: [] as number[],
    avgWrittenWeights: 0,
    sizesInMB: [] as number[],
    avgSizeInMB: 0
  },
  query: {
    times: [] as number[],
    avgTime: 0,
    avgLoadTime: 0,
    loadTimes: [] as number[]
  }
}

const meta = (() => {
  // @ts-ignore
  const data: { [key: string]: typeof schema} = {}

  for (const partitioner of partitioners) {
    // @ts-ignore
    data[partitioner] = JSON.parse(JSON.stringify(schema))
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
      writeToCRP(stream, 'test') // Specify we desire to test
      writeToCRP(stream, 'no') // No output of visuablisation data
      writeToCRP(stream, String(environment['--testAmount']))
      writeToCRP(stream, 'no')
      writeToCRP(stream, 'no')
      break

    case '[FINISHED]':
      writeToCRP(stream, 'exit')
      writeToCRP(stream, '\n\n')

      break
  }
}

/**
 * Will continously receive tokens from the C++ input as soon as they're available
 */
function onEnd (data: string): void {
  const [partitioner] = currentParitioner.split('-')

  switch (currentPhase) {
    case 'partition': {
      let timeString: RegExpExecArray | null

      switch (partitioner) {
        case 'metis':
          timeString = /([\d.]*) sec(\s*)\(METIS time\)(\s*)$/gm.exec(data)
          break

        case 'buffoon':
        case 'kaffpa':
        default:
          timeString = /^time spent for partitioning (.*)$/gm.exec(data)
          break
      }

      if (timeString && timeString[1]) {
        meta[currentParitioner].construction.times.push(Number(timeString[1]) * 1000)
        meta[currentParitioner].construction.avgTime = meta[currentParitioner].construction.times.reduce((acc, curr) => curr + acc) / meta[currentParitioner].construction.times.length
      }

      break
    }

    case 'customize': {
      const timeString = /^Took (.*) ms$/gm.exec(data)
      const weightString = /^Amount of weights = (.*)$/gm.exec(data)

      if (timeString && timeString[1]) {
        meta[currentParitioner].customization.times.push(Number(timeString[1]))
        meta[currentParitioner].customization.avgTime = meta[currentParitioner].customization.times.reduce((acc, curr) => curr + acc) / meta[currentParitioner].customization.times.length
      }

      if (weightString && weightString[1]) {
        meta[currentParitioner].customization.weights.push(Number(weightString[1]))
        meta[currentParitioner].customization.avgWrittenWeights = meta[currentParitioner].customization.weights.reduce((acc, curr) => curr + acc) / meta[currentParitioner].customization.weights.length
        meta[currentParitioner].customization.sizesInMB.push(fs.statSync(resolvePath(['data', folder, 'metrics', environment['--metric']])).size / 1000000)
        meta[currentParitioner].customization.avgSizeInMB = meta[currentParitioner].customization.sizesInMB.reduce((acc, curr) => curr + acc) / meta[currentParitioner].customization.sizesInMB.length
      }

      break
    }

    case 'query': {
      const timeString = /Par Took (.*) ms. Avg = (.*) ms./gm.exec(data)
      const updateString = /Metric update took (.*) ms./gm.exec(data)

      if (timeString) {
        meta[currentParitioner].query.times.push(Number(timeString[2]))
        meta[currentParitioner].query.avgTime = meta[currentParitioner].query.times.reduce((acc, curr) => curr + acc) / meta[currentParitioner].query.times.length
      }

      if (updateString) {
        meta[currentParitioner].query.loadTimes.push(Number(updateString[1]))
        meta[currentParitioner].query.avgLoadTime = meta[currentParitioner].query.loadTimes.reduce((acc, curr) => curr + acc) / meta[currentParitioner].query.loadTimes.length
      }
    }
  }
}

async function designPoint (p: string): Promise<void> {
  currentParitioner = p
  const [partitioner, configuration] = p.split('-')

  console.log(delimiter)
  console.log(`Parsing results for ${partitioner}(${configuration})`)
  console.log(delimiter)

  for (let i = 0; i < TRIALS_PER_DESIGNPOINT; i++) {
    setCtx({ onEnd, onStreamedToken: undefined })
    currentPhase = 'partition'
    console.log(`Partitioning(${i + 1}/${TRIALS_PER_DESIGNPOINT})`)
    await partition(folder, map, { withOutputStream: true, configuration, partitioner })

    currentPhase = 'precalc'
    console.log(`Preparse(${i + 1}/${TRIALS_PER_DESIGNPOINT})`)
    await preparse(folder, map, { withOutputStream: true })

    currentPhase = 'customize'
    console.log(`Customize(${i + 1}/${TRIALS_PER_DESIGNPOINT})`)
    await customize(folder, map, environment['--metric'], { withOutputStream: true })

    currentPhase = 'query'
    setCtx({ onEnd, onStreamedToken })
    console.log(`Query(${i + 1}/${TRIALS_PER_DESIGNPOINT})`)
    onQueryResult('[TO_CLIENT_BEGIN]\n')
    await cClient(folder, map, setStream)
    onQueryResult('[END_CLIENT]\n')
    await asyncTimeout()
  }

  console.log(delimiter)
  console.log(`Results for ${partitioner}(${configuration})`)
  console.log(delimiter)

  console.log('Partitioning')
  console.log()
  console.log(`Avg: ${meta[currentParitioner].construction.avgTime.toFixed(2)}ms`)
  console.log(meta[currentParitioner].construction.times.map((it) => `${it.toFixed(2)}ms`))
  console.log(delimiter)

  console.log('Customization')
  console.log()
  console.log(`AvgTime: ${meta[currentParitioner].customization.avgTime.toFixed(2)}ms`)
  console.log(meta[currentParitioner].customization.times.map((it) => `${it.toFixed(2)}ms`))
  console.log()
  console.log(`AvgWeights: ${meta[currentParitioner].customization.avgWrittenWeights} weights`)
  console.log(meta[currentParitioner].customization.weights.map((it) => `${it} weights`))
  console.log()
  console.log(`AvgSize: ${meta[currentParitioner].customization.avgSizeInMB} MB`)
  console.log(meta[currentParitioner].customization.sizesInMB.map((it) => `${it} MB`))
  console.log(delimiter)

  console.log('Query')
  console.log()
  console.log(`Avg: ${meta[currentParitioner].query.avgTime.toFixed(2)}ms`)
  console.log(meta[currentParitioner].query.times.map((it) => `${it.toFixed(2)}ms`))
  console.log(`Trials pr iteration: ${environment['--testAmount']}`)
  console.log()
  console.log(`Load: ${meta[currentParitioner].query.avgLoadTime.toFixed(2)}ms`)
  console.log(meta[currentParitioner].query.loadTimes.map((it) => `${it.toFixed(2)}ms`))
  console.log(delimiter)
}

function setStream (newStream: Writable | null): void {
  if (newStream) {
    stream = newStream
  }
}

export async function partitionersTest (_folder: string, _map: string): Promise<void> {
  folder = _folder
  map = _map

  for (const p of partitioners) {
    await designPoint(p)
  }

  process.exit(0)
}
