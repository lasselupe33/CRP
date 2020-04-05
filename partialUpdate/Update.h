#ifndef PARTIALUPDATE_UPDATE_H_
#define PARTIALUPDATE_UPDATE_H_

#include <vector>
#include <constants.h>

namespace CRP {

class Update {
public:
    Update() = default;
    Update(std::vector<std::pair<index, weight>>& updates) : updates(updates) {}

    std::vector<std::pair<index, weight>> updates;
};

} /* namespace CRP */

#endif /* PARTIALUPDATE_UPDATE_H_ */