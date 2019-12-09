/**
 * Created by Jean on 2019-10-09.
 */

var Layers = {
  itemMarkersLayer: new L.LayerGroup(),
  miscLayer: new L.LayerGroup(),
  encountersLayer: new L.LayerGroup()
};

var MapBase = {
  minZoom: 2,
  maxZoom: 7,
  map: null,

  init: function () {
    var southWestTiles = L.latLng(-144, 0),
      northEastTiles = L.latLng(0, 176),
      boundsTiles = L.latLngBounds(southWestTiles, northEastTiles);

    var mapLayers = [];
    mapLayers['Default'] = L.tileLayer('https://s.rsg.sc/sc/images/games/RDR2/map/game/{z}/{x}/{y}.jpg', {
      noWrap: true,
      bounds: boundsTiles
    });
    mapLayers['Detailed'] = L.tileLayer('assets/maps/detailed/{z}/{x}_{y}.jpg', {
      noWrap: true,
      bounds: boundsTiles
    });
    mapLayers['Dark'] = L.tileLayer('assets/maps/darkmode/{z}/{x}_{y}.jpg', {
      noWrap: true,
      bounds: boundsTiles
    });

    MapBase.map = L.map('map', {
      preferCanvas: true,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      zoomControl: false,
      crs: L.CRS.Simple,
      layers: [mapLayers[$.cookie('map-layer')]]
    }).setView([-70, 111.75], 3);

    var baseMapsLayers = {
      "Default": mapLayers['Default'],
      "Detailed": mapLayers['Detailed'],
      "Dark": mapLayers['Dark']
    };

    L.control.zoom({
      position: 'bottomright'
    }).addTo(MapBase.map);

    L.control.layers(baseMapsLayers).addTo(MapBase.map);

    MapBase.map.on('click', function (e) {
      MapBase.addCoordsOnMap(e);
    });

    MapBase.map.on('baselayerchange', function (e) {
      setMapBackground(e.name);
    });

    var southWest = L.latLng(-170.712, -25.227),
      northEast = L.latLng(10.774, 200.125),
      bounds = L.latLngBounds(southWest, northEast);
    MapBase.map.setMaxBounds(bounds);
  },

  loadMarkers: function () {
    $.getJSON('data/items_bili.json?nocache=' + nocache)
      .done(function (data) {
        MapBase.setMarkers(data);
      });
  },

  setMarkers: function (data) {
    $.each(data, function (_category, _markers) {
      $.each(_markers, function (key, marker) {
        markers.push(new Marker(marker.text, marker.x, marker.y, marker.tool, marker.day, _category, marker.subdata, marker.video, marker.time_point, true));
      });
    });
    uniqueSearchMarkers = markers;
    MapBase.addMarkers(true);
  },

  onSearch: function () {
    if (searchTerms.length == 0) {
      uniqueSearchMarkers = markers;
    } else {
      Layers.itemMarkersLayer.clearLayers();
      var searchMarkers = [];
      uniqueSearchMarkers = [];
      $.each(searchTerms, function (id, term) {

        searchMarkers = searchMarkers.concat(markers.filter(function (_marker) {
          return _marker.title.toLowerCase().includes(term.toLowerCase())
        }));

        $.each(searchMarkers, function (i, el) {
          if ($.inArray(el, uniqueSearchMarkers) === -1) uniqueSearchMarkers.push(el);
        });
      });

    }

    MapBase.addMarkers();

    if ($("#routes").val() == 1)
      Routes.drawLines();
  },

  addMarkers: function (refreshMenu = false) {

    if (Layers.itemMarkersLayer != null)
      Layers.itemMarkersLayer.clearLayers();
    if (Layers.miscLayer != null)
      Layers.miscLayer.clearLayers();

    $.each(markers, function (key, marker) {
      //Set isVisible to false. addMarkerOnMap will set to true if needs
      marker.isVisible = false;
      //marker.isCollected = collectedItems.includes(marker.text);

      if (marker.subdata != null)
        if (categoriesDisabledByDefault.includes(marker.subdata))
          return;

      MapBase.addMarkerOnMap(marker);
    });

    Layers.itemMarkersLayer.addTo(MapBase.map);

    MapBase.addFastTravelMarker(!refreshMenu);
    MapBase.addMadamNazar(refreshMenu);

    Menu.refreshItemsCounter();
    Treasures.addToMap();
    CondorEgg.addToMap();
    Encounters.addToMap();

    if (refreshMenu)
      Menu.refreshMenu();

  },

  loadWeeklySet: function () {
    $.getJSON('data/weekly.json?nocache=' + nocache)
      .done(function (data) {
        weeklySetData = data[weeklySet];
      });
  },

  removeItemFromMap: function (itemName, category) {
    if (itemName.endsWith('_treasure')) {
      if (inventory[itemName]) {
        delete inventory[itemName];
      } else {
        inventory[itemName] = {
          'isCollected': '1',
          'amount': 0
        };
      }
      $(`[data-type=${itemName}]`).toggleClass('disabled');
      MapBase.addMarkers();
    } else {
      var _marker = markers.filter(function (marker) {
        return (marker.text == itemName || (marker.subdata == category)) && (marker.day == day || marker.day.includes(day));
      });

      if (_marker == null)
        return;

      var isDisabled = $(`p.collectible[data-type=${category}]`).hasClass('disabled');
      $.each(_marker, function (key, marker) {

        if (marker.text != itemName && (marker.subdata != category || (_marker.length > 1 && itemName != category)))
          return;

        if (itemName == category && marker.subdata == category) {
          if (!isDisabled) {
            MapBase.changeMarkerAmount(marker.subdata || marker.text, 1);
            $('[data-marker=' + marker.text + ']').css('opacity', '.35');
            $(`[data-type=${marker.subdata || marker.text}]`).addClass('disabled');
            marker.canCollect = false;
            marker.isCollected = true;
          }
          else {
            MapBase.changeMarkerAmount(marker.subdata || marker.text, -1);
            $('[data-marker=' + marker.text + ']').css('opacity', '1');
            $(`[data-type=${marker.subdata}]`).removeClass('disabled');
            marker.canCollect = true;
            marker.isCollected = false;
          }
        }
        else {
          marker.isCollected = !marker.isCollected && marker.amount < 10;
          marker.canCollect = marker.amount < 10 && marker.isCollected;
          if (marker.canCollect) {
            MapBase.changeMarkerAmount(marker.subdata || marker.text, 1);
            $('[data-marker=' + marker.text + ']').css('opacity', '.35');
            $(`[data-type=${marker.subdata || marker.text}]`).addClass('disabled');
            marker.canCollect = false;
          } else {
            MapBase.changeMarkerAmount(marker.subdata || marker.text, -1);
            $('[data-marker=' + marker.text + ']').css('opacity', '1');
            $(`[data-type=${marker.subdata || marker.text}]`).removeClass('disabled');
            marker.canCollect = true;
          }
        }
      });
    }
    if ($("#routes").val() == 1)
      Routes.drawLines();

    Menu.refreshItemsCounter();
    MapBase.save();
  },

  changeMarkerAmount: function (name, amount) {
    var marker = markers.filter(_m => {
      return (_m.text == name || _m.subdata == name) && (_m.day == day || _m.day.includes(day));
    });

    $.each(marker, function (key, _m) {

      _m.amount = parseInt(_m.amount) + amount;
      if (_m.amount > 9)
        _m.amount = 10;
      if (_m.amount < 0)
        _m.amount = 0;

      if (_m.amount > 9) {
        $('[data-marker=' + _m.text + ']').css('opacity', '.35');
        $(`[data-type=${_m.text}]`).addClass('disabled');
      } else if (!_m.isCollected) {
        $('[data-marker=' + _m.text + ']').css('opacity', '1');
        $(`[data-type=${_m.text}]`).removeClass('disabled');
      }

      $(`small[data-item=${name}]`).text(_m.amount);
      $(`p.collectible[data-type=${name}] > small`).text(_m.amount);

      //If the category is disabled, no needs to update popup
      if (Layers.itemMarkersLayer.getLayerById(_m.text) != null)
        Layers.itemMarkersLayer.getLayerById(_m.text)._popup.setContent(MapBase.updateMarkerContent(_m));

    });
    //Layers.itemMarkersLayer.removeLayer(Layers.itemMarkersLayer.getLayerById(marker.text));
    //MapBase.addMarkerOnMap(marker);
    if ($("#routes").val() == 1)
      Routes.drawLines();
    MapBase.save();
  },


  getIconColor: function (value) {
    switch (value) {
      case "day_1":
        return "blue";
        break;
      case "day_2":
        return "orange";
        break;
      case "day_3":
        return "purple";
        break;
      case "weekly":
        return "green";
        break;
    }
  },


  updateMarkerContent: function (marker) {
    var videoText = marker.video != null ? '<p align="center" style="padding: 5px;"><a href="' + marker.video + '" target="_blank">B站视频</a> ' + marker.time_point + '</p>' : '';
    var popupTitle = `${marker.title} - ${Language.get("menu.day")} ${day}`;
    var popupContent = (marker.category == 'random') ? 'Random items resets 24 hours after picking up' : marker.description;
    var buttons = (marker.category == 'random') ? '' : `<div class="marker-popup-buttons">
    <button class="btn btn-danger" onclick="MapBase.changeMarkerAmount('${marker.subdata || marker.text}', -1)">↓</button>
    <small data-item="${marker.text}">${marker.amount}</small>
    <button class="btn btn-success" onclick="MapBase.changeMarkerAmount('${marker.subdata || marker.text}', 1)">↑</button>
    </div>`;

    return `<h1>${popupTitle}</h1>
        <p>${MapBase.getToolIcon(marker.tool)} ${popupContent}</p>
          ${videoText}
        ${buttons}
        <button type="button" class="btn btn-info remove-button" onclick="MapBase.removeItemFromMap('${marker.text}', '${marker.subdata}')" data-item="${marker.text}">${Language.get("map.remove_add")}</button>`;
  },

  addMarkerOnMap: function (marker) {
    if (marker.day != day && !marker.day.includes(day)) return;

    if (!uniqueSearchMarkers.includes(marker))
      return;

    if (!enabledCategories.includes(marker.category)) return;

    if (parseInt(toolType) < parseInt(marker.tool)) return;

    var isWeekly = weeklySetData.filter(weekly => {
      return weekly.item === marker.text;
    }).length > 0;

    var tempMarker = L.marker([marker.lat, marker.lng], {
      opacity: marker.canCollect ? 1 : .35,
      icon: new L.Icon.DataMarkup({
        iconUrl: './assets/images/icons/' + marker.category + '_' + (marker.category == 'random' ? 'lightgray' : MapBase.getIconColor(isWeekly ? 'weekly' : 'day_' + day)) + '.png',
        iconSize: [35, 45],
        iconAnchor: [17, 42],
        popupAnchor: [1, -32],
        shadowAnchor: [10, 12],
        shadowUrl: './assets/images/markers-shadow.png',
        marker: marker.text
      })
    });
    tempMarker.id = marker.text;
    marker.isVisible = true;

    marker.title = (marker.category == 'random') ? Language.get("random_item.name") + marker.text.replace('random_item_', '') : Language.get(`${marker.text}.name`);
    marker.description = Language.get(`${marker.text}_${day}.desc`);

    tempMarker.bindPopup(MapBase.updateMarkerContent(marker))
      .on("click", function (e) {
        Routes.addMarkerOnCustomRoute(marker.text);
        if (customRouteEnabled) e.target.closePopup();
      });
    Layers.itemMarkersLayer.addLayer(tempMarker);
  },

  save: function () {
    //Before saving, remove previous cookies peepoSmart
    $.removeCookie('removed-items');
    $.each($.cookie(), function (key, value) {
      if (key.startsWith('removed-items')) {
        $.removeCookie(key)
      }
    });
    var temp = "";
    $.each(markers, function (key, marker) {
      if ((marker.day == day || marker.day.includes(day)) && (marker.amount > 0 || marker.isCollected))
        temp += `${marker.text}:${marker.isCollected ? '1' : '0'}:${marker.amount};`;
    });

    var collectedItemsArray = temp.match(/.{1,2400}/g);

    $.each(collectedItemsArray, function (key, value) {
      $.cookie('removed-items-' + key, value, {
        expires: 999
      });
    });
  }
};

