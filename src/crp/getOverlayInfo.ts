import { resolvePath, prependFile, environment, asyncTimeout } from '../utils'
import { onQueryResult } from '../client/onQueryResult'

import execa = require('execa')
import fs = require('fs-extra')
import * as rd from 'readline'
import { Writable } from 'stream'

let stream: Writable

/**
 * Will continously receive tokens from the C++ input as soon as they're available
 */
function onStreamedToken (token: string): void {
  switch (token) {
    case 'WROTE_':
          
      break
    case 'WROTE_':

      break
  }
}
  
function setStream (newStream: Writable | null): void {
  if (newStream) {
     stream = newStream
  }
}


export function getDiffArcsOnLevel(overlayPath:string, l:number, numArcs: number): number[]{
    let arcs: number[] = []

    let temppath: string = "diffCellFile" //TIL LASSE: der skal være en path til lige at skrive/læse fra

    const partialUpdatePath = resolvePath(['partialUpdate', 'getDiffArcsOnLevel'])
    const command = execa.commandSync(`${partialUpdatePath} ${overlayPath} ${l} ${numArcs} ${temppath}`)


    // HANDLE AT C KODEN SVARER MED ET FILNAVN 

    
    let reader = rd.createInterface(fs.createReadStream(temppath))
    reader.on("line", (l: string) => {
        arcs.push(parseInt(l))
    })
    return arcs
}

export function getAllArcsInCellOnLevel(overlayPath:string, cell:number): number[]{
    let arcs: number[] = []

    let temppath: string = "sameCellFile" //TIL LASSE: der skal være en path til lige at skrive/læse fra

    const partialUpdatePath = resolvePath(['partialUpdate', 'getAllArcsInCellOnLevel'])
    const command = execa.commandSync(`${partialUpdatePath} ${overlayPath} ${cell} ${temppath}`)


    // HANDLE AT C KODEN SVARER MED ET FILNAVN


    let reader = rd.createInterface(fs.createReadStream(temppath))
    reader.on("line", (l: string) => {
        arcs.push(parseInt(l))
    })
    return arcs
}