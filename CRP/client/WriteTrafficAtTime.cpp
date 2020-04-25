#include "../algorithm/CRPQuery.h"
#include "../algorithm/CRPQueryUni.h"
#include "../algorithm/ParallelCRPQuery.h"

#include "../datastructures/Graph.h"
#include "../datastructures/OverlayGraph.h"
#include "../datastructures/QueryResult.h"
#include "../metrics/Metric.h"

#include "../timer.h"
#include "../constants.h"
#include "Experiments.h"

#include <iostream>
#include <memory>
#include <iomanip>
#include <fstream>
#include <random>
#include <functional>
#include <queue>
#include <vector>
#include <boost/iostreams/device/file.hpp>
#include <boost/iostreams/filtering_stream.hpp>
#include <set>

using namespace std;

struct PathData {
  int timeOffset;
  double randOffset;
  CRP::QueryResult res;
};

struct EdgeWithMeta {
  CRP::index backwardEdgeIndex;
  CRP::index edgeIndex;
  CRP::ForwardEdge edge;
};

set<CRP::index> alteredEdges;
vector<PathData> carPaths;
vector<CRP::index> emptyRes(0);
PathData clientPath = {0, 0, {emptyRes, 0}};
int iteration = 0;
int carsToUpdate = 0;
int amountOfCars;
int carUsageInMeters = 10;
float cutoff = 1.02;

float capacity(CRP::weight length) {
  float cap = (float)length / (float)carUsageInMeters;
  return cap > 1.0 ? cap : 1.0;
}

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
  float edgeCapacity = capacity(edge.attributes.getLength());
  float freeFlow = getTimeToTraverseEdgeInMinutes(edge.attributes);
  float travelTime = freeFlow * (1 + 0.15 * pow(((float)volume / (float)edgeCapacity), 4));
  float multiplier = travelTime / freeFlow;

  // Only store the multipler if it is greater than the cutoff in order to avoid
  // rounding issues updating routes that doesn't really need it.
  return multiplier > cutoff ? multiplier : 1;
}

EdgeWithMeta getEdgeAtCarPosition(const CRP::Graph &graph, CRP::QueryResult path, int time)
{
  CRP::index backwardEdgeIndex = -1;
  CRP::index edgeIndex = -1;
  boost::optional<CRP::ForwardEdge> edge;
  float timeTravelled = 0;

  for (int i = 0; i < path.path.size() - 1; i++) {
    edge = graph.getEdge(path.path[i], path.path[i + 1]);

    if (edge.is_initialized()) {
      timeTravelled += getTimeToTraverseEdgeInMinutes(edge->attributes);

      // Once we've travelled longer than the current timestamp, then stop at the
      // newest edge we've found (since that will be the edge our car is currently on)
      if (timeTravelled > time) {
        edgeIndex = graph.getEdgeIndex(path.path[i], path.path[i + 1]);
        backwardEdgeIndex = graph.findBackwardEdge(path.path[i], path.path[i + 1]);
        // std::cout << i << " " << timeTravelled << " " << path.path.size() << std::endl;
        break;
      }

    }
  }

  return {backwardEdgeIndex, edgeIndex, edge.get()};
}

/**
 * Iterates through all of our cars and determines which edge they're currently
 * at based on the passed time.
 */
