import { resolvePath, prependFile, environment, asyncTimeout } from '../utils'
import { onQueryResult } from '../client/onQueryResult'

import execa = require('execa')
import fs = require('fs-extra')
import * as rd from 'readline'
import { Writable } from 'stream'

let stream: Writable
let temppath: string

/**
 * Will continously receive tokens from the C++ input as soon as they're available
 */
function onStreamedToken (token: string): void {
  switch (token) {
    case `WROTE_${temppath}`:
          
      break
  }
}
  
function setStream (newStream: Writable | null): void {
  if (newStream) {
     stream = newStream
  }
}


export function getDiffArcsOnLevel(folder: string, map:string, l:number, numArcs: number): number[]{
    let arcs: number[] = []

    temppath = "diffCellFile" //TIL LASSE: der skal være en path til lige at skrive/læse fra

    const command = execa.commandSync(`sh run.sh getDiffArcsOnLevel ${resolvePath(['data', folder])} ${map} ${l} ${numArcs} ${temppath}`)


    // HANDLE AT C KODEN SVARER MED ET FILNAVN 

    
    let reader = rd.createInterface(fs.createReadStream(temppath))
    reader.on("line", (l: string) => {
        arcs.push(parseInt(l))
    })
    return arcs
}