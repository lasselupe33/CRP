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

void f(CRP::OverlayVertex ov)
{
    if (ov.cellNumber == cellNumber)
    {
        arcs.push_back(ov.originalEdge);
    }
}

void getAllArcsInCell(const CRP::OverlayGraph &overlayGraph, int cellNumber, std::string outputPath)
{
  arcs.clear();
  overlayGraph.forVertices(f);

  std::ofstream outFile(outputPath);
  outFile << arcs.size() << std::endl;

  // the important part
  for (const auto &e : arcs)
    outFile << e << " " << 42 << "\n";
}