
#include "../io/GraphIO.h"

#include <boost/iostreams/device/file.hpp>
#include <boost/iostreams/filter/bzip2.hpp>
#include <boost/iostreams/filtering_stream.hpp>
#include <algorithm>
#include <cassert>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <iterator>
#include <sstream>
#include <stdexcept>
#include <unordered_map>
#include <vector>
#include <set>

#include "../constants.h"
#include "../datastructures/LevelInfo.h"
#include "../io/vector_io.h"
#include "../io/OSMParser.h"
#include "../datastructures/id_queue.h"
#include "omp.h"

#include "../metrics/CostFunction.h"
#include "../metrics/DistanceFunction.h"
#include "../metrics/HopFunction.h"
#include "../metrics/TimeFunction.h"

/// NEEDED FROM METRIC.H
/** Hashes an int vector. Taken from http://stackoverflow.com/questions/20511347/a-good-hash-function-for-a-vector */
struct IntVectorHasher {
	std::size_t operator()(std::vector<int> const& vec) const {
		std::size_t seed = 0;
		for(auto& i : vec) {
			seed ^= i + 0x9e3779b9 + (seed << 6) + (seed >> 2);
		}
		return seed;
	}
};
namespace CRP{

// the update file is expected to have no header/meta information in the top and consist only of the ID of the arc followed by the new weight
// example of line in file: "234 97479"
bool readUpdateFile(std::vector<std::pair<CRP::index ,CRP::weight>> &update, const std::string &inputFilePath) {
    std::ifstream file(inputFilePath, std::ios_base::in | std::ios_base::binary);
    if (!file.is_open()) return false;

    boost::iostreams::filtering_streambuf<boost::iostreams::input> inbuf;
    inbuf.push(file);

    std::string line;
    std::istream instream(&inbuf);
    std::vector<std::string> tokens;

    if(file.eof()) return false;

		std::string updateAmountString;
		std::getline(instream, updateAmountString);
		int updateAmount = std::stoi(updateAmountString);

		std::pair<index,weight> singleUpdate;
    std::vector<std::pair<index, weight>> updates;
    for(int i = 0; i < updateAmount; i++){
        std::getline(instream, line);
        tokens = CRP::GraphIO::splitString(line, ' ');
        assert(tokens.size() == 2);
        singleUpdate.first = CRP::GraphIO::stoui(tokens[0]);
        singleUpdate.second = std::stoul(tokens[1]);
        updates.push_back(singleUpdate);
    }

		std::cout << "Found " << updates.size() << " edges to update." << std::endl;
    
    update = updates;

    return true;
}

bool updateWeights(std::vector<std::pair<CRP::index, CRP::weight>> &update, Graph &graph, const OverlayGraph &overlayGraph, std::vector<CRP::weight> &curWeights, const CostFunction &costFunction)
{
	// TODO: this - unless?
	// snup graph og overlay graph for info
	// gennemgå updates så vi har pv flags
	std::set<CRP::pv> alteredCells;

	bool forwardEdge = true;
	for (std::vector<std::pair<index, weight>>::iterator it = update.begin(); it != update.end(); ++it)
	{
		// forward edge in graphs
		CRP::ForwardEdge fEdge = graph.getForwardEdge((*it).first);
		CRP::pv cellNumber = graph.getCellNumber(fEdge.head);

		edgeAttr newAttr = ((weight)fEdge.attributes.getLength() * 400 << 12);
		newAttr |= ((edgeAttr)fEdge.attributes.getSpeed()) << 4;
		newAttr |= ((edgeAttr)fEdge.attributes.getStreetType());

		if (forwardEdge) {
			graph.changeEdgeAttr(it->first, newAttr, true);
		} else {
			graph.changeEdgeAttr(it->first, newAttr, false);
		}

		alteredCells.insert(cellNumber);
	} // maybe dør den hvis ikke der findes en edge/vertex/pv for et ID ? tjek mht om det er graph/overlaygraph

	// gennemgå hvert level og find de respektive arcs i hver celle
	// - alt er loadet ind i graph og overlaygraph

	/// BEGIN BUILD LOWEST
	std::vector<weight> overlayDist(overlayGraph.numberOfVertices(), inf_weight);

	index maxNumThreads = omp_get_max_threads();

	std::vector<std::vector<weight>> dist(maxNumThreads, std::vector<weight>(graph.getMaxEdgesInCell(), inf_weight));
	std::vector<MinIDQueue<IDKeyTriple>> queue(maxNumThreads, MinIDQueue<IDKeyTriple>(graph.getMaxEdgesInCell()));
	std::vector<std::vector<index>> round(maxNumThreads, std::vector<index>(graph.getMaxEdgesInCell(), 0));
	std::vector<index> currentRound(maxNumThreads, 0);

	overlayGraph.parallelForCells(1, [&](const Cell& cell, const pv cellNumber) {
		// BREAK IF NO NEED TO CHANGE WEIGHT (pv is not in list)
		if (alteredCells.find(cellNumber) == alteredCells.end()) {
			return;
		}

    index threadId = omp_get_thread_num();
		for (index i = 0; i < cell.numEntryPoints; ++i) {
			index startOverlay = overlayGraph.getEntryPoint(cell, i);
			const OverlayVertex& overlayVertex = overlayGraph.getVertex(startOverlay);
			index start = overlayVertex.originalVertex;
			const index forwardCellOffset = graph.getBackwardEdgeCellOffset(start);
			index startId = overlayVertex.originalEdge - forwardCellOffset;
			assert(startId < graph.getMaxEdgesInCell());

			assert(overlayVertex.cellNumber == cellNumber);
			assert(queue[threadId].empty());

			currentRound[threadId]++;
			dist[threadId][startId] = 0;
			round[threadId][startId] = currentRound[threadId];
			queue[threadId].push({startId, start, 0});

			while (!queue[threadId].empty()) {
				auto minTriple = queue[threadId].pop();
				index uId = minTriple.id;
				index u = minTriple.vertexId;
				assert(uId < graph.getMaxEdgesInCell());

				assert(graph.getCellNumber(u) == cellNumber);
				assert(round[threadId][uId] == currentRound[threadId]);
				assert(dist[threadId][uId] == minTriple.key);

				graph.forOutEdgesOf(u, graph.getEntryOrder(u, uId + forwardCellOffset),
						[&](const ForwardEdge& edge, index exitPoint, Graph::TURN_TYPE turnType) {
					index v = edge.head;
					weight exitPointDist = minTriple.key + costFunction.getTurnCosts(turnType);
					weight newDist = exitPointDist + costFunction.getWeight(edge.attributes);

					if (newDist >= inf_weight) return;

					if (graph.getCellNumber(v) == cellNumber) {
						index vId = graph.getEntryOffset(v) + edge.entryPoint - forwardCellOffset;
						assert(vId < graph.getMaxEdgesInCell());
						if (round[threadId][vId] == currentRound[threadId] && newDist >= dist[threadId][vId]) return;
						dist[threadId][vId] = newDist;
						round[threadId][vId] = currentRound[threadId];
						queue[threadId].pushOrDecrease({vId, v, newDist});
					} else {
						// we found an exit point of the cell
						index exitOverlay = graph.getOverlayVertex(u, exitPoint, true);
						assert(exitOverlay < overlayGraph.numberOfVertices());
						if (exitPointDist < overlayDist[exitOverlay]) {
							overlayDist[exitOverlay] = exitPointDist;
						}
					}
				});
			}

			assert(queue[threadId].empty());
			for (index j = 0; j < cell.numExitPoints; ++j) {
				const index exitPoint = overlayGraph.getExitPoint(cell, j);
				assert(overlayDist[exitPoint] <= inf_weight);
				curWeights[cell.cellOffset + i*cell.numExitPoints + j] = overlayDist[exitPoint];
				overlayDist[exitPoint] = inf_weight;
			}

		}
	});
    /// END BUILD LOWEST

    // lav build ligesom i overlay weights men kun for dem i update
	/// START BUILD REST
    int numLevels = overlayGraph.getLevelInfo().getLevelCount();
    for(int l = 2; l < numLevels; l++){

		assert(1 < l && l <= overlayGraph.getLevelInfo().getLevelCount());

		const LevelInfo& levelInfo = overlayGraph.getLevelInfo();
		const count numberOfOverlayVertices = overlayGraph.numberOfVerticesInLevel(l - 1);

		index maxNumThreads = omp_get_max_threads();

		std::vector<std::vector<weight>> dist(maxNumThreads, std::vector<weight>(numberOfOverlayVertices, inf_weight));
		std::vector<MinIDQueue<IDKeyPair>> queue(maxNumThreads, MinIDQueue<IDKeyPair>(numberOfOverlayVertices));
		std::vector<std::vector<index>> round(maxNumThreads, std::vector<index>(numberOfOverlayVertices, 0));
		std::vector<index> currentRound(maxNumThreads, 0);

		overlayGraph.parallelForCells(l, [&](const Cell &cell, const pv truncatedCellNumber) {
			// BREAK IF NO NEED TO CHANGE WEIGHT (pv is not in list)
			if (alteredCells.find(truncatedCellNumber) == alteredCells.end())
			{
				return;
			}

			index threadId = omp_get_thread_num();

			for (index i = 0; i < cell.numEntryPoints; ++i)
			{
				index start = overlayGraph.getEntryPoint(cell, i);

				++currentRound[threadId];
				dist[threadId][start] = 0;
				round[threadId][start] = currentRound[threadId];
				queue[threadId].push({start, 0});	// the queue only contains the entry points of (sub-)cells

				while (!queue[threadId].empty())
				{
					auto minPair = queue[threadId].pop();
					index entry = minPair.id;
					assert(dist[threadId][entry] == minPair.key);
					assert(levelInfo.truncateToLevel(overlayGraph.getVertex(entry).cellNumber, l) == truncatedCellNumber);

					overlayGraph.forOutNeighborsOf(entry, l - 1, [&](index exit, index w) {
						weight newDist = minPair.key + curWeights[w];

						if (newDist >= inf_weight) return;
						if (round[threadId][exit] == currentRound[threadId] && newDist >= dist[threadId][exit]) return;

						// update distance of exit vertex
						dist[threadId][exit] = newDist;
						round[threadId][exit] = currentRound[threadId];

						// traverse original edge to neighboring (sub-)cell
						const OverlayVertex& exitVertex = overlayGraph.getVertex(exit);
						index neighbor = exitVertex.neighborOverlayVertex;
						const OverlayVertex& neighborVertex = overlayGraph.getVertex(neighbor);

						// check if the neighbor is still in the same overlay cell in level l
						if (levelInfo.truncateToLevel(neighborVertex.cellNumber, l) != truncatedCellNumber) return;

						weight edgeWeight = costFunction.getWeight(graph.getForwardEdge(exitVertex.originalEdge).attributes);
						dist[threadId][neighbor] = newDist + edgeWeight;
						if (queue[threadId].contains_id(neighbor)) {
							queue[threadId].decrease_key({neighbor, newDist + edgeWeight});
							assert(round[threadId][neighbor] == currentRound[threadId]);
						} else {
							queue[threadId].push({neighbor, newDist + edgeWeight});
							round[threadId][neighbor] = currentRound[threadId];
						}
					});
				}
				assert(queue[threadId].empty());

				// the distances of the exit points are the weights
				for (index j = 0; j < cell.numExitPoints; ++j)
				{
					index exit = overlayGraph.getExitPoint(cell, j);
					curWeights[cell.cellOffset + i * cell.numExitPoints + j] = (round[threadId][exit] == currentRound[threadId]) ? dist[threadId][exit] : inf_weight;
				}

			}
		});
		}
	/// END BUILD REST

  return true;
}

} /* namespace CRP */