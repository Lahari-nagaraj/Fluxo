/**
 * Curated database of Bengaluru localities with precise coordinates.
 */
export const BENGALURU_LOCALITIES = [
  {
    name: "Vijayanagar, Bengaluru",
    displayName: "Vijayanagar",
    latitude: 12.9719,
    longitude: 77.5304,
    keywords: ["vijaynagar", "vijayanagar", "vijayanagara", "rpc layout", "magadi road"],
  },
  {
    name: "Koramangala, Bengaluru",
    displayName: "Koramangala",
    latitude: 12.9352,
    longitude: 77.6245,
    keywords: ["koramangala", "sony world", "forum", "nexus", "kora"],
  },
  {
    name: "Indiranagar, Bengaluru",
    displayName: "Indiranagar",
    latitude: 12.9784,
    longitude: 77.6408,
    keywords: ["indiranagar", "100ft road", "12th main", "cmh road"],
  },
  {
    name: "HSR Layout, Bengaluru",
    displayName: "HSR Layout",
    latitude: 12.9121,
    longitude: 77.6446,
    keywords: ["hsr", "hsr layout", "sector 1", "sector 2", "sector 3", "sector 7"],
  },
  {
    name: "Whitefield, Bengaluru",
    displayName: "Whitefield",
    latitude: 12.9698,
    longitude: 77.7499,
    keywords: ["whitefield", "itpl", "kadugodi", "hope farm", "phoenix marketcity"],
  },
  {
    name: "Jayanagar, Bengaluru",
    displayName: "Jayanagar",
    latitude: 12.9308,
    longitude: 77.5838,
    keywords: ["jayanagar", "4th block", "3rd block", "south end"],
  },
  {
    name: "JP Nagar, Bengaluru",
    displayName: "JP Nagar",
    latitude: 12.9063,
    longitude: 77.5857,
    keywords: ["jp nagar", "jayaprakash narayan nagar", "phase 1", "phase 2", "sarakki"],
  },
  {
    name: "BTM Layout, Bengaluru",
    displayName: "BTM Layout",
    latitude: 12.9166,
    longitude: 77.6101,
    keywords: ["btm", "btm layout", "madiwala", "kuvempunagar"],
  },
  {
    name: "Malleshwaram, Bengaluru",
    displayName: "Malleshwaram",
    latitude: 13.0031,
    longitude: 77.5643,
    keywords: ["malleshwaram", "malleswaram", "sampige road", "margosa road"],
  },
  {
    name: "Rajajinagar, Bengaluru",
    displayName: "Rajajinagar",
    latitude: 12.9982,
    longitude: 77.553,
    keywords: ["rajajinagar", "orion mall", "navrang", "isckon"],
  },
  {
    name: "MG Road, Bengaluru",
    displayName: "MG Road / Brigade Road",
    latitude: 12.9756,
    longitude: 77.6095,
    keywords: ["mg road", "brigade road", "church street", "cubbon park", "central"],
  },
  {
    name: "Electronic City, Bengaluru",
    displayName: "Electronic City",
    latitude: 12.8399,
    longitude: 77.677,
    keywords: ["electronic city", "e-city", "phase 1", "phase 2", "infosys gate"],
  },
  {
    name: "Hebbal, Bengaluru",
    displayName: "Hebbal",
    latitude: 13.0358,
    longitude: 77.597,
    keywords: ["hebbal", "flyover", "hebbal lake", "manyata ring road"],
  },
  {
    name: "Marathahalli, Bengaluru",
    displayName: "Marathahalli",
    latitude: 12.9591,
    longitude: 77.6974,
    keywords: ["marathahalli", "bridge", "outer ring road", "kundalahalli"],
  },
  {
    name: "Bellandur, Bengaluru",
    displayName: "Bellandur",
    latitude: 12.9304,
    longitude: 77.6784,
    keywords: ["bellandur", "ecospace", "green glen", "devarabisanahalli"],
  },
  {
    name: "Banashankari, Bengaluru",
    displayName: "Banashankari",
    latitude: 12.9255,
    longitude: 77.5468,
    keywords: ["banashankari", "bsk", "kathriguppe", "pes college"],
  },
  {
    name: "Basavanagudi, Bengaluru",
    displayName: "Basavanagudi",
    latitude: 12.9416,
    longitude: 77.5753,
    keywords: ["basavanagudi", "bull temple", "dvg road", "gandhi bazaar"],
  },
  {
    name: "Shivajinagar, Bengaluru",
    displayName: "Shivajinagar",
    latitude: 12.9857,
    longitude: 77.6057,
    keywords: ["shivajinagar", "russell market", "commercial street"],
  },
  {
    name: "Yelahanka, Bengaluru",
    displayName: "Yelahanka",
    latitude: 13.1007,
    longitude: 77.5963,
    keywords: ["yelahanka", "new town", "old town", "air force station"],
  },
  {
    name: "Kengeri, Bengaluru",
    displayName: "Kengeri",
    latitude: 12.9081,
    longitude: 77.4842,
    keywords: ["kengeri", "mysore road", "satellite town"],
  },
];

