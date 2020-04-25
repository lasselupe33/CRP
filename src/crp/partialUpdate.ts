// import { resolvePath, prependFile, environment, asyncTimeout } from '../utils'
// import { onQueryResult } from '../client/onQueryResult'
// import { receivePartialUpdateRandom, receivePartialUpdateDiffCell, receivePartialUpdateSameCell } from '../../experiments/increment'
// import * as rd from 'readline'
// import { Writable } from 'stream'

// import execa = require('execa')
// import fs = require('fs-extra')

// let stream: Writable
// let _time: number
// let _pct: number
// let _arcs: number
// const PUID: number = getRandomInt(0, 99999) // partialUpdateID

// /**
//  * Will continously receive tokens from the C++ input as soon as they're available
//  */
// function onStreamedToken (token: string): void {
//   switch (token) {
//     case `DONE_${PUID}_RAND`:
//       receivePartialUpdateRandom(_pct, _time, _arcs)
//       break
//     case `DONE_${PUID}_DIFF`:
//       receivePartialUpdateDiffCell(_time, _arcs)
//       break
//     case `DONE_${PUID}_SAME`:
//       receivePartialUpdateSameCell(_time, _arcs)
//       break
//   }
// }

// function setStream (newStream: Writable | null): void {
//   if (newStream) {
//     stream = newStream
//   }
// }

// export function partialUpdate (testtype: string, time: number, pct: number, arcs: number, folder: string, map: string, updatePath: string, metricType: string) {
//   _time = time
//   _pct = pct
//   _arcs = arcs
//   const command = execa.commandSync(`sh run.sh PartialUpdate ${resolvePath(['data', folder])} ${map} ${updatePath} ${metricType} ${PUID}_${testtype}`)
// }

// function getRandomInt (min: number, max: number) {
//   min = Math.ceil(min)
//   max = Math.floor(max)
//   return Math.floor(Math.random() * (max - min)) + min // The maximum is exclusive and the minimum is inclusive
// }
