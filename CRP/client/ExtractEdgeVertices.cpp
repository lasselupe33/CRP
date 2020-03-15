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


double EuclidianDistanceBetween(CRP::Coordinate a, CRP::Coordinate b) {
  return abs(sqrt(pow(a.lat - b.lat, 2) + pow(a.lon - b.lon, 2)));
}

void ExtractEdgeVertices(const CRP::Graph &graph, int amount = 1000)
{
  std::cout << "Extracting edge vertices..." << std::endl;

  std::vector<std::pair<std::string, std::vector<std::pair<CRP::Vertex, CRP::index>>>> edgeVerticesArrays(4);
  std::vector<std::pair<CRP::Vertex, CRP::index>> topLeft;
  edgeVerticesArrays[0] = make_pair("Top-left", topLeft);

  std::vector<std::pair<CRP::Vertex, CRP::index>> topRight;
  edgeVerticesArrays[1] = make_pair("Top-right", topRight);

  std::vector<std::pair<CRP::Vertex, CRP::index>> bottomLeft;
  edgeVerticesArrays[2] = make_pair("Bottom-left", bottomLeft);

  std::vector<std::pair<CRP::Vertex, CRP::index>> bottomRight;
  edgeVerticesArrays[3] = make_pair("Bottom-right", bottomRight);

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

  graph.forVertices([&](CRP::index vertexIndex, const CRP::Vertex &vertex) {
    if (vertex.coord.lat == 0 && vertex.coord.lon == 0) {
      return;
    }

    // In case arrays haven't been fully populated yet, do so now..
    for (int i = 0; i < 4; i++)
    {
      std::vector<std::pair<CRP::Vertex, CRP::index>> edgeVertices = edgeVerticesArrays[i].second;
      CRP::Coordinate edgeCoordinate = edgeCoords[i];

      if (edgeVertices.size() < amount)
      {
        edgeVerticesArrays[i].second.push_back(std::make_pair(vertex, vertexIndex));
        continue;
      }

      // Go through all current candidates and determine if our vertex is closer
      // to the current edge. In case such a candidate is found, replace it with
      // our current vertex.
      for (int j = 0; j < edgeVertices.size(); j++)
      {
        CRP::Vertex contestant = edgeVertices[j].first;

        if (EuclidianDistanceBetween(edgeCoordinate, vertex.coord) <= EuclidianDistanceBetween(edgeCoordinate, contestant.coord))
        {
          edgeVerticesArrays[i].second[j] = std::make_pair(vertex, vertexIndex);
          break;
        }
      }
    }
  });

  for (std::pair<std::string, std::vector<std::pair<CRP::Vertex, CRP::index>>> &edge : edgeVerticesArrays) {
    std::string label = edge.first;
    std::vector<std::pair<CRP::Vertex, CRP::index>> edgeVertices = edge.second;

    std::cout << "[TO_CLIENT_BEGIN]" << std::endl;
    std::cout << "start__" << label << std::endl;

    for (int i = 0; i < edgeVertices.size(); i++) {
      std::cout << edgeVertices[i].second << std::endl;
    }

    std::cout << "[TO_CLIENT_END]" << std::endl;
  }

  std::cout << "[END_CLIENT]" << std::endl;
}