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
    if(argc != 7){
        std::cout << "Usage: " << argv[0] << " path_to_graph path_to_overlay_weights path_to_update_file metric_output_path metric_type" << std::endl;
        return 1;
    }

    string graphFile(argv[1]);
    string overlayGraphFile(argv[2]);
    string overlayWeightsFile(argv[3]);
    string updateFile(argv[4]);
    string metricPath(argv[5]);
    string metricType(argv[6]);

    CRP::Graph graph;
    CRP::OverlayGraph overlayGraph;
    CRP::OverlayWeights overlayWeights;
    std::vector<std::pair<CRP::index ,CRP::weight>> updates;

    unordered_map<string, unique_ptr<CRP::CostFunction>> costFunctions;
	costFunctions["hop"] = unique_ptr<CRP::CostFunction>(new CRP::HopFunction());
	costFunctions["dist"] = unique_ptr<CRP::CostFunction>(new CRP::DistanceFunction());
	costFunctions["time"] = unique_ptr<CRP::CostFunction>(new CRP::TimeFunction());

    cout << "reading graph" << endl;
    CRP::GraphIO::readGraph(graph,graphFile);
    cout << "reading overlay graph" << endl;
    CRP::GraphIO::readOverlayGraph(overlayGraph,overlayGraphFile);
    cout << "reading overlay weights" << endl;
    CRP::GraphIO::readWeights(overlayWeights, overlayWeightsFile);
    cout << "reading update file" << endl;
    CRP::UpdateIO::readUpdateFile(updates, updateFile);
    
    if (metricType == "all") {
		for (auto &pair : costFunctions) {
			CRP::UpdateIO::updateWeights(updates, graph, overlayGraph, overlayWeights, *std::move(pair.second));
		}
	} else {
		auto it = costFunctions.find(metricType);
		if (it == costFunctions.end()) {
			cout << "unknown metric" << std::endl;
			return 0;
		}

		CRP::UpdateIO::updateWeights(updates, graph, overlayGraph, overlayWeights, *std::move(it->second));
	}

    return 0;
}

