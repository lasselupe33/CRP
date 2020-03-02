#include <unordered_map>
#include <iostream>
#include <memory>
#include <string>

#include "../datastructures/Graph.h"
#include "../datastructures/OverlayGraph.h"
#include "../datastructures/OverlayWeights.h"
#include "../io/GraphIO.h"
#include "../metrics/DistanceFunction.h"
#include "../metrics/HopFunction.h"
#include "../metrics/Metric.h"
#include "../metrics/TimeFunction.h"

#include "UpdateIO.h"

using namespace std;

int main(int argc, char* argv[]){
    if(argc != 5){
        std::cout << "Usage: " << argv[0] << " path_to_graph path_to_overlay_graph path_to_update_file output_path" << std::endl;
        return 1;
    }

    string graphFile(argv[1]);
    string overlayGraphFile(argv[2]);
    string updateFile(argv[3]);

    CRP::Graph graph;
    CRP::OverlayGraph overlayGraph;
    CRP::Update update;

    cout << "reading graph" << endl;
    CRP::GraphIO::readGraph(graph,graphFile);
    cout << "reading overlay graph" << endl;
    CRP::GraphIO::readOverlayGraph(overlayGraph,overlayGraphFile);
    cout << "reading update file" << endl;
    CRP::UpdateIO::readUpdateFile(update, updateFile);
    
    //TODO: this
}

