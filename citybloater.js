const l = console.log;
const compareTimestamp = (t1, t2) => new Date(t1).valueOf() - new Date(t2).valueOf();
const haversineDistance = (p1, p2) => {
    var R = 6378.137; // Radius of earth in KM
    var dLat = p2[0] * Math.PI / 180 - p1[0] * Math.PI / 180;
    var dLon = p2[1] * Math.PI / 180 - p1[1] * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d * 1000; // meters
};
const calculateLatLonOffset = (lat, lon, offset, direction) => {
    // Position, decimal degrees

    // Earth’s radius, sphere
    const R = 6378137;

    // Coordinate offsets in radians
    dLat = offset / R;
    dLon = offset / (R * Math.cos(Math.PI * lat / 180));

    // OffsetPosition, decimal degrees
    latO = lat + dLat * 180 / Math.PI;
    lonO = lon + dLon * 180 / Math.PI;

    latO += direction[0];
    lonO += direction[1];
    l(lat, lon, latO, lonO, offset);
    return [ latO, lonO ];
};
const hex2rgba = (hex) => {
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        let c = hex.substring(1).split('');
        if(c.length == 3){
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x'+c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',1)';
    }
    throw new Error('Bad Hex');
};
const rgbaSetOpacity = (rgba, opacity) => rgba.replace(/(rgba\(\d+,\d+,\d+),(.*)\)/, '$1,' + opacity + ')');
//const multiDimensionalUnique = (arr) => {
//    var uniques = [];
//    var itemsFound = {};
//    for(var i = 0, l = arr.length; i < l; i++) {
//        var stringified = JSON.stringify(arr[i]);
//        if(itemsFound[stringified]) { continue; }
//        uniques.push(arr[i]);
//        itemsFound[stringified] = true;
//    }
//    return uniques;
//};
//const sortByKey = (keyName) => Object.entries(c)
//                                     .sort(([k1,v1],[k2,v2]) => v1[keyName] - v2[keyName])
//                                     .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

const loadLocation = (query) => {
    return new Promise(function(resolve, reject) {
        var req = new XMLHttpRequest();
        req.addEventListener('load', function(e) {
            const location = JSON.parse(this.responseText);
            if (location.length === 0) {
                reject('Error loading location');
                return;
            }
            resolve(location[0]);
        });
        req.open('GET', 'https://nominatim.openstreetmap.org/search?format=json&q=' + query);
        req.send();
    });
};

const loadBoundaryData = (location) => {
    // TODO: remove unnecessary structures and keep only what is needed
    return new Promise(function(resolve, reject) {
        var req = new XMLHttpRequest();
        req.addEventListener('load', function(e) {
            if (this.responseText === '') {
                reject('Error loading boundary data');
                return;
            }

            let boundaryData = {
                nodes: {},
                ways: {},
                relations: {},
                way: null,
                relation: null,
            };
            const data = JSON.parse(this.responseText);
            for (let k in data.elements) {
                let d = data.elements[k];
                switch (d.type) {
                    case 'node':
                        boundaryData.nodes[d.id] = d;
                        break;
                    case 'way':
                        boundaryData.ways[d.id] = d;
                        if (boundaryData.way === null) {
                            boundaryData.way = d;
                        } else if (compareTimestamp(boundaryData.way.timestamp, d.timestamp) < 0) {
                            boundaryData.way = d;
                        }
                        break;
                    case 'relation':
                        boundaryData.relations[d.id] = d;
                        if (boundaryData.relation === null) {
                            boundaryData.relation = d;
                        } else if (compareTimestamp(boundaryData.way.timestamp, d.timestamp) < 0) {
                            boundaryData.relation = d;
                        }
                        break;
                }
            }

            resolve({ location: location, boundaryData: boundaryData });
        });
        req.open('GET', 'https://api.openstreetmap.org/api/0.6/relation/' + location.osm_id + '/full.json');
        req.send();
    });
};

//const LGlobalAlphaCanvas = L.Canvas.extend({
//    _fillStroke: function (ctx, layer) {
//        var options = layer.options;
//
//        if (options.fill) {
//            //ctx.globalAlpha = options.fillOpacity;
//            ctx.fillStyle = options.fillColor || options.color;
//            ctx.fill(options.fillRule || 'evenodd');
//        }
//
//        if (options.stroke && options.weight !== 0) {
//            if (ctx.setLineDash) {
//                ctx.setLineDash(layer.options && layer.options._dashArray || []);
//            }
//            //ctx.globalAlpha = options.opacity;
//            ctx.lineWidth = options.weight;
//            ctx.strokeStyle = options.color;
//            ctx.lineCap = options.lineCap;
//            ctx.lineJoin = options.lineJoin;
//            ctx.stroke();
//        }
//    },
//});

