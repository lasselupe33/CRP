// import { resolvePath, prependFile, environment, asyncTimeout } from '../utils'
// import { onQueryResult } from '../client/onQueryResult'
// import * as rd from 'readline'
// import { Writable } from 'stream'

// import execa = require('execa')
// import fs = require('fs-extra')

// let temppath: string
// let stream: Writable

// /**
//  * Will continously receive tokens from the C++ input as soon as they're available
//  */
// function onStreamedToken (token: string): void {
//   switch (token) {
//     case `WROTE_${temppath}`:

//       break
//   }
// }

// function setStream (newStream: Writable | null): void {
//   if (newStream) {
//     stream = newStream
//   }
// }

// export function getAllArcsInCell (folder: string, map: string, cell: number): number[] {
//   const arcs: number[] = []

//   temppath = 'sameCellFile' // TIL LASSE: der skal være en path til lige at skrive/læse fra

//   const command = execa.commandSync(`sh run.sh getAllArcsInCell ${resolvePath(['data', folder])} ${map} ${cell} ${temppath}`)

//   // HANDLE AT C KODEN SVARER MED ET FILNAVN

//   const reader = rd.createInterface(fs.createReadStream(temppath))
//   reader.on('line', (l: string) => {
//     arcs.push(parseInt(l))
//   })
//   return arcs
// }
