/*
 * QueryTest.cpp
 *
 *  Created on: Jan 27, 2016
 *      Author: Michael Wegner
 *
 * Copyright (c) 2016 Michael Wegner and Matthias Wolf
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

#include "../algorithm/CRPQuery.h"
#include "../algorithm/CRPQueryUni.h"
#include "../algorithm/ParallelCRPQuery.h"

#include "../datastructures/Graph.h"
#include "../datastructures/OverlayGraph.h"
#include "../datastructures/OverlayWeights.h"
#include "../datastructures/QueryResult.h"
#include "../io/GraphIO.h"
#include "../metrics/Metric.h"
#include "../metrics/DistanceFunction.h"
#include "../metrics/HopFunction.h"
#include "../metrics/TimeFunction.h"
#include "../metrics/CostFunction.h"

#include "../timer.h"
#include "../constants.h"

#include <iostream>
#include <memory>
#include <iomanip>
#include <fstream>
#include <random>
#include <functional>

using namespace std;

void execTest(const CRP::Graph &graph, const CRP::OverlayGraph &overlayGraph, const std::vector<CRP::Metric> &metrics, CRP::count numQueries, string debug){
	std::mt19937 rand;
	auto vertex_rand = std::bind(std::uniform_int_distribution<CRP::index>(0, graph.numberOfVertices() - 1),
															 mt19937(get_micro_time()));

	CRP::PathUnpacker pathUnpacker(graph, overlayGraph, metrics);
	CRP::CRPQueryUni query(graph, overlayGraph, metrics, pathUnpacker);
	CRP::CRPQuery biQuery(graph, overlayGraph, metrics, pathUnpacker);
	CRP::ParallelCRPQuery parQuery(graph, overlayGraph, metrics, pathUnpacker);
	long long start;
	long long end;
	CRP::index sum = 0;
	CRP::index biSum = 0;
	CRP::index parSum = 0;

	std::vector<std::pair<CRP::index, CRP::index>> queries(numQueries);
	for (CRP::index i = 0; i < numQueries; ++i)
	{
		queries[i] = std::make_pair(vertex_rand(), vertex_rand());
	}

	std::cout << "Running uni queries" << std::endl;
	for (std::pair<CRP::index, CRP::index> &q : queries)
	{
		CRP::index source = q.first;
		CRP::index target = q.second;

		start = get_micro_time();
		CRP::QueryResult res = query.vertexQuery(source, target, 0);
		end = get_micro_time();
		sum += end - start;

		if (res.path.size() > 0 && debug == "debug")
		{
			std::cout << "[TO_CLIENT_BEGIN]" << std::endl;
			for (CRP::index i = 0; i < res.path.size() - 1; ++i)
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

	if (debug == "debug")
	{
		std::cout << "[END_CLIENT]" << std::endl;
	}
	sum /= 1000;
	biSum /= 1000;
	parSum /= 1000;
	std::cout << std::setprecision(3);
	std::cout << "Uni Took " << sum << " ms. Avg = " << (double)sum / (double)numQueries << " ms." << std::endl;
	std::cout << "Bi Took " << biSum << " ms. Avg = " << (double)biSum / (double)numQueries << " ms." << std::endl;
	std::cout << "Par Took " << parSum << " ms. Avg = " << (double)parSum / (double)numQueries << " ms." << std::endl;
}

int main(int argc, char *argv[]) {
	if (argc < 5) {
		std::cout << argv[0] << " numQueries pathToGraph pathToOverlayGraph pathToMetric metricType" << std::endl;
		return 1;
	}

	std::string graphFile = argv[1];
	std::string overlayGraphFile = argv[2];
	std::string metricPath = argv[3];
	std::string metricType = argv[4];

	cout << "Reading graph" << endl;
	CRP::Graph graph;
	CRP::GraphIO::readGraph(graph, graphFile);

	cout << "Reading overlay graph" << endl;
	CRP::OverlayGraph overlayGraph;
	CRP::GraphIO::readOverlayGraph(overlayGraph, overlayGraphFile);

	cout << "Reading metric" << endl;
	vector<CRP::Metric> metrics(1);
	if (metricType == "dist") {
		std::ifstream stream(metricPath);
		CRP::Metric::read(stream, metrics[0], std::unique_ptr<CRP::CostFunction>(new CRP::DistanceFunction()));
		stream.close();
	} else if (metricType == "hop") {
		std::ifstream stream(metricPath);
		CRP::Metric::read(stream, metrics[0], std::unique_ptr<CRP::CostFunction>(new CRP::HopFunction()));
		stream.close();
	} else if (metricType == "time") {
		std::ifstream stream(metricPath);
		CRP::Metric::read(stream, metrics[0], std::unique_ptr<CRP::CostFunction>(new CRP::TimeFunction()));
		stream.close();
	} else {
		std::cout << "ERROR: Unknown metic type " << metricType << std::endl;
		return 1;
	}

	std::cout << std::endl << "Client prepared" << std::endl << std::endl;

	for (std::string line; std::getline(std::cin, line);)
	{
		std::cout << std::endl;
		if (line == "exit") {
			return 0;
		} else if (line.find("test") != std::string::npos) {
			string debug = line.substr(line.find(" ") + 1, line.length());

			std::cout << "Please specify amount of times to run each algorithm.." << std::endl;
			std::string numQueryString;
			std::getline(std::cin, numQueryString);
			CRP::count numQueries = std::stoi(numQueryString);
	
			execTest(graph, overlayGraph, metrics, numQueries, debug);
		} else if (line == "update") {
			std::cout << "Updating metrics" << std::endl;
		}

		std::cout << std::endl << "Finished." << std::endl << "Awaiting new input..." << std::endl << std::endl;
	}

	return 0;
}
