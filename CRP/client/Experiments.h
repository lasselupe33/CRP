#include "../datastructures/Graph.h"
#include "../datastructures/OverlayGraph.h"
#include "../metrics/Metric.h"

void parseMetric(std::string metricPath, std::string metricType, CRP::Metric& target);

void QueryExperiment(const CRP::Graph &graph, const CRP::OverlayGraph &overlayGraph, const std::vector<CRP::Metric> &metrics, CRP::count numQueries, std::string debug, bool getVerticesFromIndex);

void ExtractEdgeVertices(const CRP::Graph &graph, int amount = 1000);
