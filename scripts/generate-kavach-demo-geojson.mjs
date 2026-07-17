import {mkdirSync, writeFileSync} from "node:fs";
import {resolve} from "node:path";

const districts = [
  ["Bagalkote", 75.72, 16.19], ["Ballari", 76.92, 15.14], ["Belagavi", 74.5, 15.85], ["Bengaluru Rural", 77.67, 13.2], ["Bengaluru Urban", 77.59, 12.97], ["Bidar", 77.55, 17.91], ["Chamarajanagar", 76.94, 11.93], ["Chikkaballapur", 77.73, 13.44], ["Chikkamagaluru", 75.77, 13.32], ["Chitradurga", 76.4, 14.23], ["Dakshina Kannada", 74.86, 12.91], ["Davanagere", 75.92, 14.47], ["Dharwad", 75, 15.45], ["Gadag", 75.63, 15.43], ["Hassan", 76.1, 13], ["Haveri", 75.4, 14.8], ["Kalaburagi", 76.83, 17.33], ["Kodagu", 75.73, 12.42], ["Kolar", 78.13, 13.13], ["Koppal", 76.15, 15.35], ["Mandya", 76.9, 12.52], ["Mysuru", 76.65, 12.3], ["Raichur", 77.35, 16.21], ["Ramanagara", 77.28, 12.72], ["Shivamogga", 75.57, 13.93], ["Tumakuru", 77.1, 13.34], ["Udupi", 74.75, 13.34], ["Uttara Kannada", 74.4, 14.6], ["Vijayapura", 75.72, 16.83], ["Yadgir", 77.13, 16.77],
];

function rectangle(longitude, latitude) {
  const longitudeOffset = 0.2;
  const latitudeOffset = 0.14;
  return [[
    [longitude - longitudeOffset, latitude - latitudeOffset],
    [longitude + longitudeOffset, latitude - latitudeOffset],
    [longitude + longitudeOffset, latitude + latitudeOffset],
    [longitude - longitudeOffset, latitude + latitudeOffset],
    [longitude - longitudeOffset, latitude - latitudeOffset],
  ]];
}

const districtGeoJson = {
  type: "FeatureCollection",
  metadata: {isSynthetic: true, disclaimer: "Illustrative demo overlays. They are not operational jurisdiction boundaries."},
  features: districts.map(([district, longitude, latitude]) => ({
    type: "Feature",
    properties: {district, overlay: "synthetic-demo-boundary"},
    geometry: {type: "Polygon", coordinates: rectangle(longitude, latitude)},
  })),
};

const stationGeoJson = {
  type: "FeatureCollection",
  metadata: {isSynthetic: true, disclaimer: "Illustrative demo police-station locations only."},
  features: [
    ["demo-cubbon-park", "Cubbon Park", "Bengaluru Urban", 77.5946, 12.9767],
    ["demo-krishnaraja", "Krishnaraja", "Mysuru", 76.655, 12.305],
    ["demo-maruti", "Maruti", "Belagavi", 74.501, 15.857],
    ["demo-mangaluru-north", "Mangaluru North", "Dakshina Kannada", 74.856, 12.915],
  ].map(([stationId, stationName, district, longitude, latitude]) => ({
    type: "Feature",
    properties: {stationId, stationName, district},
    geometry: {type: "Point", coordinates: [longitude, latitude]},
  })),
};

const targetDirectory = resolve("infra/geo");
mkdirSync(targetDirectory, {recursive: true});
writeFileSync(resolve(targetDirectory, "karnataka-districts.geojson"), `${JSON.stringify(districtGeoJson, null, 2)}\n`, "utf8");
writeFileSync(resolve(targetDirectory, "police-station-demo.geojson"), `${JSON.stringify(stationGeoJson, null, 2)}\n`, "utf8");
