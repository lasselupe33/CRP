# Customizable Route Planning on mobile phones

## Our contributions

Our implementation is based on the CRP implementation made by Michael Wegner. <a href="https://github.com/michaelwegner/CRP">Link to repository</a>

We have implemented a test-suite allowing us to perform the experiments made in chapter 6 of the report related to this thesis. This work is found in the `src`-folder and in `CRP/client`, including minor alterations to other source code of the core CRP implementation. Please refer to the commit history to review these.

The test suite allows us to simulate a Client (A mobile phone) running the queries and updating metric weights, and a Server which does preprocessing and pushing it to the Client.

Furthermore we have implemented the possibility for the Client to update only parts of its weight. This is done to improve performance in the scenario where new weights are published only to parts of an already loaded map in the Client.

## Layout

* The `src`-folder includes all source code that wraps the C++ CRP implementation. This is done to mimick a real life situation where the C++ code also would need to be wrapped in either Kotlin/Java or ObjectiveC/Swift in order to be executable on mobile phones. It has been written in TypeScript due to developer familiarity.

* The `experiments`-folder contains results from experiments performed.

* The `data`-folder should include relevant maps. Supported maps are OSM maps with either to '.osm' or the '.bz2' extension.

* The `CRP`-folder includes the Customizable Route Planning algorithm, written in C++, while the `partialUpdate`-folder includes the source code to our incremental updating.

## Prerequisites

In order to be able to execute the code in this repository, then a couple of prerequisites have to be met.

NB: The following recommendations assumes that the project is being set up on a **Linux** machine.

The following programs should be installed

* <a href="https://nodejs.org/en/">NodeJS</a>
* <a href="https://yarnpkg.com/">Yarn</a>
* <a href="https://scons.org/">SCons</a>
* <a href="http://www.boost.org">Boost C++ Library</a>
* <a href="https://gcc.gnu.org">g++</a>

At least one partitioner should be installed, make sure to have its dependencies installed on your machine as well. It must be one of the following:

* METIS. Must be located in the folder `metis-5.1.0`
* KaFFPa. Must be located in the folder `KaHIP`
* Buffoon. Must be located in the folder `KaHIP_Buffoon/src`

Finally you should include some map data to use with the experiments. It is at least recommended that you have the following:

* <a href="https://download.bbbike.org/osm/bbbike/Copenhagen/Copenhagen.osm.gz">Copenhagen</a>. Located in the folder `data/cph`. NB: Must be decompressed.
* <a href="https://download.geofabrik.de/europe/denmark-latest.osm.bz2">Denmark</a>. Located in the folder `data/denmark`

## Setup

Once all prerequisites have been setup, then the following steps should be followed in order to be able to run the experiments:

* Rename `CRP/run.example.sh` -> `CRP/run.sh`
* Rename `CRP/SConstruct.example` -> `CRP/SConstruct`
* Run the command `cd CRP && sh run.sh compile CRP && sh run.sh compile Client && cd ..`
* Run the command `yarn build`

You should now be able to run the experiments below!

## Parameters

The experimental suite takes the following parameters:

* `--folder=<string>`: name of a folder inside the data-directory, wherein files will be used by the CRP algorithm.
* `--experiment=<string>`: the experiment to perform
* `--testAmount=<int>`: the amount of times to run the query algorithm
* `--partitioner=<metis|kaffpa|buffon>`: Specifies the partitioner to use for a given experiment
* `--pconfig=<strong|eco|fast>`: Specifies the configuration to use for the given partitioner

## Experiments

A variety of experiments can be conducted. If you want to simply enter the client with a given map the following command can be run:

`yarn client --folder=<string>`

In case you want to simply precompile a specific map (i.e. run partitioner, preprocessing and customization) the following command can be run:

`yarn cli --folder=<string>`

### Visualize

In case you want to visualize the results of the algorithm run on a given map the following command can be run:

NB: The preprocessing and customization phase of the given map must have been completed beforehand!

`yarn client --folder=<string> --experiment=visualise --testAmount=<int>`

### Partition

In order to conduct the partitioner experiment, then you must have all partitioners listed in the prerequsites section installed.

`yarn client --folder=denmark --experiment=partitions --testAmount=<int>`

### Overlay graph layout

`yarn client --folder=denmark --experiment=overlay --testAmount=20000 --partitioner=metis--pconfig=strong`

### Scaling test

`yarn client --experiment=scale --partitioner=<string> --pconfig=<string> --testAmount=<int>`