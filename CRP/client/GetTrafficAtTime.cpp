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

using namespace std;

struct PathData {
  int timeOffset;
  CRP::QueryResult res;
};

struct EdgeWithMeta {
  CRP::index edgeIndex;
  CRP::ForwardEdge edge;
};

vector<PathData> carPaths;
int carsToUpdate = 0;
int edgeCapacity = 10;
float cutoff = 1.02;

int getSpeed(CRP::EdgeAttributes attributes) {
  CRP::Speed speed = attributes.getSpeed();
  if (speed == 0)
  {
    switch (attributes.getStreetType())
    {
    case CRP::MOTORWAY:
      speed = 100;
      break;
    case CRP::TRUNK:
      speed = 85;
      break;
    case CRP::PRIMARY:
      speed = 70;
      break;
    case CRP::SECONDARY:
      speed = 60;
      break;
    case CRP::TERTIARY:
      speed = 50;
      break;
    case CRP::UNCLASSIFIED:
      speed = 40;
      break;
    case CRP::RESIDENTIAL:
      speed = 20;
      break;
    case CRP::SERVICE:
      speed = 5;
      break;
    case CRP::MOTORWAY_LINK:
      speed = 60;
      break;
    case CRP::TRUNK_LINK:
      speed = 60;
      break;
    case CRP::PRIMARY_LINK:
      speed = 55;
      break;
    case CRP::SECONDARY_LINK:
      speed = 50;
      break;
    case CRP::TERTIARY_LINK:
      speed = 40;
      break;
    case CRP::LIVING_STREET:
      speed = 5;
      break;
    case CRP::ROAD:
      speed = 50;
      break;
    default:
      speed = 30;
      break;
    }
  }

  return speed;
}

float getTimeToTraverseEdgeInMinutes(CRP::EdgeAttributes attr) {
  return (attr.getLength() / 1000.0f) / getSpeed(attr) * 60;
}

float getMultiplierForEdge(CRP::ForwardEdge edge, int volume) {
  // Determine the actual travel time for a given edge, based on how many cars
  // are currently driving on it, using the BPR link congestion function based
  // on the Frank-Wolfe algorithm
  float freeFlow = getTimeToTraverseEdgeInMinutes(edge.attributes);
  float travelTime = freeFlow * (1 + 0.15 * pow(((float)volume / (float)edgeCapacity), 4));
  float multiplier = travelTime / freeFlow;

  // Only store the multipler if it is greater than the cutoff in order to avoid
  // rounding issues updating routes that doesn't really need it.
  return multiplier > cutoff ? multiplier : 1;
}

EdgeWithMeta getEdgeAtCarPosition(const CRP::Graph &graph, CRP::QueryResult path, int time)
{
  CRP::index edgeIndex = -1;
  float timeTravelled = 0;
  boost::optional<CRP::ForwardEdge> edge;

  for (int i = 0; i < path.path.size() - 1; i++) {
    edge = graph.getEdge(path.path[i], path.path[i + 1]);
    
    if (edge.has_value()) {
      timeTravelled += getTimeToTraverseEdgeInMinutes(edge->attributes);

      // Once we've travelled longer than the current timestamp, then stop at the
      // newest edge we've found (since that will be the edge our car is currently on)
      if (timeTravelled > time) {
        edgeIndex = graph.getEdgeIndex(path.path[i], path.path[i + 1]);
        // std::cout << i << " " << timeTravelled << " " << path.path.size() << std::endl;
        break;
      }

    }
  }

  return {edgeIndex, edge.get()};
}

/**
 * Iterates through all of our cars and determines which edge they're currently
 * at based on the passed time.
 */
void populateEdgeVolumes(const CRP::Graph &graph, unordered_map<CRP::index, int> &edgeVolume, int currentTime) {
  for (int i = 0; i < carPaths.size(); i++) {
    if (carPaths[i].res.pathWeight == 0) {
      continue;
    }

    int timeToGetPositionAt = currentTime - carPaths[i].timeOffset;
    EdgeWithMeta edgeMeta = getEdgeAtCarPosition(graph, carPaths[i].res, timeToGetPositionAt);

    if (edgeMeta.edgeIndex > graph.numberOfEdges()) {
      continue;
    }
    
    if (edgeVolume[edgeMeta.edgeIndex]) {
      edgeVolume[edgeMeta.edgeIndex] += 1;
    } else {
      edgeVolume[edgeMeta.edgeIndex] = 1;
    }
  }
}

