#include "../algorithm/SearchSpaceQuery.h"
#include "../algorithm/CRPQuery.h"
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
#include "Experiments.h"

#include <iostream>
#include <memory>
#include <iomanip>
#include <fstream>
#include <random>
#include <functional>
#include <set>
#include <map>

using namespace std;

int bucketSize = 1000;
string delimiter = "_____________________________________";

void SearchSpace(const CRP::Graph &graph, const CRP::OverlayGraph &overlayGraph, const std::vector<CRP::Metric> &metrics, CRP::count numQueries, string output, bool withFixed, bool visualize)
{
  std::map<int, std::vector<CRP::SearchSpaceResult>> resultBuckets;
  std::map<int, std::vector<double>> timeBuckets;

  std::vector<std::pair<CRP::index, CRP::index>> queries;
  std::vector<CRP::SearchSpaceResult> results;
  CRP::PathUnpacker pathUnpacker(graph, overlayGraph, metrics);
  CRP::SearchSpaceQuery query(graph, overlayGraph, metrics, pathUnpacker);
  CRP::Dijkstra dijkstra(graph, overlayGraph, metrics);
  CRP::CRPQuery biQuery(graph, overlayGraph, metrics, pathUnpacker);

  if (withFixed) {
    GetEdgeRoutes(biQuery, queries, numQueries);
  } else {
    std::mt19937 rand;
    auto vertex_rand = std::bind(std::uniform_int_distribution<CRP::index>(0, graph.numberOfVertices() - 1),
                                 std::mt19937(get_micro_time()));

    for (CRP::index i = 0; i < numQueries; ++i)
    {
      queries.push_back(std::make_pair(vertex_rand(), vertex_rand()));
    }
  }

  double start;
  double end;
  double sum = 0;

  std::cout << "Running bi queries" << std::endl;
  for (std::pair<CRP::index, CRP::index> &q : queries)
  {
    CRP::index source = q.first;
    CRP::index target = q.second;

    start = get_micro_time();
    CRP::SearchSpaceResult res = query.vertexQuery(source, target, 0);
    results.push_back(res);

    end = get_micro_time();
    sum += end - start;

    int bucketIndex = std::floor(res.path.size() / bucketSize);

    if (resultBuckets.find(bucketIndex) != resultBuckets.end()) {
      resultBuckets[bucketIndex].push_back(res);
    }
    else {
      resultBuckets[bucketIndex] = vector<CRP::SearchSpaceResult>(1, res);
    }

    if (timeBuckets.find(bucketIndex) != timeBuckets.end()) {
      timeBuckets[bucketIndex].push_back(end - start);
    }
    else {
      timeBuckets[bucketIndex] = vector<double>(1, end - start);
    }
  }

  for (auto it = resultBuckets.begin(); it != resultBuckets.end(); ++it)
  {
    std::cout << delimiter << std::endl;
    std::cout << "Bucket " << it->first * bucketSize << "-" << it->first * bucketSize + bucketSize - 1 << " (" << it->second.size() << ")" << std::endl << std::endl;

    float totalExploredVertices = 0;
    float totalPathLength = 0;
    float totalTime = 0;
    std::map<CRP::index, int> levels;

    for (int i = 0; i < it->second.size(); i++)
    {
      totalExploredVertices += it->second[i].visitedVertices.size();
      totalPathLength += it->second[i].path.size();
      totalTime += timeBuckets[it->first][i];

      // Determine the level on which the vertices were found
      for (auto it2 = it->second[i].visitedVertices.begin(); it2 != it->second[i].visitedVertices.end(); ++it2) {
        CRP::index level = it2->second;

        if (levels.find(level) != levels.end()) {
          levels[level]++;
        }
        else {
          levels[level] = 1;
        }
      }
    }

    float avgVerticesPerPathLength = totalExploredVertices / totalPathLength;
    float avgVisitedVertices = totalExploredVertices / it->second.size(); 
    float avgTime = totalTime / it->second.size() / 1000;

    std::cout << "BiQuery explored " << std::round(avgVisitedVertices) << " vertices on average in this bucket." << std::endl;
    std::cout << setprecision(3);
    std::cout << "Avg time: " << avgTime << "ms." << std::endl;
    std::cout << "On average " << avgVerticesPerPathLength << " vertices were explored for each segment in the path." << std::endl;
    std::cout << std::endl;
    std::cout << "Amount of vertices visited in each level on average:" << std::endl;
    for (auto it2 = levels.begin(); it2 != levels.end(); ++it2) {
      std::cout << "Level " << it2->first << ": " << it2->second / it->second.size() << " vertices." << std::endl;
    }
    std::cout << setprecision(16);
  }

  if (visualize) {
    for (int i = 0; i < results.size(); i++)
    {
      std::ofstream outFile(output + "/" + "res_" + std::to_string(results[i].visitedVertices.size()) + ".js");
      outFile << "window.data = [ ";

      int j = 0;
      for (auto it = results[i].visitedVertices.begin(); it != results[i].visitedVertices.end(); ++it)
      {
        CRP::Vertex v = graph.getVertex(it->first);
        outFile << "{ \"lat\": " << v.coord.lat << ", \"lon\": " << v.coord.lon << ", \"lvl\": " << std::to_string(it->second) << "}";

        if (j != results[i].visitedVertices.size() - 1)
        {
          outFile << ", ";
        }

        j++;
      }

      outFile << "];\n";
      outFile << "window.query = { \"start\": { \"lat\":" << graph.getVertex(queries[i].first).coord.lat << ", \"lon\": " << graph.getVertex(queries[i].first).coord.lon << "},\"end\": { \"lat\":" << graph.getVertex(queries[i].second).coord.lat << ", \"lon\": " << graph.getVertex(queries[i].second).coord.lon << "}}";
      outFile.close();
    }
  }
}