import { setCtx, onQueryResult } from '../onQueryResult'
import { partition, customize, cClient, preparse, createSubGraph } from '../../crp'
import { environment, writeToCRP, resolvePath, asyncTimeout } from '../../utils'
import { Writable } from 'stream'
import fs = require('fs-extra')

const delimiter = '------------------------------------------------------------'
const scales = [2 ** 16, 2 ** 17, 2 ** 18, 2 ** 19, 2 ** 20, 2 ** 21, 2 ** 22, 2 ** 23, 2 ** 24, 2 ** 25]

const TRIALS_PER_DESIGNPOINT = (vertices: number): number => {
  const max = Math.log2(scales[scales.length - 1])
  const min = Math.log2(scales[0])
  return Math.round((max - Math.log2(vertices)) / (max - min) * 7) + 3
}

let currScaleIndex = 0
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

  for (let i = 0; i < scales.length; i++) {
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
        meta[currScaleIndex].partition.times.push(Number(timeString[1]) * 1000)
        meta[currScaleIndex].partition.avgTime = meta[currScaleIndex].partition.times.reduce((acc, curr) => curr + acc) / meta[currScaleIndex].partition.times.length
      }

      break
    }

    case 'precalc': {
      meta[currScaleIndex].preparse.times.push(Date.now() - startPrecalc)
      meta[currScaleIndex].preparse.avgTime = meta[currScaleIndex].preparse.times.reduce((acc, curr) => curr + acc) / meta[currScaleIndex].preparse.times.length

      meta[currScaleIndex].preparse.overlaySizesInMB.push(fs.statSync(resolvePath(['data', folder, `${map}.overlay`])).size / 1000000)
      meta[currScaleIndex].preparse.avgOverlaySizeInMB = meta[currScaleIndex].preparse.overlaySizesInMB.reduce((acc, curr) => curr + acc) / meta[currScaleIndex].preparse.overlaySizesInMB.length
      break
    }

    case 'customize': {
      const timeString = /^Took (.*) ms$/gm.exec(data)
      const weightString = /^Amount of weights = (.*)$/gm.exec(data)

      if (timeString && timeString[1]) {
        meta[currScaleIndex].customization.times.push(Number(timeString[1]))
        meta[currScaleIndex].customization.avgTime = meta[currScaleIndex].customization.times.reduce((acc, curr) => curr + acc) / meta[currScaleIndex].customization.times.length
      }

      if (weightString && weightString[1]) {
        meta[currScaleIndex].customization.weights.push(Number(weightString[1]))
        meta[currScaleIndex].customization.avgWrittenWeights = meta[currScaleIndex].customization.weights.reduce((acc, curr) => curr + acc) / meta[currScaleIndex].customization.weights.length
        meta[currScaleIndex].customization.sizesInMB.push(fs.statSync(resolvePath(['data', folder, 'metrics', environment['--metric']])).size / 1000000)
        meta[currScaleIndex].customization.avgSizeInMB = meta[currScaleIndex].customization.sizesInMB.reduce((acc, curr) => curr + acc) / meta[currScaleIndex].customization.sizesInMB.length
      }

      break
    }

    case 'query': {
      const timeString = /Bi Took (.*) ms. Avg = (.*) ms./gm.exec(data)
      const updateString = /Metric update took (.*) ms./gm.exec(data)

      if (timeString) {
        meta[currScaleIndex].query.times.push(Number(timeString[2]))
        meta[currScaleIndex].query.avgTime = meta[currScaleIndex].query.times.reduce((acc, curr) => curr + acc) / meta[currScaleIndex].query.times.length
      }

      if (updateString) {
        meta[currScaleIndex].query.loadTimes.push(Number(updateString[1]))
        meta[currScaleIndex].query.avgLoadTime = meta[currScaleIndex].query.loadTimes.reduce((acc, curr) => curr + acc) / meta[currScaleIndex].query.loadTimes.length
      }
    }
  }
}

