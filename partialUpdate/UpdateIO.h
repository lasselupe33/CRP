
#ifndef PARTIALUPDATE_UPDATEIO_H_
#define PARTIALUPDATE_UPDATEIO_H_

#include "../datastructures/OverlayWeights.h"

#include <Update.h>
#include <string>

namespace CRP {

class UpdateIO {
public:
    static bool readUpdateFile(Update &update, const std::string &inputFilePath);
    static bool writeUpdatedWeights(const Update &update, const OverlayWeights &curWeights, const std::string &outputFilePath);
};

} /* namespace CRP */

#endif /* PARTIALUPDATE_UPDATEIO_H_*/