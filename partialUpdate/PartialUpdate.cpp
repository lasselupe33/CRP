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

using namespace std;

int main(int argc, char* argv[]){
    if(argc != 5){
        std::cout << "Usage: " << argv[0] << " path_to_graph path_to_overlay_weights path_to_update_file output_path" << std::endl;
        return 1;
    }

    string graphFile(argv[1]);
    string overlayWeights(argv[2]);
    string updateFile(argv[3]);

    CRP::Graph graph;
    CRP::OverlayWeights weights;
    CRP::Update update;

    cout << "reading graph" << endl;
    CRP::GraphIO::readGraph(graph,graphFile);
    cout << "reading overlay weights" << endl;
    CRP::GraphIO::readWeights(weights,overlayWeights);
    cout << "reading update file" << endl;
    CRP::UpdateIO::readUpdateFile(update, updateFile);
    
    std::vector<std::pair<CRP::index ,CRP::weight>> updateList = update.updates;
    std::vector<CRP::index> weightList = weights.getWeights;
    
    for (std::vector<std::pair<CRP::index, CRP::weight>>::iterator it = updateList.begin() ; it != updateList.end(); ++it){
        std::replace(weightList.begin(), weightList.end(), (*it).first, (*it).second);
    }

    CRP::GraphIO::writeWeights(weightList, overlayWeights + "_patch");
}

