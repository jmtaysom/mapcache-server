var L = require('leaflet');
var turf = require('turf');
var _ = require('underscore');
require('leaflet-draw');
var config = require('../../config');

module.exports = function LeafletCreateController($scope, $element, LocalStorageService, LeafletUtilities) {

  var options = {
    maxZoom: 18,
    tms: false,
    noWrap: true
  };

  var defaultLayer = config.defaultMapLayer;

  var baseLayer = L.tileLayer(defaultLayer, options);
  var sourceLayer;

  var map = L.map($element[0], {
    center: [0,0],
    zoom: 3,
    minZoom: 0,
    maxZoom: 18,
    worldCopyJump: true,
    maxBounds: L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180))
  });

  baseLayer.addTo(map);
  map.addControl(new L.Control.ZoomIndicator());

  var cacheFootprintLayer = null;

  var drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  var drawOptions = {
    draw: {
        polyline: false,
        polygon: false,
        circle: false, // Turns off this drawing tool
        rectangle: {
            shapeOptions: {
                clickable: false,
                color: "#0072c5"
            }
        },
        marker: false
    },
    edit: {
      featureGroup: drawnItems,
      remove: false,
      edit: {
        selectedPathOptions: {
          maintainColor: true,
          opacity: 0.5,
          dashArray:"10, 10"
        }
      }
    }
  };

  var drawControl = new L.Control.Draw(drawOptions);
  map.addControl(drawControl);

  map.on('draw:drawstart', function () {
    if (cacheFootprintLayer) {
      drawnItems.removeLayer(cacheFootprintLayer);
      cacheFootprintLayer = null;
      $scope.$apply(function() {
        $scope.$emit('draw:drawstart');
      });
    }
  });

  map.on('draw:created', function (e) {
    var layer = e.layer;
    cacheFootprintLayer = layer;

    drawnItems.addLayer(cacheFootprintLayer);
    $scope.$apply(function() {
      $scope.$emit('draw:created', cacheFootprintLayer.toGeoJSON().geometry);
    });
  });

  map.on('draw:edited', function (e) {
    var layer = e.layers.getLayers()[0];
    cacheFootprintLayer = layer;

    drawnItems.addLayer(cacheFootprintLayer);
    $scope.$apply(function() {
      $scope.$emit('draw:edited', cacheFootprintLayer.toGeoJSON().geometry);
    });
  });

  var debounceDataSources = _.debounce(function() {
    $scope.$apply(function() {
      addMapLayer();
    });
  }, 500);

  $scope.$watch('options.currentDatasources.length', function() {
    if ($scope.options.currentDatasources) {
      debounceDataSources();
    }
  });

  $scope.$watch('options.source.dataSources.length', function() {
    if ($scope.options.source.dataSources.length > 1) {

      _.each($scope.options.source.dataSources, function(ds) {
        var marker = L.marker([0,0],
        {
          opacity: 0.0,
          clickable: false,
          keyboard: false
        });
        marker.dataSource = ds;
        marker.addTo(map);
      });
    }
  });

  $scope.$on('extentChanged', function(event, envelope) {
    drawnItems.removeLayer(cacheFootprintLayer);
    cacheFootprintLayer = null;
    if (envelope) {
      var gj = turf.bboxPolygon([envelope.west, envelope.south, envelope.east, envelope.north]);
      $scope.options.geometry = gj.geometry;
      cacheFootprintLayer = L.rectangle([[envelope.south, envelope.west], [envelope.north, envelope.east]]);
      cacheFootprintLayer.setStyle({color: "#0072c5", clickable: false});
      drawnItems.addLayer(cacheFootprintLayer);
    }
  });

  $scope.$watch('options.extent', function(extent) {
    if (extent) {
      updateMapExtent(extent);
    }
  });

  function updateMapExtent(extent) {
    map.fitBounds([
      [extent[1],extent[0]],
      [extent[3], extent[2]]
    ]);
  }

  $scope.$watch('options.useCurrentView', function(newValue, oldValue) {
    if (!$scope.options.useCurrentView || oldValue === newValue) return;
    drawnItems.removeLayer(cacheFootprintLayer);
    cacheFootprintLayer = null;
    var bounds = map.getBounds();
    var gj = turf.bboxPolygon([Math.max(-180,bounds.getWest()), Math.max(-90,bounds.getSouth()), Math.min(180,bounds.getEast()), Math.min(90,bounds.getNorth())]);
    $scope.options.geometry = gj.geometry;
    cacheFootprintLayer = L.rectangle([bounds]);
    cacheFootprintLayer.setStyle({color: "#0072c5", clickable: false});
    drawnItems.addLayer(cacheFootprintLayer);
  });

  $scope.$watch('options.source', function() {
    if ($scope.options.source.dataSources) {
      $scope.options.currentDatasources = $scope.options.source.dataSources;
      var merged = _.reduce($scope.options.source.dataSources, function(merge, dataSource) {
        if (dataSource.geometry) {
          return turf.union(merge, dataSource.geometry);
        }
        return merge;
      }, $scope.options.source.dataSources[0].geometry);
      updateMapExtent(turf.extent(merged));
    }
    addMapLayer();
  });

  function addMapLayer() {
    if (sourceLayer) {
      map.removeLayer(sourceLayer);
    }
    sourceLayer = LeafletUtilities.tileLayer($scope.options.source, defaultLayer, options, $scope.options.style, styleFunction, $scope.options.currentDatasources);
    if (!sourceLayer) return;
    map.addLayer(sourceLayer);
  }

  function styleFunction(feature) {
    return LeafletUtilities.styleFunction(feature, $scope.options.style);
  }
};