void GetTrafficAtTime(const CRP::Graph &graph, const CRP::OverlayGraph &overlayGraph, const std::vector<CRP::Metric> &metrics, int cars, int currentTime, bool withFixed)
{
  unordered_map<CRP::index, int> edgeVolume;
  unordered_map<CRP::index, int> edgeMultiplier;

  CRP::PathUnpacker pathUnpacker(graph, overlayGraph, metrics);
  CRP::CRPQuery query(graph, overlayGraph, metrics, pathUnpacker);

  // In case we haven't initialized our cars yet, do so now!
  if (carPaths.size() < cars) {
    std::vector<std::pair<CRP::index, CRP::index>> queries(cars);

    std::vector<CRP::index> indices;
    if (withFixed) {
      for (int i = 0; i < cars; i++)
      {
        std::string srcIndexString;
        std::getline(std::cin, srcIndexString);
        CRP::index srcIndex = std::stoi(srcIndexString);

        std::string destIndexString;
        std::getline(std::cin, destIndexString);
        CRP::index destIndex = std::stoi(destIndexString);

        queries[i] = std::make_pair(srcIndex, destIndex);
      }
    }
    std::mt19937 rand;
    auto vertex_rand = std::bind(std::uniform_int_distribution<CRP::index>(0, graph.numberOfVertices() - 1),
                                 std::mt19937(get_micro_time()));

    std::cout << "Generating initial car routes ..." << std::endl;

    for (int i = 0; i < cars; i++) {
      CRP::QueryResult res;
      CRP::index source = withFixed ? queries[i].first : vertex_rand();
      CRP::index target = withFixed ? queries[i].second : vertex_rand();
      int pathSize = 0;

      // We must ensure that we actually store a query that was completed properly
      // (i.e. that our entry and exit can reach each other)
      while (pathSize == 0) {
        if (source == target)
        {
          target += 1;
        }

        res = query.vertexQuery(source, target, 0);
        pathSize = res.path.size();

        if (pathSize == 0) {
          source = vertex_rand();
          target = vertex_rand();
          std::cout << pathSize;
        }
      }

      carPaths.push_back({0, res});

      if (i % (cars / (cars > 50000 ? 100 : 10)) == 0) {
        std::cout << " " << (i * 100) / cars << "%" << std::endl;
      }
    }

    carsToUpdate = carPaths.size() * 0.9;
  } else {
    // ... else, if we're changing the current time, then let a subset of our
    // cars update their paths based on the current congestion (they're using
    // GPS's with our algorithm :))
    std::cout << "Updating " << carsToUpdate << " cars based on new traffic" << std::endl;

    for (int i = 0; i < carsToUpdate; i++) {
      int toTravel = currentTime - carPaths[i].timeOffset;
      EdgeWithMeta atEdge = getEdgeAtCarPosition(graph, carPaths[i].res, toTravel);
      CRP::index source = atEdge.edge.head;
      CRP::index dest = carPaths[i].res.path.back();

      if (source == dest) {
        vector<CRP::index> empty(0);
        carPaths[i] = {currentTime, {empty,0}};
      } else {
        carPaths[i] = {currentTime, query.vertexQuery(source, dest, 0)};
      }

      if (i % (carsToUpdate / (carsToUpdate > 50000 ? 100 : 10)) == 0)
      {
        std::cout << (i * 100) / carsToUpdate << "%" << std::endl;
      }
    }

    carsToUpdate *= 0.9;
  }

  std::cout << std::endl << "Populating edges with cars..." << std::endl;
  populateEdgeVolumes(graph, edgeVolume, currentTime);

  int max = 0;
  CRP::index maxId = 0;
  float maxCongestion = 0;
  for (auto it = edgeVolume.begin(); it != edgeVolume.end(); ++it)
  {
    CRP::ForwardEdge edge = graph.getForwardEdge(it->first);
    edgeMultiplier[it->first] = getMultiplierForEdge(edge, it->second);

    if (it->second > max) {
      max = it->second;
      maxId = it->first;
      maxCongestion = getMultiplierForEdge(edge, it->second);
    }
  }

  std::cout << "Max Volume at edge " << maxId << "=" << max << ". Congestion=" << maxCongestion << std::endl;
}