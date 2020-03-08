#include "../datastructures/Graph.h"
#include "../datastructures/OverlayGraph.h"
#include "../metrics/Metric.h"

void parseMetric(std::string metricPath, std::string metricType, CRP::Metric& target);

void RandExperiment(const CRP::Graph &graph, const CRP::OverlayGraph &overlayGraph, const std::vector<CRP::Metric> &metrics, CRP::count numQueries, std::string debug);