/**
 * Searches localities matching query string.
 */
export function searchLocalities(query) {
  if (!query || typeof query !== "string") return [];
  const q = query.trim().toLowerCase();
  if (q.length === 0) return BENGALURU_LOCALITIES.slice(0, 8);

  return BENGALURU_LOCALITIES.filter((loc) => {
    if (loc.name.toLowerCase().includes(q)) return true;
    if (loc.displayName.toLowerCase().includes(q)) return true;
    return loc.keywords.some((kw) => kw.includes(q) || q.includes(kw));
  });
}

/**
 * Resolves an address or locality name to latitude and longitude.
 * Priority:
 * 1. Exact or keyword match from local Bengaluru database (instant, 0 network latency)
 * 2. Live geocoding via OpenStreetMap Nominatim API
 * 3. Default Bengaluru center coordinates (12.9716, 77.5946)
 */
export async function resolveAddressToCoordinates(address) {
  if (!address || !address.trim()) {
    return { latitude: 12.9716, longitude: 77.5946, label: "Bengaluru Center" };
  }

  const clean = address.trim().toLowerCase();

  // 1. Check local dictionary
  const matched = BENGALURU_LOCALITIES.find((loc) => {
    if (clean.includes(loc.displayName.toLowerCase())) return true;
    return loc.keywords.some((kw) => clean.includes(kw));
  });

  if (matched) {
    return {
      latitude: matched.latitude,
      longitude: matched.longitude,
      label: matched.name,
      fromDictionary: true,
    };
  }

  // 2. Query Nominatim geocoder
  try {
    const searchQuery = clean.includes("bengaluru") || clean.includes("bangalore")
      ? clean
      : `${clean}, Bengaluru, Karnataka, India`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
      {
        headers: { "Accept-Language": "en" },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          latitude: parseFloat(Number(data[0].lat).toFixed(6)),
          longitude: parseFloat(Number(data[0].lon).toFixed(6)),
          label: data[0].display_name,
          fromGeocoder: true,
        };
      }
    }
  } catch (err) {
    // Geocoder network error or timeout; fallback gracefully
  }

  // 3. Fallback: Central Bengaluru coordinates
  return {
    latitude: 12.9716,
    longitude: 77.5946,
    label: `${address} (Approx. Bengaluru)`,
    fallback: true,
  };
}

/**
 * Calculates distance between two points in km (Haversine formula).
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Finds the nearest known locality for given coordinates.
 */
export function getNearestLocality(latitude, longitude) {
  let nearest = BENGALURU_LOCALITIES[0];
  let minDistance = Infinity;

  for (const loc of BENGALURU_LOCALITIES) {
    const dist = calculateDistanceKm(latitude, longitude, loc.latitude, loc.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = loc;
    }
  }

  return {
    ...nearest,
    distanceKm: minDistance,
  };
}
