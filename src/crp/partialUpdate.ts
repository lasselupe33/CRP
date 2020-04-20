import { resolvePath, prependFile, environment, asyncTimeout } from '../utils'
import { onQueryResult } from '../client/onQueryResult'

import execa = require('execa')
import fs = require('fs-extra')

export function partialUpdate(graphPath: string, overlayPath: string, weightPath: string, updatePath: string, metricType:string, {/*"static" variables here*/}){
    const partialUpdatePath = resolvePath(['partialUpdate', 'PartialUpdate'])
    const command = execa.commandSync(`${partialUpdatePath} ${graphPath} ${overlayPath} ${weightPath} ${updatePath} ${metricType}`)
}