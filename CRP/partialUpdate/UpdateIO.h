
#ifndef PARTIALUPDATE_UPDATEIO_H_
#define PARTIALUPDATE_UPDATEIO_H_

#include "../datastructures/OverlayWeights.h"
#include "../constants.h"

#include <string>

namespace CRP {
    bool readUpdateFile(std::vector<std::pair<CRP::index, CRP::weight>> &update, const std::string &inputFilePath);
    bool updateWeights(std::vector<std::pair<CRP::index, CRP::weight>> &update, Graph &graph, const OverlayGraph &overlayGraph, std::vector<CRP::weight> &curWeights, const CostFunction &costFunction);
} /* namespace CRP */

void getAllArcsInCell(const CRP::OverlayGraph &overlayGraph, int cellNumber, std::string outputPath);
void getDiffArcsOnLevel(const CRP::OverlayGraph &overlayGraph, int level, std::string outputPath);

#endif /* PARTIALUPDATE_UPDATEIO_H_*/