MapBase.getToolIcon = function (type) {
  switch (type) {
    case '0':
      return '';
      break;
    case '1':
      return '<img class="tool-type" src="assets/images/shovel.png">';
      break;
    case '2':
      return '<img class="tool-type" src="assets/images/magnet.png">';
      break;
  }
};

MapBase.loadFastTravels = function () {
  $.getJSON('data/fasttravels.json?nocache=' + nocache)
    .done(function (data) {
      fastTravelData = data;
    });
};

MapBase.addFastTravelMarker = function () {
  if (enabledCategories.includes('fast_travel')) {
    $.each(fastTravelData, function (key, value) {

      var marker = L.marker([value.x, value.y], {
        icon: L.icon({
          iconUrl: './assets/images/icons/fast_travel_gray.png',
          iconSize: [35, 45],
          iconAnchor: [17, 42],
          popupAnchor: [1, -32],
          shadowAnchor: [10, 12],
          shadowUrl: './assets/images/markers-shadow.png'
        })
      });

      marker.bindPopup(`<h1> ${Language.get(value.text + '.name')}</h1><p>  </p>`);

      Layers.itemMarkersLayer.addLayer(marker);
    });
  }
};

MapBase.debugMarker = function (lat, long) {
  var marker = L.marker([lat, long], {
    icon: L.icon({
      iconUrl: './assets/images/icons/random_darkblue.png',
      iconSize: [35, 45],
      iconAnchor: [17, 42],
      popupAnchor: [1, -32],
      shadowAnchor: [10, 12],
      shadowUrl: './assets/images/markers-shadow.png'

    })
  });

  marker.bindPopup(`<h1>Debug Marker</h1><p>  </p>`);
  Layers.itemMarkersLayer.addLayer(marker);
};

