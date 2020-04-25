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

void getDiffArcsOnLevel(const CRP::OverlayGraph &overlayGraph, int level, std::string outputPath) {
  std::vector<CRP::index> arcs;
  std::cout << overlayGraph.numberOfVertices();

  overlayGraph.forCells(level, [&](const CRP::Cell &cell, const CRP::pv truncatedCellNumber) {
    for (int i = cell.numEntryPoints; i > 0; i--)
    {
      CRP::index vId = overlayGraph.getEntryPoint(cell, i);
      arcs.push_back(overlayGraph.getVertex(vId).originalEdge);
    }
  });

  std::ofstream outFile(outputPath);
  outFile << arcs.size() << std::endl;

  // the important part
  for (const auto &e : arcs)
    outFile << e << " " << 42 << "\n";
}