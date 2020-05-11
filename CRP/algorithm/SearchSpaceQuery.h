#ifndef ALGORITHM_SEARCHSPACEQUERY_H_
#define ALGORITHM_SEARCHSPACEQUERY_H_

#include <memory>
#include <vector>
#include <set>

#include "../constants.h"
#include "../datastructures/Graph.h"
#include "../datastructures/id_queue.h"
#include "../datastructures/OverlayWeights.h"
#include "../metrics/Metric.h"
#include "Query.h"
#include "PathUnpacker.h"

namespace CRP
{

struct SearchSpaceResult
{
  std::set<std::pair<CRP::index, CRP::level>> visitedVertices;
  std::vector<CRP::index> path;
  CRP::weight pathWeight;
};

class SearchSpaceQuery
{
private:
  PathUnpacker &pathUnpacker;

  struct VertexInfo
  {
    weight dist;
    count round;
    VertexIdPair parent;
  };

  std::vector<VertexInfo> forwardInfo;
  std::vector<VertexInfo> backwardInfo;

  count currentRound;

  MinIDQueue<IDKeyTriple> forwardGraphPQ;
  MinIDQueue<IDKeyTriple> backwardGraphPQ;
  MinIDQueue<IDKeyTriple> forwardOverlayGraphPQ;
  MinIDQueue<IDKeyTriple> backwardOverlayGraphPQ;

protected:
  const Graph &graph;
  const OverlayGraph &overlayGraph;
  const std::vector<Metric> &metrics;

public:
  SearchSpaceQuery(const Graph &graph, const OverlayGraph &overlayGraph, const std::vector<Metric> &metrics, PathUnpacker &pathUnpacker);
  virtual ~SearchSpaceQuery() = default;

  virtual SearchSpaceResult edgeQuery(index sourceEdgeId, index targetEdgeId, index metricId);
  virtual SearchSpaceResult vertexQuery(index sourceVertexId, index targetVertexId, index metricId);
};

} /* namespace CRP */

#endif /* ALGORITHM_SearchSpaceQuery_H_ */
