
#ifndef PARTIALUPDATE_UPDATEIO_H_
#define PARTIALUPDATE_UPDATEIO_H_

#include "../datastructures/OverlayWeights.h"
#include "constants.h"

#include <string>

namespace CRP {

class UpdateIO {
public:
    static bool readUpdateFile(const std::vector<std::pair<CRP::index ,CRP::weight>> &update, const std::string &inputFilePath);
    static bool updateWeights(const std::vector<std::pair<CRP::index ,CRP::weight>> &update, const Graph &graph, const OverlayGraph &overlayGraph, const OverlayWeights &curWeights, CostFunction &costFunction);
};

} /* namespace CRP */

#endif /* PARTIALUPDATE_UPDATEIO_H_*/