let map = null;
const loadMap = (location, boundaryData) => {
    return new Promise(function(resolve, reject) {
        if (map !== null) {
            map.remove();
        }
        map = L.map('map', {
            renderer: L.canvas(),
            preferCanvas: true,
        });
        map.setView([ location.lat, location.lon ], 10);
        //map.setView([ 47.779006849033415, 12.93777818845283 ], 16);
        L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            maxZoom: 18,
            id: 'mapbox/streets-v11',
            tileSize: 512,
            zoomOffset: -1,
            accessToken: 'pk.eyJ1Ijoid2lyZnVlcnVuczIiLCJhIjoiY2tqdTEzZzBxMGo5ZzJycXNuZ3BraDU5NSJ9.3FsOc20Ri3kT4-RD-cbuEw'
        }).addTo(map);

        // Bounding box
        let bounds = [
            [ location.boundingbox[0], location.boundingbox[2] ],
            [ location.boundingbox[1], location.boundingbox[3] ],
        ];
        let rect = L.rectangle(bounds, { color: 'rgba(0, 0, 255, 0.1)', weight: 1 }).addTo(map);

        // City center
        L.circle([ location.lat, location.lon ], { color: '#000000', fillOpacity: 1.0, stroke: false, radius: 500 }).addTo(map);
        L.circle([ location.lat, location.lon ], { color: '#ffffff', fillOpacity: 1.0, stroke: false, radius: 200 }).addTo(map);

        // Simple expansion
        L.circle([ location.lat, location.lon ], { color: '#0000ff', fillOpacity: 0.2, stroke: false, radius: 15000 }).addTo(map);

        let allCoordinates = [];
        let coordinateStops = [];
        let colors = [ '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff' ];
        for (let i in boundaryData.relation.members) {
            let m = boundaryData.relation.members[i];
            let w = boundaryData.ways[m.ref];
            let coordinates = [];
            for (let k2 in w.nodes) {
                let n = w.nodes[k2];
                let c = boundaryData.nodes[n];
                //L.circleMarker([ c.lat, c.lon ], { color: '#0000ff  ' }).addTo(map);
                coordinates.push([ c.lat, c.lon ]);
                allCoordinates.push([ c.lat, c.lon ]);
            }
            L.polyline(coordinates, { color: '#ff0000'/*colors[i]*/, smoothFactor: 0.0, weight: 2 }).addTo(map);
            // color in 
            //let startCoordinate = coordinates[0];
            //let endCoordinate = coordinates[coordinates.length - 1];
            //let colorStart = rgbaSetOpacity(hex2rgba(colors[i]), 1);
            //let colorEnd = rgbaSetOpacity(hex2rgba(colors[i]), 0.5);
            //L.circleMarker(startCoordinate, { color: colorStart }).addTo(map);
            //L.circleMarker(endCoordinate, { fillOpacity: 1, fill: true, fillColor: colorEnd , color: colorEnd }).addTo(map);
        }
        //L.polygon(allCoordinates, { color: '#999999'}).addTo(map);

        resolve({ location: location, boundaryData: boundaryData, coordinates: allCoordinates });
    });
};