void populateEdgeVolumes(const CRP::Graph &graph, unordered_map<CRP::index, double> &edgeVolume, unordered_map<CRP::index, CRP::index> &edgeToBackwardEdge, int currentTime)
{
  unordered_map<CRP::index, int> carsAtEdge;

  for (int i = 0; i < carPaths.size(); i++) {
    if (carPaths[i].res.pathWeight == 0) {
      continue;
    }

    int timeToGetPositionAt = currentTime - carPaths[i].timeOffset;
    EdgeWithMeta edgeMeta = getEdgeAtCarPosition(graph, carPaths[i].res, timeToGetPositionAt);

    if (edgeMeta.edgeIndex > graph.numberOfEdges()) {
      continue;
    }
    
    if (carsAtEdge[edgeMeta.edgeIndex]) {
      carsAtEdge[edgeMeta.edgeIndex] += 1;
    } else {
      carsAtEdge[edgeMeta.edgeIndex] = 1;
    }

    if (!edgeToBackwardEdge[edgeMeta.edgeIndex]) {
      edgeToBackwardEdge[edgeMeta.edgeIndex] = edgeMeta.backwardEdgeIndex;
    }
  }

  for (auto it = carsAtEdge.begin(); it != carsAtEdge.end(); ++it)
  {
    CRP::ForwardEdge edge = graph.getForwardEdge(it->first);
    double multiplier = getMultiplierForEdge(edge, it->second);
    if (multiplier > 1)
    {
      edgeVolume[it->first] = multiplier;
    }
  }
}

void ClientTest(const CRP::Graph &graph, const CRP::OverlayGraph &overlayGraph, const std::vector<CRP::Metric> &metrics, int currentTime, int testAmount, bool randomRoute) {
  CRP::PathUnpacker pathUnpacker(graph, overlayGraph, metrics);
  CRP::CRPQuery query(graph, overlayGraph, metrics, pathUnpacker);

  if (clientPath.res.path.size() == 0) {
    std::vector<std::pair<CRP::index, CRP::index>> routeVertices;

    if (randomRoute) {
      std::mt19937 rand;
      auto vertex_rand = std::bind(std::uniform_int_distribution<CRP::index>(0, graph.numberOfVertices() - 1),
                                  std::mt19937(get_micro_time()));

      routeVertices.push_back(std::make_pair(vertex_rand(), vertex_rand()));
    } else {
      GetEdgeRoutes(query, routeVertices, 1);
    }

    CRP::QueryResult baseRes = query.vertexQuery(routeVertices[0].first, routeVertices[0].second, 0);
    clientPath = {currentTime, 0, baseRes};
  }

  EdgeWithMeta currentEdge = getEdgeAtCarPosition(graph, clientPath.res, currentTime - clientPath.timeOffset);
  CRP::index currSrcIndex = currentEdge.edge.head;
  CRP::index destIndex = clientPath.res.path[clientPath.res.path.size() - 1];

  // In case we get here, this means that our journey has ended :-)
  if (currSrcIndex == destIndex) {
    std::cout << "[FINSINHED_JOURNEY]" << std::endl;
    return;
  }

  CRP::index sum = 0;
  CRP::QueryResult res;

  for (int i = 0; i < testAmount; i++) {
    long long start = get_micro_time();
    res = query.vertexQuery(currSrcIndex, destIndex, 0);
    long long end = get_micro_time();
    sum += end - start;
  }

  // if (res.path.size() > 0)
  // {
  //   std::cout << "[CAR_PATH_START]" << std::endl;
  //   for (CRP::index i = 0; i < res.path.size(); ++i)
  //   {
  //     CRP::Vertex v = graph.getVertex(res.path[i]);
  //     std::cout << v.coord.lat << "," << v.coord.lon << " ";
  //   }
  //   std::cout << std::endl << "[CAR_PATH_END]" << std::endl;
  // }

  std::cout << "Remaining path " << res.path.size() << std::endl;

  clientPath.timeOffset = currentTime;
  clientPath.res = res;

  if (res.path.size() == 0) {
    std::cout << "[FINSINHED_JOURNEY]" << std::endl;
    return;
  }

  sum /= 1000;
  std::cout << std::setprecision(3);
  std::cout << "Took " << sum << " ms. Avg = " << (double)sum / (double)testAmount << " ms." << std::endl;
  std::cout << std::setprecision(16);
}