async function designPoint (): Promise<void> {
  const trials = TRIALS_PER_DESIGNPOINT(scales[currScaleIndex])
  console.log(delimiter)
  console.log(`Parsing results (${scales[currScaleIndex].toLocaleString('da-dk')})`)
  console.log(delimiter)

  const subGraph = await createSubGraph(scales[currScaleIndex], { withOutputStream: true })
  folder = subGraph.folder
  map = subGraph.map
  await asyncTimeout(2000)

  setCtx({ onEnd, onStreamedToken: undefined })
  currentPhase = 'partition'
  console.log(`Partitioning - ${environment['--partitioner']}(${environment['--pconfig']})`)
  await partition(folder, map, {
    withOutputStream: true,
    configuration: environment['--pconfig'],
    partitioner: environment['--partitioner']
  })

  currentPhase = 'precalc'
  console.log('Preparse')
  startPrecalc = Date.now()
  await preparse(folder, map, { withOutputStream: true })

  for (let i = 0; i < trials; i++) {
    setCtx({ onEnd, onStreamedToken: undefined })
    currentPhase = 'customize'
    console.log(`Customize(${i + 1}/${trials})`)
    await customize(folder, map, environment['--metric'], { withOutputStream: true })

    currentPhase = 'query'
    setCtx({ onEnd, onStreamedToken })
    console.log(`Query(${i + 1}/${trials})`)
    onQueryResult('[TO_CLIENT_BEGIN]\n')
    await cClient(folder, map, setStream)
    onQueryResult('[END_CLIENT]\n')
    await asyncTimeout()
  }

  console.log(delimiter)
  console.log(`Results (${scales[currScaleIndex].toLocaleString('da-dk')})`)
  console.log(delimiter)

  console.log('Partitioning')
  console.log()
  console.log(`Avg: ${meta[currScaleIndex].partition.avgTime.toFixed(2)}ms`)
  console.log(meta[currScaleIndex].partition.times.map((it) => `${it.toFixed(2)}ms`))
  console.log(delimiter)

  console.log('Preprocessing')
  console.log()
  console.log(`Avg. time: ${meta[currScaleIndex].preparse.avgTime.toFixed(2)}ms`)
  console.log(meta[currScaleIndex].preparse.times.map((it) => `${it.toFixed(2)}ms`))
  console.log()
  console.log(`Avg. overlay size: ${meta[currScaleIndex].preparse.avgOverlaySizeInMB} MB`)
  console.log(meta[currScaleIndex].preparse.overlaySizesInMB.map((it) => `${it} MB`))
  console.log(delimiter)

  console.log('Customization')
  console.log()
  console.log(`AvgTime: ${meta[currScaleIndex].customization.avgTime.toFixed(2)}ms`)
  console.log(meta[currScaleIndex].customization.times.map((it) => `${it.toFixed(2)}ms`))
  console.log()
  console.log(`AvgWeights: ${meta[currScaleIndex].customization.avgWrittenWeights} weights`)
  console.log(meta[currScaleIndex].customization.weights.map((it) => `${it} weights`))
  console.log()
  console.log(`Avg weights size ${environment['--metric']}: ${meta[currScaleIndex].customization.avgSizeInMB} MB`)
  console.log(meta[currScaleIndex].customization.sizesInMB.map((it) => `${it} MB`))
  console.log(delimiter)

  console.log('Query')
  console.log()
  console.log(`Avg: ${meta[currScaleIndex].query.avgTime.toFixed(2)}ms`)
  console.log(meta[currScaleIndex].query.times.map((it) => `${it.toFixed(2)}ms`))
  console.log(`Trials pr iteration: ${environment['--testAmount']}`)
  console.log()
  console.log(`Metric load time: ${meta[currScaleIndex].query.avgLoadTime.toFixed(2)}ms`)
  console.log(meta[currScaleIndex].query.loadTimes.map((it) => `${it.toFixed(2)}ms`))
  console.log(delimiter)
}

function setStream (newStream: Writable | null): void {
  if (newStream) {
    stream = newStream
  }
}

export async function scalingTest (_folder: string, _map: string): Promise<void> {
  folder = _folder
  map = _map

  for (let i = 0; i < scales.length; i++) {
    currScaleIndex = i
    await designPoint()
  }

  process.exit(0)
}
