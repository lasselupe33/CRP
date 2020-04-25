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
int cellNumber;

using namespace std;

int main(int argc, char* argv[]){
    if(argc != 4){
        std::cout << "Usage: " << argv[0] << " path_to_overlay_graph cell_number outputPath" << std::endl;
        return 1;
    }

    string overlayPath(argv[1]);
    string cellString(argv[2]);
    cellNumber = stoi(cellString);
    string outputPath(argv[3]);
    
    CRP::OverlayGraph overlay;
    CRP::GraphIO::readOverlayGraph(overlay, overlayPath);

    overlay.forVertices(f);

    std::ofstream outFile(outputPath);
    // the important part
    for (const auto &e : arcs) outFile << e << "\n";

    std::cout << "WROTE_" + outputPath << std::endl;

    return 0;
}

void f(CRP::OverlayVertex ov){
    if(ov.cellNumber == cellNumber){arcs.push_back(ov.originalEdge);}
}