MapBase.addCoordsOnMap = function (coords) {
  // Show clicked coordinates (like google maps)
  if (showCoordinates) {
    $('.lat-lng-container').css('display', 'block');

    $('.lat-lng-container p').html(`lat: ${coords.latlng.lat} <br> lng: ${coords.latlng.lng}`);

    $('#lat-lng-container-close-button').click(function () {
      $('.lat-lng-container').css('display', 'none');
    });
  }

  //console.log(`{"text": "_treasure", "x": "${coords.latlng.lat}", "y": "${coords.latlng.lng}", "radius": "5"},`);
  if (debugTool != null)
    console.log(`{"text": "random_item_", "day": ["1", "2", "3"], "tool": "${debugTool}", "icon": "random", "x": "${coords.latlng.lat}", "y": "${coords.latlng.lng}"},`);

};

MapBase.loadMadamNazar = function () {

  $.getJSON('https://pepegapi.jeanropke.net/rdo/nazar')
    .done(function (nazar) {
      nazarCurrentLocation = nazar.nazar_id - 1;
      nazarCurrentDate = nazar.date;
    }).always(function () {
      $.getJSON('data/nazar.json?nocache=' + nocache)
        .done(function (data) {
          nazarLocations = data;
          MapBase.addMadamNazar(false);
        });
    });
};