const radius = 15000; // meter
const calculateBloatedCity = (location, boundaryData, coordinates) => {
    // Print circle for each point
    //for (let i = 1; i < coordinates.length; i++) {
        //const p1 = coordinates[i - 1];
        //const p2 = coordinates[i];
        //let dist = haversineDistance(p1, p2);
        //L.circle(p1, {
            //color: 'rgba(0,255,0,0.5)',
            //radius: 15000,
            //fill: true,
            //fillColor: '#00ff00'
        //}).addTo(map);
    //}

    // Calculate actual new border
    for (let i = 1; i < coordinates.length; i++) {
    //for (let i = 1; i < 2; i++) {
        const p1 = coordinates[i - 1];
        const p2 = coordinates[i];
        const dist = haversineDistance(p1, p2);

        // - Implicit line between two points 

        // Calculate normal line segment of minimal length
        const dLat = p2[0] - p1[0];
        const dLon = p2[1] - p1[1];
        const halfLat = p1[0] + (dLat / 2);
        const halfLon = p1[1] + (dLon / 2);
        const center = [ halfLat, halfLon ];
        const normalDirection = [ -dLon, dLat ];

        const magnitude = Math.sqrt((normalDirection[0] * normalDirection[0]) + (normalDirection[1] * normalDirection[1]));
        const offsetDistance = 10 / 111111; // 2 meters
        const normalizedNormalDirection  = [ 
            normalDirection[0] / magnitude * offsetDistance,
            normalDirection[1] / magnitude * offsetDistance
        ];
        //let normalizedNormalDirection2 = [ -normalDirection[0] / maxNormalCoordinate, -normalDirection[1] / maxNormalCoordinate ];
        // offset in meters
        const np1 = [ halfLat + normalizedNormalDirection[0], halfLon + normalizedNormalDirection[1] ];
        const np2 = [ halfLat - normalizedNormalDirection[0], halfLon - normalizedNormalDirection[1] ];

        const radius = 15000;
        //let np1 = calculateLatLonOffset(halfLat, halfLon, 150, normalizedNormalDirection);
        //let np2 = calculateLatLonOffset(halfLat, halfLon, 150, normalizedNormalDirection2);
        
        // check which one is inside whole path
        let intersectionCount = 0;
        let nps = [ np1, np2 ];
        for (let j = 0; j < 2; j++) {
            for (let k = 0; k < coordinates.length; k++) {
                // uff
            }
        }

        const dist2 = haversineDistance(np1, np2);
        l(dist2, normalizedNormalDirection);
        //l(normalizedNormalDirection);
        //l(normalizedNormalDirection2);
        //l(p1, p2, center, np1, np2);
        //L.circleMarker(p1, { color: '#99ff33', radius: 10, fill: true, fillOpacity: 1, fillColor: '#ff9933' }).addTo(map);
        //L.circleMarker(p2, { color: '#ff9933', radius: 10, fill: true, fillOpacity: 1, fillColor: '#ff9933' }).addTo(map);
        //L.circleMarker(center, { color: '#ff0000', radius: 10, fill: true, fillOpacity: 1, fillColor: '#ff9933' }).addTo(map);
        //L.circleMarker(np1, { color: '#ff0000', radius: 10, fill: true, fillOpacity: 1, fillColor: '#0000aa' }).addTo(map);
        //L.circleMarker(np2, { color: '#ff0000', radius: 10, fill: true, fillOpacity: 1, fillColor: '#0000ff' }).addTo(map);
        L.polyline([ np1, np2 ], { color: '#000000', smoothFactor: 0.0 }).addTo(map);
        //L.circle(p1, {
        //    color: 'rgba(0,255,0,0.5)',
        //    radius: 15000,
        //    fill: true,
        //    fillColor: '#00ff00'
        //}).addTo(map);

        // - Determine translation direction

        // - Translate line in either direction
    }
};

const drawBloatedCity = (location, boundaryData, coordinates) => {
    const circlesPane = map.createPane('circles');
    circlesPane.style.zIndex = 400;
    circlesPane.style.pointerEvents = 'none';
    circlesPane.style.opacity = 0.3;

    let circles = [];
    for (let i = 1; i < coordinates.length; i++) {
        const p1 = coordinates[i - 1];
        const p2 = coordinates[i];
        const dist = haversineDistance(p1, p2);
        circles.push(L.circle(p1, { stroke: false, color: '#009900', fillOpacity: 1.0, radius: 15000, pane: 'circles' }));
    }

    const circleGroup = new L.FeatureGroup(circles);
    circleGroup.addTo(map);
};

const runScript = (query) => {
    loadLocation(query)
    .then(location => loadBoundaryData(location))
    .then(data     => loadMap(data.location, data.boundaryData))
    //.then(data     => calculateBloatedCity(data.location, data.boundaryData, data.coordinates))
    .then(data     => drawBloatedCity(data.location, data.boundaryData, data.coordinates))
    .catch(error   => l(error));
};

const registerEvents = () => {
    document.querySelector("#input").addEventListener("click", () => {
        const query = document.querySelector('#query').value;
        runScript(query);
    });
};

function setup() {
    console.log('setup called');
}

document.onreadystatechange = (e) => {
    console.log('loaded');
    return;
    if (document.readyState != "complete") {
        return;
    }
    registerEvents();
    runScript('Piding');
}