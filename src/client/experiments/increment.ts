import { partialUpdate } from "../../crp/partialUpdate"
import { customize } from "../../crp/customize"
import {getAllArcsInCellOnLevel, getDiffArcsOnLevel} from "../../crp/getOverlayInfo"

let allArcs: number  /// TIL LASSE: FIND UD AF MAX NUMMER AF ARCS I EN GENERATED FIL
let fullTime: number   // time to update all arcs
 

function allTest(): void{
    // run all tests
    changeMetric() //this is just to give os base case info
    testPartialUpdateRandom()
    testPartialUpdateDiffCells()
    testPartialUpdateSameCell()
}

function changeMetric(): void{
    let before: number
    let after: number
    // Establish initial time and amount of arcs updated 
    before = Date.now()

    // TIL LASSE: FILL IN METHOD 
    customize(/* folder, map, metricType */)
 
    after = Date.now()
    fullTime = after - before
}

function testPartialUpdateRandom(): void{
    let before: number
    let after: number
    let eTime: number 
    let resultslist: any[] = []// used as list<pair<int,int>> 
    resultslist.pop()
    let updatelist: [[number, number]]  // used as list<pair<id,weight>>

    resultslist.concat([100,fullTime])
    
    // GET THE TOTAL NUMBER OF ARCS 
    for(let i: number = 80; i > 1; i -= 20){
        // Generate random (id, weight) list with length of 'i' pct of original arcs
        updatelist = [[1,1]]
        updatelist.pop()
        let eArcs: number = (allArcs * i/100)
        for(let j: number = eArcs; j > 0; j--){
            updatelist.concat([getRandomInt(0, (allArcs+1)), 42])
        }
        
        // TIL KASSE: FILL IN PATH
        writeUpdateFile(updatelist, /*updatePath */)
        // start timer
        before = Date.now()

        // TIL LASSE: FILL IN METHOD
        partialUpdate(/*graphPath, overlayPath, weightsPath, updatePath, metricType */)

        // end timer
        after = Date.now()
        eTime = after - before

        // put time and percentage in resultslist
        resultslist.concat([i,eTime,eArcs])
    }

    // print resultslist
    console.log("testPartialUpdateRandom results:");
    console.log(resultslist);
}

function testPartialUpdateDiffCells(): void{
    let before: number
    let after: number
    let eTime: number 
    let updatelist: [[number, number]] = [[1,1]]
    updatelist.pop()

    // GET BOUNDARY VERTICES.FORWARDEDGE FOR ALL CELLS IN LEVEL AND ELIMINATE DUPLICATES
    // TIL LASSE: FILL IN METHOD
    let templist = getDiffArcsOnLevel(/* */)
    templist.forEach(element => {
        updatelist.concat([element,42])
    });

    // MAKE UPDATE FILE TIL LASSE: FILL IN PATH
    writeUpdateFile(updatelist, /*updatePath */)
    before = Date.now()
    
    // TIL LASSE: FILL IN METHOD
    partialUpdate(/*graphPath, overlayPath, weightsPath, updatePath, metricType */)
    
    after = Date.now()
    eTime = after - before

    console.log(`Different cells: time in ms ${eTime} number of arcs updated ${updatelist.length}`)

}

function testPartialUpdateSameCell(): void{
    let before: number
    let after: number
    let eTime: number
    let updatelist: [[number, number]] = [[1,1]]
    updatelist.pop()
    
    // GET ALL ARCS FROM SOME CELL
    // TIL LASSE: FILL IN METHOD
    let templist = getAllArcsInCellOnLevel(/* */)
    templist.forEach(element => {
        updatelist.concat([element,42])
    });

    // MAKE UPDATE FILE TIL LASSE: FILL IN PATH
    writeUpdateFile(updatelist, /*updatePath */)
    
    before = Date.now()
    
    // TIL LASSE: FILL IN METHOD
    partialUpdate(/*graphPath, overlayPath, weightsPath, updatePath, metricType */)

    after = Date.now()
    eTime = after - before

    console.log(`Same cell: time in ms ${eTime} number of arcs updated ${updatelist.length}`)
}

function getRandomInt(min: number, max: number) {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min)) + min //The maximum is exclusive and the minimum is inclusive
}

function writeUpdateFile(this: any, updates: [[number, number]], path: string): void{
    let text: string = ""
    updates.forEach(elem => {
        let id: any = elem[0]
        let weight: any = elem[1]
        
        text.concat(`${id} ${weight}\n`)
    });
    const fs = require('fs')
    //open stream
    this.fs.writeFile(path, text,  function(err:any) :void{
        if (err) {
            return console.error(err);
        }
    });
    //close stream
}