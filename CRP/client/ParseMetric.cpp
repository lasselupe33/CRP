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

void parseMetric(string metricPath, string metricType, CRP::Metric& target)
{
  cout << "Updating metric" << endl;
  long long start = get_micro_time();

  if (metricType == "dist")
  {
    std::ifstream stream(metricPath);
    CRP::Metric::read(stream, target, std::unique_ptr<CRP::CostFunction>(new CRP::DistanceFunction()));
    stream.close();
  }
  else if (metricType == "hop")
  {
    std::ifstream stream(metricPath);
    CRP::Metric::read(stream, target, std::unique_ptr<CRP::CostFunction>(new CRP::HopFunction()));
    stream.close();
  }
  else if (metricType == "time")
  {
    std::ifstream stream(metricPath);
    CRP::Metric::read(stream, target, std::unique_ptr<CRP::CostFunction>(new CRP::TimeFunction()));
    stream.close();
  }
  else
  {
    std::cout << "ERROR: Unknown metic type " << metricType << std::endl;
  }

  long long end = get_micro_time();

  std::cout << std::setprecision(3);
  std::cout << "Metric update took " << ((end - start) / 1000) << " ms." << std::endl;
  std::cout << std::setprecision(16);
}