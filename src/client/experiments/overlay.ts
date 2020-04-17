import { setCtx, onQueryResult } from '../onQueryResult'
import { partition, customize, cClient, preparse } from '../../crp'
import { environment, writeToCRP, resolvePath, asyncTimeout } from '../../utils'
import { Writable } from 'stream'
import fs = require('fs-extra')

const delimiter = '------------------------------------------------------------'
const overlayConfigurations = [
  [2 ** 10],
  [2 ** 12],
  [2 ** 14],
  [2 ** 10, 2 ** 16],
  [2 ** 10, 2 ** 18],
  [2 ** 12, 2 ** 18],
  [2 ** 12, 2 ** 20],
  [2 ** 7, 2 ** 14, 2 ** 21],
  [2 ** 8, 2 ** 14, 2 ** 20],
  [2 ** 9, 2 ** 14, 2 ** 19],
  [2 ** 10, 2 ** 15, 2 ** 20],
  [2 ** 7, 2 ** 11, 2 ** 15, 2 ** 19],
  [2 ** 8, 2 ** 12, 2 ** 16, 2 ** 20],
  [2 ** 9, 2 ** 13, 2 ** 17, 2 ** 21],
  [2 ** 10, 2 ** 14, 2 ** 18, 2 ** 22],
  [2 ** 7, 2 ** 10, 2 ** 13, 2 ** 16, 2 ** 19],
  [2 ** 8, 2 ** 11, 2 ** 14, 2 ** 17, 2 ** 20],
  [2 ** 9, 2 ** 12, 2 ** 15, 2 ** 18, 2 ** 21],
  [2 ** 10, 2 ** 13, 2 ** 16, 2 ** 19, 2 ** 22],
  [2 ** 8, 2 ** 10, 2 ** 12, 2 ** 14, 2 ** 16, 2 ** 18],
  [2 ** 9, 2 ** 11, 2 ** 13, 2 ** 15, 2 ** 17, 2 ** 19],
  [2 ** 10, 2 ** 12, 2 ** 14, 2 ** 16, 2 ** 18, 2 ** 20],
  [2 ** 8, 2 ** 10, 2 ** 12, 2 ** 14, 2 ** 16, 2 ** 18, 2 ** 20],
  [2 ** 9, 2 ** 11, 2 ** 13, 2 ** 15, 2 ** 17, 2 ** 19, 2 ** 21],
  [2 ** 10, 2 ** 12, 2 ** 14, 2 ** 16, 2 ** 18, 2 ** 20, 2 ** 22]
].map((it) => it.reverse())

const TRIALS_PER_DESIGNPOINT = 2

let currConfigIndex = 0
let currentPhase = 'partition'

let map: string
let folder: string
let stream: Writable
let startPrecalc: number

