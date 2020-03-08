#!/bin/bash

if [ "$1" = "compile" ]
then
  scons --target="$2" --optimize=Opt -j4;
  scons --target="$2" --optimize=Opt;
elif [ "$1" = "precalc" ]
then
  ./deploy/precalculation $2/$3.graph $4 $2;
elif [ "$1" = "parse" ]
then
  ./deploy/osmparser $2/$3 $2/$3.graph;
elif [ "$1" = "customization" ]
then
  ./deploy/customization $2/$3.graph.preparsed $2/$3.overlay $2/metrics/ $4
elif [ "$1" = "querytest" ]
then
  ./deploy/querytest $2 $3/$4.graph.preparsed $3/$4.overlay $3/metrics/$5 $5
fi
