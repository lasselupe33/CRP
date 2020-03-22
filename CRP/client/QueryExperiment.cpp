#include "../algorithm/CRPQuery.h"
#include "../algorithm/CRPQueryUni.h"
#include "../algorithm/ParallelCRPQuery.h"
#include "../algorithm/Dijkstra.h"

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

void QueryExperiment(const CRP::Graph &graph, const CRP::OverlayGraph &overlayGraph, const std::vector<CRP::Metric> &metrics, CRP::count numQueries, bool shouldVisualize, bool getVerticesFromIndex, bool withDijkstra)
{
  std::vector<std::pair<CRP::index, CRP::index>> queries(numQueries);

  if (getVerticesFromIndex) {
    std::vector<CRP::index> indices;

    for (int i = 0; i < numQueries; i++)
    {
      std::string srcIndexString;
      std::getline(std::cin, srcIndexString);
      CRP::index srcIndex = std::stoi(srcIndexString);

      std::string destIndexString;
      std::getline(std::cin, destIndexString);
      CRP::index destIndex = std::stoi(destIndexString);

      queries.push_back(std::make_pair(srcIndex, destIndex));
    }
  } else {
    std::mt19937 rand;
    auto vertex_rand = std::bind(std::uniform_int_distribution<CRP::index>(0, graph.numberOfVertices() - 1),
                                 std::mt19937(get_micro_time()));

    for (CRP::index i = 0; i < numQueries; ++i)
    {
      queries[i] = std::make_pair(vertex_rand(), vertex_rand());
    }
  }

  CRP::PathUnpacker pathUnpacker(graph, overlayGraph, metrics);
  CRP::CRPQueryUni query(graph, overlayGraph, metrics, pathUnpacker);
  CRP::CRPQuery biQuery(graph, overlayGraph, metrics, pathUnpacker);
  CRP::ParallelCRPQuery parQuery(graph, overlayGraph, metrics, pathUnpacker);
  CRP::Dijkstra dijkstra(graph, overlayGraph, metrics);
  long long start;
  long long end;
  CRP::index sum = 0;
  CRP::index biSum = 0;
  CRP::index parSum = 0;
  CRP::index dijkstraSum = 0;

  std::cout << "Running uni queries" << std::endl;
  for (std::pair<CRP::index, CRP::index> &q : queries)
  {
    CRP::index source = q.first;
    CRP::index target = q.second;

    start = get_micro_time();
    CRP::QueryResult res = query.vertexQuery(source, target, 0);
    end = get_micro_time();
    sum += end - start;

    if (res.path.size() > 0 && shouldVisualize && source != target)
    {
      std::cout << "[TO_CLIENT_BEGIN]" << std::endl;
      for (CRP::index i = 0; i < res.path.size(); ++i)
      {
        CRP::Vertex v = graph.getVertex(res.path[i]);
        std::cout << v.coord.lat << " " << v.coord.lon << " ";
      }
      std::cout << std::endl << "[TO_CLIENT_END]" << std::endl;
    }
  }

  std::cout << "Running bi queries" << std::endl;
  for (std::pair<CRP::index, CRP::index> &q : queries)
  {
    CRP::index source = q.first;
    CRP::index target = q.second;

    start = get_micro_time();
    biQuery.vertexQuery(source, target, 0);
    end = get_micro_time();
    biSum += end - start;
  }

  std::cout << "Running parallel queries" << std::endl;
  for (std::pair<CRP::index, CRP::index> &q : queries)
  {
    CRP::index source = q.first;
    CRP::index target = q.second;

    start = get_micro_time();
    parQuery.vertexQuery(source, target, 0);

    end = get_micro_time();
    parSum += end - start;
  }

  if (withDijkstra) {
    std::cout << "Running dijkstra queries" << std::endl;
    for (std::pair<CRP::index, CRP::index> &q : queries)
    {
      CRP::index source = q.first;
      CRP::index target = q.second;

      start = get_micro_time();
      dijkstra.vertexQuery(source, target, 0);

      end = get_micro_time();
      dijkstraSum += end - start;
    }
  }

  if (shouldVisualize)
  {
    std::cout << "[END_CLIENT]" << std::endl;
  }
  sum /= 1000;
  biSum /= 1000;
  parSum /= 1000;
  dijkstraSum /= 1000;
  std::cout << std::setprecision(3);
  std::cout << "Uni Took " << sum << " ms. Avg = " << (double)sum / (double)numQueries << " ms." << std::endl;
  std::cout << "Bi Took " << biSum << " ms. Avg = " << (double)biSum / (double)numQueries << " ms." << std::endl;
  std::cout << "Par Took " << parSum << " ms. Avg = " << (double)parSum / (double)numQueries << " ms." << std::endl;

  if (withDijkstra) {
    std::cout << "Dijkstra Took " << parSum << " ms. Avg = " << (double)dijkstraSum / (double)numQueries << " ms." << std::endl;
  }

  std::cout << std::setprecision(16);
}