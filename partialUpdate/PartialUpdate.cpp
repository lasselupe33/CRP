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
    if(argc != 8){
        std::cout << "Usage: " << argv[0] << " path_to_graph path_to_overlay_weights path_to_update_file output_path metric_output_path metric_type" << std::endl;
        return 1;
    }

    string graphFile(argv[1]);
    string overlayGraphFile(argv[2]);
    string overlayWeightsFile(argv[3]);
    string updateFile(argv[4]);
    string outputPath(argv[5]);
    string metricPath(argv[6]);
    string metricType(argv[7]);

    CRP::Graph graph;
    CRP::OverlayGraph overlayGraph;
    CRP::OverlayWeights overlayWeights;
    CRP::Update update;

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
    CRP::UpdateIO::readUpdateFile(update, updateFile);
    std::vector<std::pair<CRP::index ,CRP::weight>> updateList = update.updates;
    
    if (metricType == "all") {
		for (auto &pair : costFunctions) {
			CRP::UpdateIO::writeUpdatedWeights(updateList, graph, overlayGraph, overlayWeights, outputPath, *std::move(pair.second));
		}
	} else {
		auto it = costFunctions.find(metricType);
		if (it == costFunctions.end()) {
			cout << "unknown metric" << std::endl;
			return 0;
		}

		CRP::UpdateIO::writeUpdatedWeights(updateList, graph, overlayGraph, overlayWeights, outputPath, *std::move(it->second));
	}

    return 0;
}

