#!/bin/bash

if [ "$1" = "compile" ]
then
  scons --target="$2" --optimize=Opt;
elif [ "$1" = "precalc" ]
then
  ./deploy/precalculation $2/$3.graph $4 $2;
elif [ "$1" = "parse" ]
then
  if [ "$6" ]
  then
  ./deploy/osmparser $2/$3 $2/$3.graph $4 $5/$3.graph $6;
  elif [ "$5" ]
  then
  ./deploy/osmparser $2/$3.graph $4 $5
  else
  ./deploy/osmparser $2/$3 $2/$3.graph;
  fi
elif [ "$1" = "customization" ]
then
  ./deploy/customization $2/$3.graph.preparsed $2/$3.overlay $2/metrics/ $4
elif [ "$1" = "querytest" ]
then
  ./deploy/querytest $2 $3/$4.graph.preparsed $3/$4.overlay $3/metrics/$5 $5
elif [ "$1" = "client" ]
then
  ./deploy/client $2/$3.graph.preparsed $2/$3.overlay $2/metrics/$4 $4
fi