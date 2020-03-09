
#include "UpdateIO.h"
#include "GraphIO.h"

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

#include "../constants.h"
#include "../datastructures/LevelInfo.h"
#include "vector_io.h"
#include "OSMParser.h"

namespace CRP{

// the update file is expected to have no header/meta information in the top and consist only of the ID of the arc followed by the new weight
// example of line in file: "234 97479"
bool readUpdateFile(Update &update, const std::string &inputFilePath) {
    std::ifstream file(inputFilePath, std::ios_base::in | std::ios_base::binary);
    if (!file.is_open()) return false;

    boost::iostreams::filtering_streambuf<boost::iostreams::input> inbuf;
    inbuf.push(file);

    std::string line;
    std::istream instream(&inbuf);
    std::vector<std::string> tokens;

    if(file.eof()) return false;
    
    std::pair<index,weight> singleUpdate;
    std::vector<std::pair<index, weight>> updates;
    while(!file.eof()){
        std::getline(instream, line);
        tokens = CRP::GraphIO::splitString(line, ' ');
        assert(tokens.size() == 2);
        singleUpdate.first = CRP::GraphIO::stoui(tokens[0]);
        singleUpdate.second = std::stoul(tokens[1]);
        updates.push_back(singleUpdate);
    }
    
    update = Update(updates);

    return true;
}

bool writeUpdatedWeights(const Update &update, const OverlayWeights &curWeights, const std::string &outputFilePath) {
    //TODO: this - unless?
    return true;
}

} /* namespace CRP */