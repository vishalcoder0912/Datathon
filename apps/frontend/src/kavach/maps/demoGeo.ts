export interface DemoDistrict {
  district: string;
  longitude: number;
  latitude: number;
}

const districtCentres: DemoDistrict[] = [
  {district: "Bagalkote", longitude: 75.72, latitude: 16.19},
  {district: "Ballari", longitude: 76.92, latitude: 15.14},
  {district: "Belagavi", longitude: 74.5, latitude: 15.85},
  {district: "Bengaluru Rural", longitude: 77.67, latitude: 13.2},
  {district: "Bengaluru Urban", longitude: 77.59, latitude: 12.97},
  {district: "Bidar", longitude: 77.55, latitude: 17.91},
  {district: "Chamarajanagar", longitude: 76.94, latitude: 11.93},
  {district: "Chikkaballapur", longitude: 77.73, latitude: 13.44},
  {district: "Chikkamagaluru", longitude: 75.77, latitude: 13.32},
  {district: "Chitradurga", longitude: 76.4, latitude: 14.23},
  {district: "Dakshina Kannada", longitude: 74.86, latitude: 12.91},
  {district: "Davanagere", longitude: 75.92, latitude: 14.47},
  {district: "Dharwad", longitude: 75.0, latitude: 15.45},
  {district: "Gadag", longitude: 75.63, latitude: 15.43},
  {district: "Hassan", longitude: 76.1, latitude: 13.0},
  {district: "Haveri", longitude: 75.4, latitude: 14.8},
  {district: "Kalaburagi", longitude: 76.83, latitude: 17.33},
  {district: "Kodagu", longitude: 75.73, latitude: 12.42},
  {district: "Kolar", longitude: 78.13, latitude: 13.13},
  {district: "Koppal", longitude: 76.15, latitude: 15.35},
  {district: "Mandya", longitude: 76.9, latitude: 12.52},
  {district: "Mysuru", longitude: 76.65, latitude: 12.3},
  {district: "Raichur", longitude: 77.35, latitude: 16.21},
  {district: "Ramanagara", longitude: 77.28, latitude: 12.72},
  {district: "Shivamogga", longitude: 75.57, latitude: 13.93},
  {district: "Tumakuru", longitude: 77.1, latitude: 13.34},
  {district: "Udupi", longitude: 74.75, latitude: 13.34},
  {district: "Uttara Kannada", longitude: 74.4, latitude: 14.6},
  {district: "Vijayapura", longitude: 75.72, latitude: 16.83},
  {district: "Yadgir", longitude: 77.13, latitude: 16.77},
];

type GeoFeature = {
  type: "Feature";
  properties: Record<string, string | number | boolean>;
  geometry: {type: "Polygon"; coordinates: number[][][]};
};

export interface DistrictFeatureCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

function rectangle(longitude: number, latitude: number) {
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

export const demoDistrictGeoJson: DistrictFeatureCollection = {
  type: "FeatureCollection",
  features: districtCentres.map((centre) => ({
    type: "Feature",
    properties: {
      district: centre.district,
      overlay: "synthetic-demo-boundary",
      incidents: 0,
      riskScore: 0,
    },
    geometry: {type: "Polygon", coordinates: rectangle(centre.longitude, centre.latitude)},
  })),
};

export const demoStationGeoJson = {
  type: "FeatureCollection" as const,
  features: [
    {type: "Feature" as const, properties: {stationId: "demo-cubbon-park", stationName: "Cubbon Park", district: "Bengaluru Urban"}, geometry: {type: "Point" as const, coordinates: [77.5946, 12.9767]}},
    {type: "Feature" as const, properties: {stationId: "demo-krishnaraja", stationName: "Krishnaraja", district: "Mysuru"}, geometry: {type: "Point" as const, coordinates: [76.655, 12.305]}},
    {type: "Feature" as const, properties: {stationId: "demo-maruti", stationName: "Maruti", district: "Belagavi"}, geometry: {type: "Point" as const, coordinates: [74.501, 15.857]}},
    {type: "Feature" as const, properties: {stationId: "demo-mangaluru-north", stationName: "Mangaluru North", district: "Dakshina Kannada"}, geometry: {type: "Point" as const, coordinates: [74.856, 12.915]}},
  ],
};

export function buildDistrictGeoJson(metrics: Array<{district?: string; districtName?: string; totalIncidents?: number; incidents?: number; riskScore?: number}>) {
  const metricByDistrict = new Map(metrics.map((metric) => [String(metric.district ?? metric.districtName ?? "").toLowerCase(), metric]));
  return {
    ...demoDistrictGeoJson,
    features: demoDistrictGeoJson.features.map((feature) => {
      const metric = metricByDistrict.get(String(feature.properties.district).toLowerCase());
      return {
        ...feature,
        properties: {
          ...feature.properties,
          incidents: Number(metric?.totalIncidents ?? metric?.incidents ?? 0),
          riskScore: Number(metric?.riskScore ?? 0),
        },
      };
    }),
  };
}
