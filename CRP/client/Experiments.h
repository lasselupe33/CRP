#include "../datastructures/Graph.h"
#include "../datastructures/OverlayGraph.h"
#include "../metrics/Metric.h"

void parseMetric(std::string metricPath, std::string metricType, CRP::Metric& target);

void QueryExperiment(const CRP::Graph &graph, const CRP::OverlayGraph &overlayGraph, const std::vector<CRP::Metric> &metrics, CRP::count numQueries, bool shouldVisualize, bool getVerticesFromIndex, bool withDijkstra);

void WriteTrafficAtTime(const CRP::Graph &graph, const CRP::OverlayGraph &overlayGraph, const std::vector<CRP::Metric> &metrics, std::string outputFilePath, int cars, int currentTime, bool withFixed);
void ClientTest(const CRP::Graph &graph, const CRP::OverlayGraph &overlayGraph, const std::vector<CRP::Metric> &metrics, int currentTime, int testAmount, bool randomRoute);

void ExtractEdgeVertices(const CRP::Graph &graph, int amount = 1000);
void GetEdgeRoutes(CRP::CRPQuery &query, std::vector<std::pair<CRP::index, CRP::index>> &target, int amount);

void UpdateWeights(CRP::Graph &graph, const CRP::OverlayGraph &overlayGraph, CRP::Metric &metric, std::string metricType, std::string updateFilePath, int updateCount);
