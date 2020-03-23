/*
 * OSMParser.cpp
 *
 *  Created on: Dec 24, 2015
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

#include "OSMParser.h"

#include <iostream>
#include <vector>
#include <unordered_set>
#include <algorithm>
#include <numeric>

#include "GraphIO.h"

namespace CRP {

OSMParser::OSMParser() : currentWay(maxId), currentNode(maxId), validNode(true), inRelation(false) {
}

bool OSMParser::parseGraph(const std::string &graphFile, Graph &graph, int limit) {
	currentWay = std::numeric_limits<Id>::max();

	SaxParser xmlParser;
	std::cout << "Parsing file " << graphFile << std::endl;
	bool ok;

	nodeLimit = limit;

	if (graphFile.find(".bz") != std::string::npos) {
		ok = xmlParser.parseBZ2(graphFile, *this);
	} else {
		ok = xmlParser.parse(graphFile, *this);
	}

	if (ok) {
		std::cout << "SUCCESS" << std::endl;
		std::cout << "Parsed " << nodes.size() << " nodes and " << ways.size() << " ways." << std::endl;
		std::cout << "Building graph" << std::endl;
		buildGraph(graph);
		std::cout << "Done" << std::endl;
	} else {
		std::cout << "FAILED" << std::endl;
	}

	return ok;
}

void OSMParser::startElement(const std::string &uri, const std::string &localName, const std::string &qName, const std::vector<Attribute> &attributes) {
	if (qName == "node") {
		extractNode(attributes);
	} else if (qName == "way") {
		currentWay = maxId;
		for (Attribute a : attributes) {
			if (a.qName == "id") {
				currentWay = std::stoll(a.value);
				break;
			}
		}
		if (ways.find(currentWay) != ways.end()) {
			std::cout << "WARNING: " <<  currentWay << " already parsed" << std::endl;
			currentWay = maxId;
			return;
		} else {
			Way way = {std::vector<Id>(), 0, STREET_TYPE::INVALID, 0, false};
			ways.insert(std::make_pair(currentWay, way));
		}

	} else if (qName == "nd" && currentWay != maxId) {
		Id nodeId = maxId;
		for (Attribute a : attributes) {
			if (a.qName == "ref") {
				nodeId = std::stoll(a.value);
				break;
			}
		}

		if (nodeId != maxId && nodesStored < nodeLimit) {
			ways[currentWay].nodes.push_back(nodeId);
			nodesStored++;
		}
	} else if (qName == "tag" && inRelation) {
		parseRelationTag(attributes);
	} else if (qName == "tag" && currentWay != maxId) {
		parseWayTag(attributes);
	} else if (qName == "relation") {
		inRelation = true;
	} else if (qName == "member") {
		parseMember(attributes);
	}
}

void OSMParser::endElement(const std::string &uri, const std::string &localName, const std::string &qName) {
	if (qName == "node") {
		if (!validNode && currentNode != maxId) {
			nodes.erase(currentNode);
		}
		validNode = true;
		currentNode = maxId;
	} else if (qName == "way" && currentWay != maxId) {
		if (ways[currentWay].type == STREET_TYPE::INVALID) {
			nodesStored -= ways[currentWay].nodes.size();
			ways.erase(currentWay);
		}
		currentWay = maxId;
	} else if (qName == "relation") {
		if (currentRestriction.to != maxId && currentRestriction.via != maxId && currentWay != maxId && currentRestriction.turnRestriction != INVALID) {
			if (restrictions.find(currentWay) == restrictions.end()) {
				restrictions.insert(std::make_pair(currentWay, std::vector<Restriction>({currentRestriction})));
			} else {
				restrictions[currentWay].push_back(currentRestriction);
			}
		}
		inRelation = false;
		currentRestriction.to = maxId;
		currentRestriction.via = maxId;
		currentRestriction.turnRestriction = INVALID;
		currentWay = maxId;
	}
}

std::vector<Id> generateRandomEdge(int columns, int rows, int maxColMovement, int maxRowMovement) {
	int entryCol = rand() % columns;
	int entryRow = rand() % rows;

	int colMove = (rand() % (maxColMovement * 2)) - maxColMovement;
	int rowMove = (rand() % (maxRowMovement * 2)) - maxRowMovement;

	int maxMoveRight = columns - entryCol;
	int maxMoveLeft = entryCol;

	if (colMove > maxMoveRight || (colMove * -1) > maxMoveLeft)
	{
		colMove *= -1;
	}

	if (rowMove == 0 && colMove == 0)
	{
		rowMove += 1;
	}

	if (rowMove >= rows)
	{
		rowMove -= 2;
	}
	else if (rowMove < 0)
	{
		rowMove += 2;
	}

	Id entry = entryCol + entryRow * columns;
	Id exit = (entryCol + colMove) + (entryRow + rowMove) * columns;

	if (entry == exit)
	{
		bool atRightEdge = exit % (columns + 1) == columns;

		if (atRightEdge)
		{
			exit -= 1;
		}
		else
		{
			exit += 1;
		}
	}

	std::vector<Id> wayNodes;
	wayNodes.push_back(entry);
	wayNodes.push_back(exit);

	return wayNodes;
}

bool OSMParser::generateGraph(Graph &graph, int vertices, float avgDegree)
{
	float minLat = 50.0;
	float maxLat = 60.0;
	float minLon = 10.0;
	float maxLon = 20.0;

	int rows = ceil(sqrtf(vertices));
	int columns = ceil(sqrtf(vertices));
	int maxRowMovement = rows / cbrt(vertices);
	int maxColMovement = columns / cbrt(vertices);

	// Create the given amount of nodes, distributed with equal distance in a grid.
	int i = 0;
	for (int r = 0; r < rows; r++) {
		for (int c = 0; c < columns; c++) {
			if (i >= vertices) {
				break;
			}
			float lat = minLat + (maxLat - minLat) * ((float)c / (float)columns);
			float lon = minLon + (maxLon - minLon) * ((float)r / (float)rows);
			Node node = {lat, lon};
			nodes[i] = node;
			i++;
		}

		if (i >= vertices) {
			break;
		}
	}

	// Ensure that we at least have a fully connected graph, by creating roads
	// between all vertices, following this layout:
	//
	// x --- x --- x
	// 						 |
	// x --- x --- x
	// |
	// x --- x --- x
	for (int i = 0; i < vertices; i++) {
		bool evenRow = (i / rows) % 2 == 0;
		bool atRightEdge = i % (columns + 1) == columns;
		bool atLeftEdge = i % columns == 0;
		std::vector<Id> wayNodes;
		wayNodes.push_back(i);

		if (evenRow) {
			if (atRightEdge) {
				// Make a connection to node directly below in next row
				wayNodes.push_back(std::min(i + columns, vertices - 1));
			} else {
				wayNodes.push_back(i + 1 == vertices ? i - 1 : i + 1);
			}
		} else {
			if (atLeftEdge) {
				wayNodes.push_back(std::min(i + columns, vertices - 1));
			} else {
				wayNodes.push_back(i - 1);
			}
		}

		Way way = {wayNodes, 130, STREET_TYPE::MOTORWAY, 0, false};
		ways[i] = way;
	}

	// By now we've created a graph that has an average in/out-degree of 2 (with
	// the first and last vertex with an out-degree of 1).
	// Create additional edges, connecting nodes near to each other, until we've
	// reached the desired average in/out-degree
	for (int i = vertices; i < vertices + ((avgDegree - 2.0) * vertices / 2); i++) {
		std::vector<Id> wayNodes;
		
		while (true) {
			wayNodes = generateRandomEdge(columns, rows, maxColMovement, maxRowMovement);

			if (wayNodes[0] < vertices - 1 && wayNodes[1] < vertices - 1) {
				break;
			}
		}

		Way way = {wayNodes, 130, STREET_TYPE::MOTORWAY, 0, false};
		ways[i] = way;
	}

	buildGraph(graph);

	return true;
}

void OSMParser::buildGraph(Graph &graph) {
	std::unordered_map<Id, index> vertexMapping;
	index vIdx = 0;

	for (const std::pair<Id, Way> &wayPair : ways) {
		Way way = wayPair.second;
		for (const Id &node : way.nodes) {
			if (vertexMapping.find(node) == vertexMapping.end()) {
				vertexMapping.insert(std::make_pair(node, vIdx++));
			}
		}
	}

	std::vector<std::vector<ForwardEdge>> forwardEdges(vIdx);
	std::vector<std::unordered_set<index>> forwardNeighbors(vIdx);
	std::vector<std::vector<BackwardEdge>> backwardEdges(vIdx);

	std::vector<Vertex> vertices(vIdx+1, {0,0,0,0,{0,0}});

	std::vector<turnorder> inDegree(vertices.size()-1);
	std::vector<turnorder> outDegree(vertices.size()-1);

	for (std::pair<Id, Way> wayPair : ways) {
		Way way = wayPair.second;
		std::vector<Id> &wNodes = way.nodes;
		if (wNodes.size() == 0) continue;
		for (index i = 0; i < wNodes.size()-1; ++i) {
			while (i < wNodes.size()-1 && nodes.find(wNodes[i]) == nodes.end()) {
				std::cout << "WARNING: vertex " << wNodes[i] << " referenced in " << wayPair.first << " not present in file!" << std::endl;
				wNodes.erase(wNodes.begin() + i);
			}
			index u = vertexMapping.at(wNodes[i]);
			vertices[u].coord = {nodes[wNodes[i]].lat, nodes[wNodes[i]].lon};

			while (i < wNodes.size()-1 && nodes.find(wNodes[i+1]) == nodes.end()) {
				std::cout << "WARNING: vertex " << wNodes[i+1] << " referenced in " << wayPair.first << " not present in file!" << std::endl;
				wNodes.erase(wNodes.begin() + i+1);
			}
			if (vertexMapping.find(wNodes[i+1]) == vertexMapping.end()) break;

			index v = vertexMapping.at(wNodes[i+1]);
			if (u == v) continue;
			vertices[v].coord = {nodes[wNodes[i+1]].lat, nodes[wNodes[i+1]].lon};

			edgeAttr packedAttributes = ((weight) std::round(getDistance(nodes[wNodes[i]], nodes[wNodes[i+1]]))) << 12;
			packedAttributes |= ((edgeAttr) way.maxSpeed) << 4;
			packedAttributes |= ((edgeAttr) way.type);

			EdgeAttributes attributes = {packedAttributes, way.maxHeight};

			if (forwardNeighbors[u].find(v) == forwardNeighbors[u].end()) {
				forwardEdges[u].push_back({v, (turnorder) backwardEdges[v].size(), attributes});
				outDegree[u]++;
				forwardNeighbors[u].insert(v);
				backwardEdges[v].push_back({u, (turnorder) (forwardEdges[u].size()-1), attributes});
				inDegree[v]++;
			}

			if (!way.oneway) {
				if (forwardNeighbors[v].find(u) == forwardNeighbors[v].end()) {
					forwardEdges[v].push_back({u, (turnorder) backwardEdges[u].size(), attributes});
					outDegree[v]++;
					forwardNeighbors[v].insert(u);
					backwardEdges[u].push_back({v, (turnorder) (forwardEdges[v].size()-1), attributes});
					inDegree[u]++;
				}
			}
		}
	}

	// clear forwardNeighbors to save memory
	forwardNeighbors.clear();

	std::vector<std::vector<Graph::TURN_TYPE>> turnMatrices(vertices.size()-1);

	for (index i = 0; i < turnMatrices.size(); ++i) {
		if (inDegree[i] == 0 || outDegree[i] == 0) {
			std::cout << "WARNING: Vertex i has indegree " << (index) inDegree[i] << " and outDegree " << (index) outDegree[i] << " , "<< vertices[i].coord.lat << " " << vertices[i].coord.lon << std::endl;
		}
		assert(inDegree[i] == backwardEdges[i].size());
		assert(outDegree[i] == forwardEdges[i].size());
		turnMatrices[i] = std::vector<Graph::TURN_TYPE>(inDegree[i]*outDegree[i], Graph::NONE);
	}

	std::cout << "Found " << restrictions.size() << " restrictions" << std::endl;
	for (std::pair<Id, Way> wayPair : ways) {
		if (!wayPair.second.oneway && wayPair.second.nodes.size() > 1) { // allow no u_turns at (u,v) -> (v,u)
			std::vector<Id> &wayNodes = wayPair.second.nodes;
			for (index i = 0; i < wayNodes.size(); ++i) {
				if (nodes.find(wayNodes[i]) == nodes.end()) continue;
				index via = vertexMapping[wayNodes[i]];
				if (inDegree[via] == 1 && outDegree[via] == 1) continue;
				if (i == 0 && nodes.find(wayNodes[1]) != nodes.end()) {					
					index to = vertexMapping[wayNodes[1]];
					if (to == via) continue;
					index entryId = invalid_id;
					index exitId = invalid_id;
					for (index k = 0; k < forwardEdges[via].size(); ++k) {
						if (forwardEdges[via][k].head == to) {
							exitId = k;
							break;
						}
					}
					if (exitId == invalid_id) {
						std::cout << "Found no exitId for " << via << ", " << to << std::endl;
					}
					assert(exitId != invalid_id);

					for (index k = 0; k < backwardEdges[via].size(); ++k) {
						if (backwardEdges[via][k].tail == to) {
							entryId = k;
							break;
						}
					}
					assert(entryId != invalid_id);
					turnMatrices[via][entryId * outDegree[via] + exitId] = Graph::U_TURN;
				} else if (i < wayNodes.size()-1) {
					// backward
					if (nodes.find(wayNodes[i-1]) != nodes.end()) {
						index to = vertexMapping[wayNodes[i-1]];
						if (to == via) continue;
						index entryId = invalid_id;
						index exitId = invalid_id;
						for (index k = 0; k < forwardEdges[via].size(); ++k) {
							if (forwardEdges[via][k].head == to) {
								exitId = k;
								break;
							}
						}
						assert(exitId != invalid_id);
						for (index k = 0; k < backwardEdges[via].size(); ++k) {
							if (backwardEdges[via][k].tail == to) {
								entryId = k;
								break;
							}
						}

						assert(entryId != invalid_id);
						turnMatrices[via][entryId * outDegree[via] + exitId] = Graph::U_TURN;
					}

					if (nodes.find(wayNodes[i+1]) != nodes.end()) {
						// forward
						index to = vertexMapping[wayNodes[i+1]];
						if (to == via) continue;
						index entryId = invalid_id;
						index exitId = invalid_id;
						for (index k = 0; k < forwardEdges[via].size(); ++k) {
							if (forwardEdges[via][k].head == to) {
								exitId = k;
								break;
							}
						}
						assert(exitId != invalid_id);
						for (index k = 0; k < backwardEdges[via].size(); ++k) {
							if (backwardEdges[via][k].tail == to) {
								entryId = k;
								break;
							}
						}

						assert(entryId != invalid_id);
						turnMatrices[via][entryId * outDegree[via] + exitId] = Graph::U_TURN;
					}

				} else {
					if (nodes.find(wayNodes[i-1]) == nodes.end()) continue;
					index to = vertexMapping[wayNodes[i-1]];
					if (to == via) continue;
					index entryId = invalid_id;
					index exitId = invalid_id;
					for (index k = 0; k < forwardEdges[via].size(); ++k) {
						if (forwardEdges[via][k].head == to) {
							exitId = k;
							break;
						}
					}
					assert(exitId != invalid_id);
					for (index k = 0; k < backwardEdges[via].size(); ++k) {
						if (backwardEdges[via][k].tail == to) {
							entryId = k;
							break;
						}
					}

					assert(entryId != invalid_id);
					turnMatrices[via][entryId * outDegree[via] + exitId] = Graph::U_TURN;
				}
			}
		}


		if (restrictions.find(wayPair.first) == restrictions.end()) continue;
		std::vector<Restriction> &fromRestrictions = restrictions[wayPair.first];

		std::vector<Id> &fromNodes = wayPair.second.nodes;
		for (const Restriction &r : fromRestrictions) {
			if (wayPair.first == r.to || vertexMapping.find(r.via) == vertexMapping.end()) continue; // ignore restrictions that have from == to
			if (ways.find(r.to) == ways.end()) continue; // r.to is not known
			assert(ways.find(r.to) != ways.end());
			for (index i = 0; i < fromNodes.size(); ++i) {
				if (fromNodes[i] == r.via) {
					if (i == 0 && wayPair.second.oneway) continue; // there is no predecessor
					Id predecessor = i == 0? fromNodes[i+1] : fromNodes[i-1];
					if (predecessor == r.via) continue;
					Id successor = maxId;
					std::vector<Id> &toNodes = ways[r.to].nodes;
					for (index j = 0; j < toNodes.size()-1; ++j) {
						if (j == toNodes.size()-1 && wayPair.second.oneway) break;
						if (toNodes[j] == r.via) {
							successor = j == toNodes.size()-1? toNodes[j-1] : toNodes[j+1];
							break; // do not search any further in toNodes (since we found the successor)
						}
					}

					if (successor != maxId && successor != r.via) {
						assert(vertexMapping.find(predecessor) != vertexMapping.end());
						index from = vertexMapping[predecessor];
						index via = vertexMapping[r.via];
						assert(vertexMapping.find(successor) != vertexMapping.end());
						index to = vertexMapping[successor];

						assert(from < vIdx && via < vIdx && to < vIdx);

						index entryId = invalid_id;
						index exitId = invalid_id;
						for (index k = 0; k < backwardEdges[via].size(); ++k) {
							if (backwardEdges[via][k].tail == from) {
								entryId = k;
								break;
							}
						}
						
						if (entryId == invalid_id) continue; // something went wrong and we can't find the backwardEdge. Maybe the way is oneway and from and to are interchanged.
						assert(entryId != invalid_id);
						index rowOffset = entryId * outDegree[via];
						for (index k = 0; k < forwardEdges[via].size(); ++k) {
							if (forwardEdges[via][k].head == to) {
								exitId = k;
							}
							if (r.turnRestriction == ONLY_LEFT_TURN || r.turnRestriction == ONLY_RIGHT_TURN || r.turnRestriction == ONLY_STRAIGHT_ON) {
								turnMatrices[via][rowOffset + k] = Graph::NO_ENTRY;
							}
						}

						if (exitId == invalid_id) continue; // something went wrong and we can't find the forwardEdge. Maybe the way is oneway and from and to are interchanged.
						
						assert(exitId != invalid_id);
						if (rowOffset + exitId >= turnMatrices[via].size()) {
							std::cout << (index) inDegree[via] << ", " << (index) outDegree[via] << " ," << entryId << ", " << exitId << std::endl;
							continue;
						}
						assert(rowOffset + exitId < turnMatrices[via].size());
						switch (r.turnRestriction) {
							case NO_LEFT_TURN:
								turnMatrices[via][rowOffset + exitId] = Graph::NO_ENTRY;
								break;
							case NO_RIGHT_TURN:
								turnMatrices[via][rowOffset + exitId] = Graph::NO_ENTRY;
								break;
							case NO_STRAIGHT_ON:
								turnMatrices[via][rowOffset + exitId] = Graph::NO_ENTRY;
								break;
							case NO_U_TURN:
								turnMatrices[via][rowOffset + exitId] = Graph::NO_ENTRY;
								break;
							case NO_ENTRY:
								turnMatrices[via][rowOffset + exitId] = Graph::NO_ENTRY;
								break;
							case ONLY_LEFT_TURN:
								turnMatrices[via][rowOffset + exitId] = Graph::LEFT_TURN;
								break;
							case ONLY_RIGHT_TURN:
								turnMatrices[via][rowOffset + exitId] = Graph::RIGHT_TURN;
								break;
							case ONLY_STRAIGHT_ON:
								turnMatrices[via][rowOffset + exitId] = Graph::STRAIGHT_ON;
								break;
							default:
								turnMatrices[via][rowOffset + exitId] = Graph::NONE;
								break;
						}
					}
					break; // do not search further in fromNodes
				}
			}
		}
	}

	// clear ways, nodes and vertexMapping to save memory
	nodes.clear();
	ways.clear();
	vertexMapping.clear();
	restrictions.clear();

	std::cout << "Done parsing restrictions" << std::endl;
	std::cout << "Sorting and hashing matrices" << std::endl;

	std::unordered_map<std::vector<Graph::TURN_TYPE>, index, VectorHasher> matrixMap;
	std::vector<Graph::TURN_TYPE> matrices;
	index matrixOffset = 0;

	for (index v = 0; v < vertices.size()-1; ++v) {
		// Sort matrix s.t. rows with Turn_Types != NONE are listed last
		std::vector<index> rowScore(inDegree[v], 0);
		std::vector<uint64_t> turnTypeRanking(inDegree[v], 0);
		for (index i = 0; i < inDegree[v]; ++i) {
			for (index j = i * outDegree[v]; j < (i+1)*outDegree[v]; ++j) {
 				rowScore[i] += turnMatrices[v][j] != Graph::NONE;
				uint64_t count = (turnTypeRanking[i] << (64 - 8*(turnMatrices[v][j]+1))) >> 56;
				count++;
				turnTypeRanking[i] = (turnTypeRanking[i] & ~((uint64_t) 255 << 8*turnMatrices[v][j])) | (count << 8 * turnMatrices[v][j]);
			}
		}

		std::vector<index> sortOrder(inDegree[v]);
		std::iota(sortOrder.begin(), sortOrder.end(), 0);
		std::sort(sortOrder.begin(), sortOrder.end(), [&](const index i, const index j) {
			if (rowScore[i] > rowScore[j]) {
				return true;
			} else if (rowScore[i] < rowScore[j]) {
				return false;
			} else if (turnTypeRanking[i] <= turnTypeRanking[j]) {
				return true;
			} else {
				return false;
			}
		});

		std::vector<Graph::TURN_TYPE> sortedMatrix(inDegree[v] * outDegree[v], Graph::NONE);
		std::vector<BackwardEdge> sortedBackwardEdges(backwardEdges[v].size());
		for (index i = 0; i < inDegree[v]; ++i) {
			index k = i * outDegree[v];
			for (index j = sortOrder[i] * outDegree[v]; j < (sortOrder[i]+1) * outDegree[v]; ++j, ++k) {
				assert(k < sortedMatrix.size() && j < turnMatrices[v].size());
				sortedMatrix[k] = turnMatrices[v][j];
			}
			sortedBackwardEdges[i] = backwardEdges[v][sortOrder[i]];
			for (ForwardEdge &e : forwardEdges[backwardEdges[v][sortOrder[i]].tail]) {
				if (e.head == v) {
					e.entryPoint = i;
					break;
				}
			}
		}

		turnMatrices[v] = sortedMatrix;
		backwardEdges[v] = sortedBackwardEdges;

		std::vector<index> columnScore(outDegree[v], 0);
		turnTypeRanking = std::vector<uint64_t>(outDegree[v], 0);
		for (index j = 0; j < outDegree[v]; ++j) {
			for (index i = 0; i < inDegree[v]; ++i) {
				index offset = i * outDegree[v] + j;
				if (turnMatrices[v][offset] != Graph::NONE) {
					columnScore[j] |= ((index) 1 << i);
				}

				uint64_t count = (turnTypeRanking[j] << (64 - 8*(turnMatrices[v][offset]+1))) >> 56;
				count++;
				turnTypeRanking[j] = (turnTypeRanking[j] & ~((uint64_t) 255 << 8*turnMatrices[v][offset])) | (count << 8 * turnMatrices[v][offset]);
			}
		}

		sortOrder = std::vector<index>(outDegree[v]);
		std::iota(sortOrder.begin(), sortOrder.end(), 0);

		std::sort(sortOrder.begin(), sortOrder.end(), [&](const index i, const index j) {
			index firstDifferent = columnScore[i] ^ columnScore[j];
			for (index k = 0; k < outDegree[v]; ++k) {
				if (firstDifferent & (1 << k)) {
					if (columnScore[i] & (1 << k)) {
						return true;
					}
					return false;
				}
			}

			if (turnTypeRanking[i] <= turnTypeRanking[j]) {
				return true;
			}
			return false;
		});


		sortedMatrix = std::vector<Graph::TURN_TYPE>(inDegree[v] * outDegree[v], Graph::NONE);
		std::vector<ForwardEdge> sortedForwardEdges(forwardEdges[v].size());
		for (index j = 0; j < outDegree[v]; ++j) {
			for (index i = 0; i < inDegree[v]; ++i) {
				sortedMatrix[j + i * outDegree[v]] = turnMatrices[v][sortOrder[j] + i * outDegree[v]];
			}

			sortedForwardEdges[j] = forwardEdges[v][sortOrder[j]];
			for (BackwardEdge &e : backwardEdges[forwardEdges[v][sortOrder[j]].head]) {
				if (e.tail == v) {
					e.exitPoint = j;
					break;
				}
			}
		}

		turnMatrices[v] = sortedMatrix;
		forwardEdges[v] = sortedForwardEdges;

		auto it = matrixMap.find(turnMatrices[v]);
		if (it != matrixMap.end()) {
			vertices[v].turnTablePtr = it->second;
		} else {
			vertices[v].turnTablePtr = matrixOffset;
			matrixMap.insert(std::make_pair(turnMatrices[v], matrixOffset));
			for (index i = 0; i < turnMatrices[v].size(); ++i) {
				matrices.push_back(turnMatrices[v][i]);
			}
			matrixOffset += turnMatrices[v].size();
		}
	}

	std::cout << "We have " << vertices.size()-1 << " vertices." << std::endl;
	std::cout << "Found " << matrixMap.size() << " turn tables." << std::endl;

	// clear turnMatrices and matrixMap to save space
	turnMatrices.clear();
	turnMatrices.shrink_to_fit();
	matrixMap.clear();

	std::vector<ForwardEdge> flatForwardEdges = flatten(forwardEdges);
	std::vector<BackwardEdge> flatBackwardEdges = flatten(backwardEdges);

	count forwardOffset = 0;
	count backwardOffset = 0;
	for (index i = 0; i < vIdx; ++i) {
		vertices[i] = {0, vertices[i].turnTablePtr, forwardOffset, backwardOffset, vertices[i].coord};
		forwardOffset += forwardEdges[i].size();
		backwardOffset += backwardEdges[i].size();
	}
	vertices[vIdx] = {0,0,(index) flatForwardEdges.size(), (index) flatBackwardEdges.size(), {0, 0}};

	// clear forward and backward edges to save memory
	forwardEdges.clear();
	forwardEdges.shrink_to_fit();
	backwardEdges.clear();
	backwardEdges.shrink_to_fit();

	graph = Graph(vertices, flatForwardEdges, flatBackwardEdges, matrices);
}


} /* namespace CRP */