const schema = {
  partition: {
    times: [] as number[],
    avgTime: 0
  },
  preparse: {
    times: [] as number[],
    avgTime: 0,
    overlaySizesInMB: [] as number[],
    avgOverlaySizeInMB: 0
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
  const data: { [key: string]: typeof schema } = {}

  for (let i = 0; i < overlayConfigurations.length; i++) {
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
  switch (currentPhase) {
    case 'partition': {
      let timeString: RegExpExecArray | null

      switch (environment['--partitioner']) {
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
        meta[currConfigIndex].partition.times.push(Number(timeString[1]) * 1000)
        meta[currConfigIndex].partition.avgTime = meta[currConfigIndex].partition.times.reduce((acc, curr) => curr + acc) / meta[currConfigIndex].partition.times.length
      }

      break
    }

    case 'precalc': {
      meta[currConfigIndex].preparse.times.push(Date.now() - startPrecalc)
      meta[currConfigIndex].preparse.avgTime = meta[currConfigIndex].preparse.times.reduce((acc, curr) => curr + acc) / meta[currConfigIndex].preparse.times.length

      meta[currConfigIndex].preparse.overlaySizesInMB.push(fs.statSync(resolvePath(['data', folder, `${map}.overlay`])).size / 1000000)
      meta[currConfigIndex].preparse.avgOverlaySizeInMB = meta[currConfigIndex].preparse.overlaySizesInMB.reduce((acc, curr) => curr + acc) / meta[currConfigIndex].preparse.overlaySizesInMB.length
      break
    }

    case 'customize': {
      const timeString = /^Took (.*) ms$/gm.exec(data)
      const weightString = /^Amount of weights = (.*)$/gm.exec(data)

      if (timeString && timeString[1]) {
        meta[currConfigIndex].customization.times.push(Number(timeString[1]))
        meta[currConfigIndex].customization.avgTime = meta[currConfigIndex].customization.times.reduce((acc, curr) => curr + acc) / meta[currConfigIndex].customization.times.length
      }

      if (weightString && weightString[1]) {
        meta[currConfigIndex].customization.weights.push(Number(weightString[1]))
        meta[currConfigIndex].customization.avgWrittenWeights = meta[currConfigIndex].customization.weights.reduce((acc, curr) => curr + acc) / meta[currConfigIndex].customization.weights.length
        meta[currConfigIndex].customization.sizesInMB.push(fs.statSync(resolvePath(['data', folder, 'metrics', environment['--metric']])).size / 1000000)
        meta[currConfigIndex].customization.avgSizeInMB = meta[currConfigIndex].customization.sizesInMB.reduce((acc, curr) => curr + acc) / meta[currConfigIndex].customization.sizesInMB.length
      }

      break
    }

    case 'query': {
      const timeString = /Par Took (.*) ms. Avg = (.*) ms./gm.exec(data)
      const updateString = /Metric update took (.*) ms./gm.exec(data)

      if (timeString) {
        meta[currConfigIndex].query.times.push(Number(timeString[2]))
        meta[currConfigIndex].query.avgTime = meta[currConfigIndex].query.times.reduce((acc, curr) => curr + acc) / meta[currConfigIndex].query.times.length
      }

      if (updateString) {
        meta[currConfigIndex].query.loadTimes.push(Number(updateString[1]))
        meta[currConfigIndex].query.avgLoadTime = meta[currConfigIndex].query.loadTimes.reduce((acc, curr) => curr + acc) / meta[currConfigIndex].query.loadTimes.length
      }
    }
  }
}

async function designPoint (): Promise<void> {
  console.log(delimiter)
  console.log(`Parsing results for L-config ${overlayConfigurations[currConfigIndex].join(':')}`)
  console.log(delimiter)

  for (let i = 0; i < TRIALS_PER_DESIGNPOINT; i++) {
    setCtx({ onEnd, onStreamedToken: undefined })
    currentPhase = 'partition'
    console.log(`Partitioning(${i + 1}/${TRIALS_PER_DESIGNPOINT}) - ${environment['--partitioner']}(${environment['--pconfig']})`)
    await partition(folder, map, {
      withOutputStream: true,
      configuration: environment['--pconfig'],
      partitioner: environment['--partitioner'],
      L: overlayConfigurations[currConfigIndex]
    })

    currentPhase = 'precalc'
    console.log(`Preparse(${i + 1}/${TRIALS_PER_DESIGNPOINT})`)
    startPrecalc = Date.now()
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
  console.log(`Results for L-config ${overlayConfigurations[currConfigIndex].join(':')}`)
  console.log(delimiter)

  console.log('Partitioning')
  console.log()
  console.log(`Avg: ${meta[currConfigIndex].partition.avgTime.toFixed(2)}ms`)
  console.log(meta[currConfigIndex].partition.times.map((it) => `${it.toFixed(2)}ms`))
  console.log(delimiter)

  console.log('Preprocessing')
  console.log()
  console.log(`Avg. time: ${meta[currConfigIndex].preparse.avgTime.toFixed(2)}ms`)
  console.log(meta[currConfigIndex].preparse.times.map((it) => `${it.toFixed(2)}ms`))
  console.log()
  console.log(`Avg. overlay size: ${meta[currConfigIndex].preparse.avgOverlaySizeInMB} MB`)
  console.log(meta[currConfigIndex].preparse.overlaySizesInMB.map((it) => `${it} MB`))
  console.log(delimiter)

  console.log('Customization')
  console.log()
  console.log(`AvgTime: ${meta[currConfigIndex].customization.avgTime.toFixed(2)}ms`)
  console.log(meta[currConfigIndex].customization.times.map((it) => `${it.toFixed(2)}ms`))
  console.log()
  console.log(`AvgWeights: ${meta[currConfigIndex].customization.avgWrittenWeights} weights`)
  console.log(meta[currConfigIndex].customization.weights.map((it) => `${it} weights`))
  console.log()
  console.log(`Avg weights size ${environment['--metric']}: ${meta[currConfigIndex].customization.avgSizeInMB} MB`)
  console.log(meta[currConfigIndex].customization.sizesInMB.map((it) => `${it} MB`))
  console.log(delimiter)

  console.log('Query')
  console.log()
  console.log(`Avg: ${meta[currConfigIndex].query.avgTime.toFixed(2)}ms`)
  console.log(meta[currConfigIndex].query.times.map((it) => `${it.toFixed(2)}ms`))
  console.log(`Trials pr iteration: ${environment['--testAmount']}`)
  console.log()
  console.log(`Metric load time: ${meta[currConfigIndex].query.avgLoadTime.toFixed(2)}ms`)
  console.log(meta[currConfigIndex].query.loadTimes.map((it) => `${it.toFixed(2)}ms`))
  console.log(delimiter)
}

function setStream (newStream: Writable | null): void {
  if (newStream) {
    stream = newStream
  }
}

export async function overlayTest (_folder: string, _map: string): Promise<void> {
  folder = _folder
  map = _map

  for (let i = 0; i < overlayConfigurations.length; i++) {
    currConfigIndex = i
    await designPoint()
  }

  process.exit(0)
}
