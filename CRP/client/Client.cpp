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
#include "../partialUpdate/UpdateIO.h"

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
		} else if (line == "[THROTTLED]") {
			std::cout << "[PREPARED] Client ready" << std::endl;
		} else if (line == "test") {
			std::cout << "Should visualization data be outputted during test?" << std::endl;
			string visualize;
			std::getline(std::cin, visualize);
			bool shouldVisualize = visualize == "yes" ? true : false;

			std::cout << "Please specify amount of times to run each algorithm." << std::endl;
			std::string numQueryString;
			std::getline(std::cin, numQueryString);
			CRP::count numQueries = std::stoi(numQueryString);

			std::cout << "Will fixed vertices be provided by JavaScript client?" << std::endl;
			std::string withFixedString;
			std::getline(std::cin, withFixedString);
			bool withFixed = withFixedString == "yes" ? true : false;

			std::cout << "Should Dijkstra queiries by run for comparison?" << std::endl;
			std::string withDijkstraString;
			std::getline(std::cin, withDijkstraString);
			bool withDijkstra = withDijkstraString == "yes" ? true : false;

			QueryExperiment(graph, overlayGraph, metrics, numQueries, shouldVisualize, withFixed, withDijkstra);
		}
		else if (line == "update")
		{
			CRP::GraphIO::readOverlayGraph(overlayGraph, overlayGraphFile);
			parseMetric(metricPath, metricType, metrics[0]);
		}
		else if (line == "extractEdges")
		{
			std::cout << "Please specify amount of vertex to extract for each edge." << std::endl;
			std::string numVerticesString;
			std::getline(std::cin, numVerticesString);
			CRP::count numVertices = std::stoi(numVerticesString);

			ExtractEdgeVertices(graph, numVertices);
		}
		else if (line == "updateMap")
		{
			std::cout << "Please provide new map path." << std::endl;
			std::string mapPath;
			std::getline(std::cin, mapPath);

			std::cout << "Please provide new overlay map path." << std::endl;
			std::string overlayMapPath;
			std::getline(std::cin, overlayMapPath);

			CRP::GraphIO::readGraph(graph, mapPath);
			CRP::GraphIO::readOverlayGraph(overlayGraph, overlayMapPath);
		}
		else if (line == "generateTraffic")
		{
			std::cout << "Please specify amount of cars to generate traffic with." << std::endl;
			std::string numCarsString;
			std::getline(std::cin, numCarsString);
			CRP::count cars = std::stoi(numCarsString);

			std::cout << "Please specify amount of times to reapply new metrics." << std::endl;
			std::string updateString;
			std::getline(std::cin, updateString);
			int updateCount = std::stoi(updateString);

			std::cout << "Please specify current time" << std::endl;
			std::string timeString;
			std::getline(std::cin, timeString);
			int time = std::stoi(timeString);

			std::cout << "Please specify output file path to store traffic update at" << std::endl;
			std::string outputFilePath;
			std::getline(std::cin, outputFilePath);

			std::cout << "Will fixed vertices be provided by JavaScript client?" << std::endl;
			std::string withFixedString;
			std::getline(std::cin, withFixedString);
			bool withFixed = withFixedString == "yes" ? true : false;

			WriteTrafficAtTime(graph, overlayGraph, metrics, outputFilePath, cars, time, withFixed);
			UpdateWeights(graph, overlayGraph, metrics[0], metricType, outputFilePath, 1);
		} else if (line == "trafficQuery") {
			std::cout << "Please specify amount of times to run the client in this iteration" << std::endl;
			std::string testAmountString;
			std::getline(std::cin, testAmountString);
			CRP::count testAmount = std::stoi(testAmountString);

			std::cout << "Please specify current time" << std::endl;
			std::string timeString;
			std::getline(std::cin, timeString);
			int time = std::stoi(timeString);

			std::cout << "Will fixed vertices be provided by JavaScript client?" << std::endl;
			std::string withFixedString;
			std::getline(std::cin, withFixedString);
			bool withFixed = withFixedString == "yes" ? true : false;

			ClientTest(graph, overlayGraph, metrics, time, testAmount, !withFixed);
		} else if (line == "getAllArcsInCell") {
			std::cout << "Please specify output path of the cell arcs" << std::endl;
			std::string outputPath;
			std::getline(std::cin, outputPath);

			std::cout << "Please specify the id of the cell to extract vertices from" << std::endl;
			std::string cellNumberString;
			std::getline(std::cin, cellNumberString);
			int cellNumber = std::stoi(cellNumberString);

			getAllArcsInCell(overlayGraph, cellNumber, outputPath);
		} else if (line == "getDiffArcsOnLevel") {
			std::cout << "Please specify output path of the cell arcs" << std::endl;
			std::string outputPath;
			std::getline(std::cin, outputPath);

			std::cout << "Please specify the level on which to extract vertices from" << std::endl;
			std::string levelString;
			std::getline(std::cin, levelString);
			int level = std::stoi(levelString);

			getDiffArcsOnLevel(overlayGraph, level, outputPath);
		} else if (line == "partialUpdateWeights") {
			std::cout << "Please specify amount of times to reapply new metrics." << std::endl;
			std::string updateString;
			std::getline(std::cin, updateString);
			int updateCount = std::stoi(updateString);

			std::cout << "Please specify input file path to store traffic update at" << std::endl;
			std::string inputFilePath;
			std::getline(std::cin, inputFilePath);

			UpdateWeights(graph, overlayGraph, metrics[0], metricType, inputFilePath, updateCount);
		}

		std::cout << std::endl << "[FINISHED] Awaiting new input..." << std::endl << std::endl;
	}

	return 0;
}