int main(int argc, char* argv[]) {
	if (argc != 3 && argc != 4 && argc != 6) {
		std::cout << "Usage: " << argv[0] << " path_to_osm.bz2 path_to_output.graph.bz2" << std::endl;
		std::cout << "Or: " << argv[0] << " path_to_osm.bz2 path_to_output.graph.bz2 limit outputPath baseVertices" << std::endl;
		std::cout << "Or: " << argv[0] << " path_to_output.graph.bz2 vertices avgOutDegree" << std::endl;
		return 1;
	}

	std::string input(argv[1]);
	std::string graphOutput(argc == 6 ? argv[4] : argc == 4 ? argv[1] : argv[2]);
	int limit = argc == 6 ? std::stoi(argv[3]) : INFINITY;
	int baseVertices = argc == 6 ? std::stoi(argv[5]) : -1;
	int desiredVertices = argc == 4 ? std::stoi(argv[2]) : -1;
	float avgOutDegree = argc == 4 ? std::stof(argv[3]) : -1;

	std::string metisGraphFile = graphOutput.substr(0, graphOutput.find_last_of(".")) + ".metis.graph";
	bool ok;
	CRP::Graph graph;
	CRP::OSMParser osmParser;

	// In case 3 or 6 arguments we're passed, that means we should work on an
	// actual OSM graph and either generate a full graph or a subgrah
	if (argc == 3 || argc == 6) {
		if (limit != inf_weight && baseVertices != -1)
		{
			double factor = 0.075 + (double)limit / baseVertices * 0.2325;
			limit = limit * (1 + factor);
		}

		ok = osmParser.parseGraph(input, graph, limit);
	} else {
		// In the case of 4 arguments, then we should create our own graph.
		ok = osmParser.generateGraph(graph, desiredVertices, avgOutDegree);
	}

	if (ok)
	{
		ok = CRP::GraphIO::writeGraph(graph, graphOutput);
		CRP::GraphIO::writeMetisGraph(graph, metisGraphFile);
	}

	if (!ok)
	{
		CRP::GraphIO::writeGraph(graph, "/Users/lasse.felskov/Code/SWU/Bachelor/data/test/map.osm.graph");
		CRP::GraphIO::writeMetisGraph(graph, "/Users/lasse.felskov/Code/SWU/Bachelor/data/test/map.osm.metis.graph");
		std::cout << "An error occured during parsing" << std::endl;
	}

	return 0;
}