MapBase.addMadamNazar = function (firstLoad) {
  if (firstLoad)
    return;

  if (nazarCurrentLocation == null) {
    console.error('Unable to get Nazar position. Try again later.');
    return;
  }
  if (enabledCategories.includes('nazar')) {
    var marker = L.marker([nazarLocations[nazarCurrentLocation].x, nazarLocations[nazarCurrentLocation].y], {
      icon: L.icon({
        iconUrl: './assets/images/icons/nazar_red.png',
        iconSize: [35, 45],
        iconAnchor: [17, 42],
        popupAnchor: [1, -32],
        shadowAnchor: [10, 12],
        shadowUrl: './assets/images/markers-shadow.png'
      })
    });

    marker.bindPopup(`<h1>${Language.get('madam_nazar.name')} - ${MapBase.formatDate(nazarCurrentDate)}</h1><p>Wrong location? Follow <a href='https://twitter.com/MadamNazarIO' target="_blank">@MadamNazarIO</a>.</p>`);
    Layers.itemMarkersLayer.addLayer(marker);
  }
};
MapBase.formatDate = function (date) {
  var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var _day = date.split('/')[2];
  var _month = monthNames[date.split('/')[1] - 1];
  var _year = date.split('/')[0];
  return `${_month} ${_day}, ${_year}`;
};
