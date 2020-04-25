import { partialUpdate } from "../../crp/partialUpdate"
import { customize } from "../../crp/customize"
import { getAllArcsInCell } from "../../crp/getAllArcsInCell"
import { getDiffArcsOnLevel } from "../../crp/getDiffArcsOnLevel"

let allArcs: number  /// TIL LASSE: FIND UD AF MAX NUMMER AF ARCS I EN GENERATED FIL
let fullTime: number   // time to update all arcs

let amountOfTimesWeTest: number = 1
let ranList: [[number,number,number]] //pct, time, amount of arcs updated
let diffList: [[number,number]] //time, amount of arcs updated
let sameList: [[number,number]] //time, amount of arcs updated
let flag: number = 0
 

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
        writeUpdateFile(updatelist, /*updatePath */ ""+i)
        // start timer
        before = Date.now()

        // TIL LASSE: FILL IN METHOD
        partialUpdate("RAND",before, i, ,updatelist.length, /*folder, map, updatePath, metricType */)
    }
}

// TO BE CALLED WHEN WE GET RESPONSE FROM C++
export function receivePartialUpdateRandom(pct: number, time: number, arcs: number){
    let eTime: number = Date.now() - time

    // put time and percentage in resultslist
    ranList.concat([pct,eTime,arcs])

    if(ranList.length >= (5 * amountOfTimesWeTest)){
        flag += 100
    } else if (pct == 20) {
        testPartialUpdateRandom()
    }

    if(flag == 111){
        printResults()
    }
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
    partialUpdate("DIFF", before, 0, updatelist.length, /*graphPath, overlayPath, weightsPath, updatePath, metricType */)
}

// TO BE CALLED WHEN WE GET RESPONSE FROM C++
export function receivePartialUpdateDiffCell(time: number, arcs: number){
    let eTime:number  = Date.now() - time

    diffList.concat([time,arcs])

    if(diffList.length >= amountOfTimesWeTest){
        flag += 10
    } else {
        testPartialUpdateDiffCells()
    }

    if (flag == 111) {
        printResults()
    }
}


function testPartialUpdateSameCell(): void{
    let before: number
    let after: number
    let eTime: number
    let updatelist: [[number, number]] = [[1,1]]
    updatelist.pop()
    
    // GET ALL ARCS FROM SOME CELL
    // TIL LASSE: FILL IN METHOD
    let templist = getAllArcsInCell(/* */)
    templist.forEach(element => {
        updatelist.concat([element,42])
    });

    // MAKE UPDATE FILE TIL LASSE: FILL IN PATH
    writeUpdateFile(updatelist, /*updatePath */)
    
    before = Date.now()
    
    // TIL LASSE: FILL IN METHOD
    partialUpdate("SAME",before,0,updatelist.length,/*graphPath, overlayPath, weightsPath, updatePath, metricType */)
}

// TO BE CALLED WHEN WE GET RESPONSE FROM C++
export function receivePartialUpdateSameCell(time: number, arcs: number){
    let eTime: number = Date.now() - time

    sameList.concat([time,arcs])

    if(sameList.length >= amountOfTimesWeTest){
        flag += 1
    } else {
        testPartialUpdateSameCell()
    }

    if(flag == 111) {
        printResults()
    }
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

// Prints all results once all lists are full
function printResults() {
    console.log(`All tests run ${amountOfTimesWeTest} times`)
    console.log("RandomUpdateTests: ")
    ranList.forEach(elem => {
        console.log(`pct: ${elem[0]} time(ms): ${elem[1]} arcs: ${elem[2]}`)        
    });

    console.log("DiffCellTests: ")
    diffList.forEach(elem => {
        console.log(`time(ms): ${elem[0]} arcs: ${elem[1]}`)        
    });

    console.log("SameCellTests: ")
    sameList.forEach(elem => {
        console.log(`time(ms): ${elem[0]} arcs: ${elem[1]}`)        
    });
}