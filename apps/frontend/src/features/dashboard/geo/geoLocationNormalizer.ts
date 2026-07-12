const COUNTRY_NAME_MAP: Record<string, string> = {
  "usa": "United States",
  "us": "United States",
  "u.s.": "United States",
  "u.s.a": "United States",
  "united states of america": "United States",
  "america": "United States",
  "us of a": "United States",
  "uk": "United Kingdom",
  "u.k.": "United Kingdom",
  "united kingdom": "United Kingdom",
  "england": "United Kingdom",
  "great britain": "United Kingdom",
  "britain": "United Kingdom",
  "uae": "United Arab Emirates",
  "u.a.e.": "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
  "korea": "South Korea",
  "south korea": "South Korea",
  "republic of korea": "South Korea",
  "north korea": "North Korea",
  "dprk": "North Korea",
  "russia": "Russia",
  "russian federation": "Russia",
  "iran": "Iran",
  "islamic republic of iran": "Iran",
  "syria": "Syria",
  "syrian arab republic": "Syria",
  "vietnam": "Vietnam",
  "viet nam": "Vietnam",
  "laos": "Laos",
  "lao pdr": "Laos",
  "lao people's democratic republic": "Laos",
  "venezuela": "Venezuela",
  "bolivarian republic of venezuela": "Venezuela",
  "bolivia": "Bolivia",
  "plurinational state of bolivia": "Bolivia",
  "tanzania": "Tanzania",
  "united republic of tanzania": "Tanzania",
  "czech republic": "Czech Republic",
  "czechia": "Czech Republic",
  "ivory coast": "Ivory Coast",
  "côte d'ivoire": "Ivory Coast",
  "cote d'ivoire": "Ivory Coast",
  "macedonia": "North Macedonia",
  "north macedonia": "North Macedonia",
  "swaziland": "Eswatini",
  "eswatini": "Eswatini",
  "cabo verde": "Cape Verde",
  "cape verde": "Cape Verde",
  "dr congo": "Democratic Republic of the Congo",
  "drc": "Democratic Republic of the Congo",
  "democratic republic of congo": "Democratic Republic of the Congo",
  "democratic republic of the congo": "Democratic Republic of the Congo",
  "congo": "Republic of the Congo",
  "republic of congo": "Republic of the Congo",
  "republic of the congo": "Republic of the Congo",
  "congo-brazzaville": "Republic of the Congo",
  "east timor": "Timor-Leste",
  "timor leste": "Timor-Leste",
  "timor-leste": "Timor-Leste",
  "burma": "Myanmar",
  "myanmar": "Myanmar",
  "micronesia": "Micronesia",
  "federated states of micronesia": "Micronesia",
  "ukraine": "Ukraine",
  "belarus": "Belarus",
  "moldova": "Moldova",
  "republic of moldova": "Moldova",
  "china": "China",
  "people's republic of china": "China",
  "prc": "China",
  "taiwan": "Taiwan",
  "republic of china": "Taiwan",
  "holland": "Netherlands",
  "netherlands": "Netherlands",
  "the netherlands": "Netherlands",
  "kingdom of the netherlands": "Netherlands",
};

const US_STATES: Record<string, string> = {
  "al": "Alabama", "ak": "Alaska", "az": "Arizona", "ar": "Arkansas",
  "ca": "California", "co": "Colorado", "ct": "Connecticut", "de": "Delaware",
  "fl": "Florida", "ga": "Georgia", "hi": "Hawaii", "id": "Idaho",
  "il": "Illinois", "in": "Indiana", "ia": "Iowa", "ks": "Kansas",
  "ky": "Kentucky", "la": "Louisiana", "me": "Maine", "md": "Maryland",
  "ma": "Massachusetts", "mi": "Michigan", "mn": "Minnesota", "ms": "Mississippi",
  "mo": "Missouri", "mt": "Montana", "ne": "Nebraska", "nv": "Nevada",
  "nh": "New Hampshire", "nj": "New Jersey", "nm": "New Mexico", "ny": "New York",
  "nc": "North Carolina", "nd": "North Dakota", "oh": "Ohio", "ok": "Oklahoma",
  "or": "Oregon", "pa": "Pennsylvania", "ri": "Rhode Island", "sc": "South Carolina",
  "sd": "South Dakota", "tn": "Tennessee", "tx": "Texas", "ut": "Utah",
  "vt": "Vermont", "va": "Virginia", "wa": "Washington", "wv": "West Virginia",
  "wi": "Wisconsin", "wy": "Wyoming",
};

export function normalizeLocation(value: string): string {
  const trimmed = value?.toString().trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();

  if (COUNTRY_NAME_MAP[lower]) return COUNTRY_NAME_MAP[lower];
  if (US_STATES[lower]) return US_STATES[lower];

  return trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function normalizeLocationList(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    const normalized = normalizeLocation(raw);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}
