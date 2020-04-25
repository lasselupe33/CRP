#include "../algorithm/CRPQuery.h"
#include "../algorithm/CRPQueryUni.h"
#include "../algorithm/ParallelCRPQuery.h"
#include "../algorithm/Dijkstra.h"

#include "../datastructures/Graph.h"
#include "../datastructures/OverlayGraph.h"
#include "../datastructures/QueryResult.h"
#include "../metrics/Metric.h"
#include "../partialUpdate/UpdateIO.h"

#include "../metrics/DistanceFunction.h"
#include "../metrics/HopFunction.h"
#include "../metrics/Metric.h"
#include "../metrics/TimeFunction.h"

#include "../timer.h"
#include "../constants.h"

#include <iostream>
#include <memory>
#include <iomanip>
#include <fstream>
#include <random>
#include <functional>

using namespace std;

void UpdateWeights(CRP::Graph &graph, const CRP::OverlayGraph &overlayGraph, CRP::Metric &metric, std::string metricType, std::string updateFilePath, int updateCount)
{
  std::vector<std::pair<CRP::index, CRP::weight>> updates;
  std::vector<CRP::weight> weights;
  CRP::readUpdateFile(updates, updateFilePath);

  unordered_map<string, unique_ptr<CRP::CostFunction>> costFunctions;
  costFunctions["hop"] = unique_ptr<CRP::CostFunction>(new CRP::HopFunction());
  costFunctions["dist"] = unique_ptr<CRP::CostFunction>(new CRP::DistanceFunction());
  costFunctions["time"] = unique_ptr<CRP::CostFunction>(new CRP::TimeFunction());

  double sum = 0;

  for (int i = 0; i < updateCount; i++) {
    long long start = get_micro_time();
    weights =  metric.getWeights();

    if (metricType == "all")
    {
      for (auto &pair : costFunctions)
      {
        CRP::updateWeights(updates, graph, overlayGraph, weights, *std::move(pair.second));
      }
    }
    else
    {
      auto it = costFunctions.find(metricType);
      if (it == costFunctions.end())
      {
        cout << "unknown metric" << std::endl;
        exit(1);
        return;
      }

      CRP::updateWeights(updates, graph, overlayGraph, weights, *std::move(it->second));
    }
    long long end = get_micro_time();
    sum += end - start;
  }

  metric.setWeights(metric, weights);

  sum /= 1000;
  std::cout << "Updated weights in " << sum / updateCount << "ms." << std::endl;
}