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

#include "./Experiments.h"

#include <iostream>
#include <memory>
#include <iomanip>
#include <fstream>
#include <random>
#include <functional>

using namespace std;

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

	vector<CRP::Metric> metrics(1);
	parseMetric(metricPath, metricType, metrics[0]);

	std::cout << "[PREPARED] Client ready" << std::endl;

	for (std::string line; std::getline(std::cin, line);)
	{
		std::cout << std::endl;
		if (line == "exit") {
			std::cout << "Will exit on next input.";
			return 0;
		} else if (line == "test") {
			std::cout << "Should visualization data be outputted during test?" << std::endl;
			string debug;
			std::getline(std::cin, debug);

			std::cout << "Please specify amount of times to run each algorithm." << std::endl;
			std::string numQueryString;
			std::getline(std::cin, numQueryString);
			CRP::count numQueries = std::stoi(numQueryString);

			RandExperiment(graph, overlayGraph, metrics, numQueries, debug);
		} else if (line == "update") {
			parseMetric(metricPath, metricType, metrics[0]);
		}

		std::cout << std::endl << "[FINISHED] Awaiting new input..." << std::endl << std::endl;
	}

	return 0;
}