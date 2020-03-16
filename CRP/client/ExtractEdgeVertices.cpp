#include "../algorithm/CRPQuery.h"
#include "../algorithm/CRPQueryUni.h"
#include "../algorithm/ParallelCRPQuery.h"

#include "../datastructures/Graph.h"
#include "../datastructures/OverlayGraph.h"
#include "../datastructures/QueryResult.h"
#include "../metrics/Metric.h"

#include "../timer.h"
#include "../constants.h"

#include <iostream>
#include <memory>
#include <iomanip>
#include <fstream>
#include <random>
#include <functional>
#include <queue>
#include <vector>

double EuclidianDistanceBetween(CRP::Coordinate a, CRP::Coordinate b) {
  return abs(sqrt(pow(a.lat - b.lat, 2) + pow(a.lon - b.lon, 2)));
}

void ExtractEdgeVerticesForEdge(const CRP::Graph &graph, CRP::Coordinate edgeCoord, std::string label, int amount)
{
  auto cmp = [](std::pair<double, CRP::index> left, std::pair<double, CRP::index> right) { return left.first < right.first; };
  std::priority_queue<std::pair<double, CRP::index>, std::vector<std::pair<double, CRP::index>>, decltype(cmp)> pq(cmp);

  graph.forVertices([&](CRP::index vertexIndex, const CRP::Vertex &vertex) {
    double dist = EuclidianDistanceBetween(edgeCoord, vertex.coord);

    if (pq.size() < amount)
    {
      pq.push(std::make_pair(dist, vertexIndex));
    }
    else
    {
      double contestantDist = pq.top().first;

      if (dist < contestantDist)
      {
        pq.pop();
        pq.push(std::make_pair(dist, vertexIndex));
      }
    }
  });

  std::cout << "[TO_CLIENT_BEGIN]" << std::endl;
  std::cout << "start__" << label << std::endl;

  for (int i = 0; i < amount; i++)
  {
    std::cout << pq.top().second << std::endl;
    pq.pop();
  }

  std::cout << "[TO_CLIENT_END]" << std::endl;
  std::cout << "Extracted edges for " << label << " corner." << std::endl;
}

void ExtractEdgeVertices(const CRP::Graph &graph, int amount)
{
  std::cout << "Extracting edge vertices..." << std::endl;

  std::vector<CRP::Coordinate> edgeCoords;
  CRP::Coordinate topLeftCoord;
  topLeftCoord.lat = -300.0;
  topLeftCoord.lon = -300.0;
  edgeCoords.push_back(topLeftCoord);

  CRP::Coordinate topRightCoord;
  topRightCoord.lat = -300.0;
  topRightCoord.lon = 300.0;
  edgeCoords.push_back(topRightCoord);

  CRP::Coordinate bottomLeftCoord;
  bottomLeftCoord.lat = 300.0;
  bottomLeftCoord.lon = -300.0;
  edgeCoords.push_back(bottomLeftCoord);

  CRP::Coordinate bottomRightCoord;
  bottomRightCoord.lat = 300.0;
  bottomRightCoord.lon = 300.0;
  edgeCoords.push_back(bottomRightCoord);

  ExtractEdgeVerticesForEdge(graph, topLeftCoord, "Top-left", amount);
  ExtractEdgeVerticesForEdge(graph, topRightCoord, "Top-right", amount);
  ExtractEdgeVerticesForEdge(graph, bottomLeftCoord, "Bottom-left", amount);
  ExtractEdgeVerticesForEdge(graph, bottomRightCoord, "Bottom-right", amount);

  std::cout << "[END_CLIENT]" << std::endl;
}