void WriteTrafficAtTime(const CRP::Graph &graph, const CRP::OverlayGraph &overlayGraph, const std::vector<CRP::Metric> &metrics, std::string outputFilePath, int cars, int currentTime, bool withFixed)
{
  amountOfCars = cars;
  unordered_map<CRP::index, double> edgeVolume;
  unordered_map<CRP::index, CRP::index> edgeToBackwardEdge;

  const CRP::Metric& costFunction = metrics[0];
  CRP::PathUnpacker pathUnpacker(graph, overlayGraph, metrics);
  CRP::CRPQuery query(graph, overlayGraph, metrics, pathUnpacker);

  // In case we haven't initialized our cars yet, do so now!
  if (carPaths.size() < cars) {
    std::vector<std::pair<CRP::index, CRP::index>> queries;

    std::vector<CRP::index> indices;
    if (withFixed) {
      GetEdgeRoutes(query, queries, cars);
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

      double offset = (double)rand() / RAND_MAX * 15;
      carPaths.push_back({0, offset, res});

      if (i % (cars / (cars > 5000 ? 100 : 10)) == 0) {
        std::cout << " " << (i * 100) / cars << "%" << std::endl;
      }
    }

    carsToUpdate = carPaths.size() * 0.1;
  } else {
    // ... else, if we're changing the current time, then let a subset of our
    // cars update their paths based on the current congestion (they're using
    // GPS's with our algorithm :))
    std::cout << "Updating " << carsToUpdate << " cars based on new traffic" << std::endl;

    for (int i = 0; i < carsToUpdate; i++) {
      if (carPaths[i].res.path.size() == 0) {
        continue;
      }

      int toTravel = currentTime - carPaths[i].timeOffset + carPaths[i].randOffset;
      EdgeWithMeta atEdge = getEdgeAtCarPosition(graph, carPaths[i].res, toTravel);
      CRP::index source = atEdge.edge.head;
      CRP::index dest = carPaths[i].res.path.back();

      if (source == dest) {
        carPaths[i] = {currentTime, 0, {emptyRes,0}};
      } else {
        carPaths[i] = {currentTime, carPaths[i].randOffset, query.vertexQuery(source, dest, 0)};
      }

      if (i % (carsToUpdate / (carsToUpdate > 50000 ? 100 : 10)) == 0)
      {
        std::cout << (i * 100) / carsToUpdate << "%" << std::endl;
      }
    }
  }

  std::cout << std::endl << "Populating edges with cars... ";
  populateEdgeVolumes(graph, edgeVolume, edgeToBackwardEdge, currentTime);

  std::cout << "altered " << edgeVolume.size() << " edges" << std::endl;

  // Write updated edge weights
  std::ofstream file;
  file.open(outputFilePath);
  if (!file.is_open()) {
    return;
  }
  file << std::setprecision(16);
  file << edgeVolume.size() * 2 << std::endl;

  CRP::index maxId = 0;
  float maxCongestion = 0;
  for (auto it = edgeVolume.begin(); it != edgeVolume.end(); ++it)
  {
    if (iteration % 10 != 0) {
      alteredEdges.insert(it->first);
    }
    file << it->first << " " << it->second << std::endl;
    file << edgeToBackwardEdge[it->first] << " " << it->second << std::endl;    

    if (it->second > maxCongestion) {
      maxId = it->first;
      maxCongestion = it->second;
    }
  }

  if (iteration % 10 == 0) {
    for (auto it = alteredEdges.begin(); it != alteredEdges.end(); ++it)
    {
      file << *it << " " << 1 << std::endl;
      file << edgeToBackwardEdge[*it] << " " << 1 << std::endl;
    }
    alteredEdges.clear();

    for (auto it = edgeVolume.begin(); it != edgeVolume.end(); ++it)
    {
      alteredEdges.insert(it->first);
    }
  }


  file.close();
  std::cout << "Max Volume at edge " << maxId << " at " << currentTime << " minutes. Congestion=" << maxCongestion << std::endl;
  iteration++;
}