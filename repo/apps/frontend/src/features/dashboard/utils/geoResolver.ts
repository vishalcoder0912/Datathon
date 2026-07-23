export type GeoKind = "country" | "state" | "city";

export type GeoResolvedLocation = {
  name: string;
  coordinates: [number, number];
  kind: GeoKind;
};

export const normalizeGeoValue = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export const GEO_LOCATION_INDEX: Record<string, GeoResolvedLocation> = {
  india: { name: "India", coordinates: [78.96, 20.59], kind: "country" },
  in: { name: "India", coordinates: [78.96, 20.59], kind: "country" },
  usa: { name: "United States", coordinates: [-98.58, 39.83], kind: "country" },
  us: { name: "United States", coordinates: [-98.58, 39.83], kind: "country" },
  u_s: { name: "United States", coordinates: [-98.58, 39.83], kind: "country" },
  u_s_a: { name: "United States", coordinates: [-98.58, 39.83], kind: "country" },
  america: { name: "United States", coordinates: [-98.58, 39.83], kind: "country" },
  united_states: { name: "United States", coordinates: [-98.58, 39.83], kind: "country" },
  united_states_of_america: { name: "United States", coordinates: [-98.58, 39.83], kind: "country" },
  canada: { name: "Canada", coordinates: [-106.35, 56.13], kind: "country" },
  germany: { name: "Germany", coordinates: [10.45, 51.17], kind: "country" },
  de: { name: "Germany", coordinates: [10.45, 51.17], kind: "country" },
  france: { name: "France", coordinates: [2.21, 46.22], kind: "country" },
  united_kingdom: { name: "United Kingdom", coordinates: [-3.43, 55.38], kind: "country" },
  uk: { name: "United Kingdom", coordinates: [-3.43, 55.38], kind: "country" },
  u_k: { name: "United Kingdom", coordinates: [-3.43, 55.38], kind: "country" },
  gb: { name: "United Kingdom", coordinates: [-3.43, 55.38], kind: "country" },
  great_britain: { name: "United Kingdom", coordinates: [-3.43, 55.38], kind: "country" },
  britain: { name: "United Kingdom", coordinates: [-3.43, 55.38], kind: "country" },
  england: { name: "United Kingdom", coordinates: [-3.43, 55.38], kind: "country" },
  japan: { name: "Japan", coordinates: [138.25, 36.2], kind: "country" },
  jp: { name: "Japan", coordinates: [138.25, 36.2], kind: "country" },
  china: { name: "China", coordinates: [104.2, 35.86], kind: "country" },
  singapore: { name: "Singapore", coordinates: [103.82, 1.35], kind: "country" },
  australia: { name: "Australia", coordinates: [133.78, -25.27], kind: "country" },
  au: { name: "Australia", coordinates: [133.78, -25.27], kind: "country" },
  uae: { name: "United Arab Emirates", coordinates: [53.85, 23.42], kind: "country" },
  u_a_e: { name: "United Arab Emirates", coordinates: [53.85, 23.42], kind: "country" },
  united_arab_emirates: { name: "United Arab Emirates", coordinates: [53.85, 23.42], kind: "country" },
  brazil: { name: "Brazil", coordinates: [-51.92, -14.23], kind: "country" },
  mexico: { name: "Mexico", coordinates: [-102.55, 23.63], kind: "country" },
  south_africa: { name: "South Africa", coordinates: [22.94, -30.56], kind: "country" },
  nigeria: { name: "Nigeria", coordinates: [8.67, 9.08], kind: "country" },
  spain: { name: "Spain", coordinates: [-3.75, 40.46], kind: "country" },
  es: { name: "Spain", coordinates: [-3.75, 40.46], kind: "country" },
  italy: { name: "Italy", coordinates: [12.57, 41.87], kind: "country" },
  it: { name: "Italy", coordinates: [12.57, 41.87], kind: "country" },
  netherlands: { name: "Netherlands", coordinates: [5.29, 52.13], kind: "country" },
  nl: { name: "Netherlands", coordinates: [5.29, 52.13], kind: "country" },
  holland: { name: "Netherlands", coordinates: [5.29, 52.13], kind: "country" },
  russia: { name: "Russia", coordinates: [105.32, 61.52], kind: "country" },
  ru: { name: "Russia", coordinates: [105.32, 61.52], kind: "country" },
  russian_federation: { name: "Russia", coordinates: [105.32, 61.52], kind: "country" },
  argentina: { name: "Argentina", coordinates: [-63.62, -38.42], kind: "country" },
  ar: { name: "Argentina", coordinates: [-63.62, -38.42], kind: "country" },
  south_korea: { name: "South Korea", coordinates: [127.77, 35.91], kind: "country" },
  korea: { name: "South Korea", coordinates: [127.77, 35.91], kind: "country" },
  kr: { name: "South Korea", coordinates: [127.77, 35.91], kind: "country" },

  delhi: { name: "Delhi", coordinates: [77.1, 28.7], kind: "city" },
  new_delhi: { name: "New Delhi", coordinates: [77.21, 28.61], kind: "city" },
  noida: { name: "Noida", coordinates: [77.39, 28.54], kind: "city" },
  gurugram: { name: "Gurugram", coordinates: [77.03, 28.46], kind: "city" },
  gurgaon: { name: "Gurugram", coordinates: [77.03, 28.46], kind: "city" },
  mumbai: { name: "Mumbai", coordinates: [72.88, 19.08], kind: "city" },
  pune: { name: "Pune", coordinates: [73.86, 18.52], kind: "city" },
  bengaluru: { name: "Bengaluru", coordinates: [77.59, 12.97], kind: "city" },
  bangalore: { name: "Bengaluru", coordinates: [77.59, 12.97], kind: "city" },
  hyderabad: { name: "Hyderabad", coordinates: [78.49, 17.38], kind: "city" },
  chennai: { name: "Chennai", coordinates: [80.27, 13.08], kind: "city" },
  kolkata: { name: "Kolkata", coordinates: [88.36, 22.57], kind: "city" },
  ahmedabad: { name: "Ahmedabad", coordinates: [72.57, 23.02], kind: "city" },
  jaipur: { name: "Jaipur", coordinates: [75.79, 26.91], kind: "city" },
  lucknow: { name: "Lucknow", coordinates: [80.95, 26.85], kind: "city" },
  kochi: { name: "Kochi", coordinates: [76.27, 9.93], kind: "city" },
  surat: { name: "Surat", coordinates: [72.83, 21.17], kind: "city" },
  chandigarh: { name: "Chandigarh", coordinates: [76.78, 30.73], kind: "city" },
  bhopal: { name: "Bhopal", coordinates: [77.41, 23.26], kind: "city" },
  indore: { name: "Indore", coordinates: [75.86, 22.72], kind: "city" },
  patna: { name: "Patna", coordinates: [85.14, 25.59], kind: "city" },
  london: { name: "London", coordinates: [-0.13, 51.51], kind: "city" },
  new_york: { name: "New York", coordinates: [-74.01, 40.71], kind: "city" },
  nyc: { name: "New York", coordinates: [-74.01, 40.71], kind: "city" },
  los_angeles: { name: "Los Angeles", coordinates: [-118.24, 34.05], kind: "city" },
  san_francisco: { name: "San Francisco", coordinates: [-122.42, 37.77], kind: "city" },
  chicago: { name: "Chicago", coordinates: [-87.63, 41.88], kind: "city" },
  toronto: { name: "Toronto", coordinates: [-79.38, 43.65], kind: "city" },
  berlin: { name: "Berlin", coordinates: [13.4, 52.52], kind: "city" },
  paris: { name: "Paris", coordinates: [2.35, 48.86], kind: "city" },
  tokyo: { name: "Tokyo", coordinates: [139.69, 35.69], kind: "city" },
  sydney: { name: "Sydney", coordinates: [151.21, -33.87], kind: "city" },
  melbourne: { name: "Melbourne", coordinates: [144.96, -37.81], kind: "city" },
  dubai: { name: "Dubai", coordinates: [55.27, 25.2], kind: "city" },
  sao_paulo: { name: "Sao Paulo", coordinates: [-46.63, -23.55], kind: "city" },
  mexico_city: { name: "Mexico City", coordinates: [-99.13, 19.43], kind: "city" },
  lagos: { name: "Lagos", coordinates: [3.38, 6.52], kind: "city" },
  cape_town: { name: "Cape Town", coordinates: [18.42, -33.92], kind: "city" },
  seoul: { name: "Seoul", coordinates: [126.98, 37.57], kind: "city" },

  maharashtra: { name: "Maharashtra", coordinates: [75.71, 19.75], kind: "state" },
  karnataka: { name: "Karnataka", coordinates: [75.71, 15.32], kind: "state" },
  uttar_pradesh: { name: "Uttar Pradesh", coordinates: [80.94, 26.85], kind: "state" },
  gujarat: { name: "Gujarat", coordinates: [71.19, 22.26], kind: "state" },
  rajasthan: { name: "Rajasthan", coordinates: [74.22, 27.02], kind: "state" },
  tamil_nadu: { name: "Tamil Nadu", coordinates: [78.66, 11.13], kind: "state" },
  telangana: { name: "Telangana", coordinates: [79.02, 18.11], kind: "state" },
  west_bengal: { name: "West Bengal", coordinates: [87.85, 22.99], kind: "state" },
  kerala: { name: "Kerala", coordinates: [76.27, 10.85], kind: "state" },
  madhya_pradesh: { name: "Madhya Pradesh", coordinates: [78.66, 22.97], kind: "state" },
  andhra_pradesh: { name: "Andhra Pradesh", coordinates: [79.74, 15.91], kind: "state" },
  haryana: { name: "Haryana", coordinates: [76.09, 29.06], kind: "state" },
  punjab: { name: "Punjab", coordinates: [75.34, 31.15], kind: "state" },
  bihar: { name: "Bihar", coordinates: [85.31, 25.1], kind: "state" },
  odisha: { name: "Odisha", coordinates: [85.1, 20.95], kind: "state" },
  orissa: { name: "Odisha", coordinates: [85.1, 20.95], kind: "state" },
  assam: { name: "Assam", coordinates: [92.94, 26.2], kind: "state" },
};

export const resolveGeoLocation = (value: unknown) => GEO_LOCATION_INDEX[normalizeGeoValue(value)] || null;

export const extractGeoLocation = (value: unknown) => {
  const exact = resolveGeoLocation(value);
  if (exact) return exact;

  const normalized = normalizeGeoValue(value);
  if (!normalized) return null;

  const parts = normalized.split("_").filter(Boolean);
  for (let size = Math.min(4, parts.length); size >= 1; size -= 1) {
    for (let index = 0; index <= parts.length - size; index += 1) {
      const candidate = parts.slice(index, index + size).join("_");
      const resolved = GEO_LOCATION_INDEX[candidate];
      if (resolved && candidate.length > 2) return resolved;
    }
  }

  return null;
};

export const hasResolvableGeoValue = (value: unknown) => Boolean(extractGeoLocation(value));
