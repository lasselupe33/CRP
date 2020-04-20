#include <algorithm>
#include <iostream>
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

#include "../constants.h"
#include "../datastructures/Graph.h"
#include "../datastructures/OverlayGraph.h"
#include "../datastructures/OverlayWeights.h"
#include "../io/GraphIO.h"
#include "../metrics/DistanceFunction.h"
#include "../metrics/HopFunction.h"
#include "../metrics/Metric.h"
#include "../metrics/TimeFunction.h"

#include "UpdateIO.h"

std::vector<CRP::index> arcs; 
int numArcs;
CRP::OverlayGraph overlay;

using namespace std;

int main(int argc, char* argv[]){
    if(argc != 4){
        std::cout << "Usage: " << argv[0] << " path_to_overlay_graph level num_arcs outputPath" << std::endl;
        return 1;
    }

    string overlayPath(argv[1]);
    string levelString(argv[2]);
    int level = stoi(levelString); 
    string numArcsString(argv[3]);
    numArcs = stoi(numArcsString);
    string outputPath(argv[4]);
    
    CRP::GraphIO::readOverlayGraph(overlay, overlayPath);

    overlay.forCells(level, f);
   
    std::ofstream outFile(outputPath);
    // the important part
    for (const auto &e : arcs) outFile << e << "\n";

    std::cout << "WROTE_" + outputPath << std::endl;

    return 0;
}

void f(CRP::pv pv, CRP::Cell c){
    for(int i = numArcs; i > 0; i--){
        arcs.push_back(overlay.getVertex(c.cellOffset + i).originalEdge);
    }
}