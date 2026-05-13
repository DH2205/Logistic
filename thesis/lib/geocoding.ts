/**
 * Geocoding utilities for converting location names to coordinates
 * Uses Nominatim OpenStreetMap API (free, no API key required)
 */

// Cache for geocoding results to avoid repeated API calls
const geocodeCache: Map<string, { lat: number; lng: number }> = new Map();

// Major airports database (most common ones from order_routes.txt)
export const MAJOR_AIRPORTS: Record<string, { lat: number; lng: number; city?: string }> = {
  // United States (multiple variations)
  "United States": { lat: 37.0902, lng: -95.7129, city: "USA (Center)" },
  "US-United States": { lat: 37.0902, lng: -95.7129, city: "USA (Center)" },
  "USA": { lat: 37.0902, lng: -95.7129, city: "USA (Center)" },
  "US": { lat: 37.0902, lng: -95.7129, city: "USA (Center)" },
  
  // Vietnam
  "Vietnam": { lat: 21.0285, lng: 105.8542, city: "Hanoi" },
  "Viet Nam": { lat: 21.0285, lng: 105.8542, city: "Hanoi" },
  "VN": { lat: 21.0285, lng: 105.8542, city: "Hanoi" },
  
  // China (multiple variations)
  "China": { lat: 39.9042, lng: 116.4074, city: "Beijing" },
  "China (Excluding China South)": { lat: 39.9042, lng: 116.4074, city: "Beijing" },
  "China South": { lat: 23.1291, lng: 113.2644, city: "Guangzhou" },
  "CN": { lat: 39.9042, lng: 116.4074, city: "Beijing" },
  
  // Europe
  "Italy": { lat: 41.9028, lng: 12.4964, city: "Rome" },
  "IT": { lat: 41.9028, lng: 12.4964, city: "Rome" },
  "Belarus": { lat: 53.9045, lng: 27.5615, city: "Minsk" },
  "BY": { lat: 53.9045, lng: 27.5615, city: "Minsk" },
  "United Kingdom": { lat: 51.5074, lng: -0.1278, city: "London" },
  "UK": { lat: 51.5074, lng: -0.1278, city: "London" },
  "GB": { lat: 51.5074, lng: -0.1278, city: "London" },
  "France": { lat: 48.8566, lng: 2.3522, city: "Paris" },
  "FR": { lat: 48.8566, lng: 2.3522, city: "Paris" },
  "Germany": { lat: 52.5200, lng: 13.4050, city: "Berlin" },
  "DE": { lat: 52.5200, lng: 13.4050, city: "Berlin" },
  "Netherlands": { lat: 52.3676, lng: 4.9041, city: "Amsterdam" },
  "NL": { lat: 52.3676, lng: 4.9041, city: "Amsterdam" },
  "Spain": { lat: 40.4168, lng: -3.7038, city: "Madrid" },
  "ES": { lat: 40.4168, lng: -3.7038, city: "Madrid" },
  "Poland": { lat: 52.2297, lng: 21.0122, city: "Warsaw" },
  "PL": { lat: 52.2297, lng: 21.0122, city: "Warsaw" },
  "Russia": { lat: 55.7558, lng: 37.6173, city: "Moscow" },
  "RU": { lat: 55.7558, lng: 37.6173, city: "Moscow" },
  
  // Middle East
  "Bahrain": { lat: 26.0667, lng: 50.5577, city: "Manama" },
  "BH": { lat: 26.0667, lng: 50.5577, city: "Manama" },
  "UAE": { lat: 25.2048, lng: 55.2708, city: "Dubai" },
  "United Arab Emirates": { lat: 25.2048, lng: 55.2708, city: "Dubai" },
  "AE": { lat: 25.2048, lng: 55.2708, city: "Dubai" },
  "Saudi Arabia": { lat: 24.7136, lng: 46.6753, city: "Riyadh" },
  "SA": { lat: 24.7136, lng: 46.6753, city: "Riyadh" },
  "Israel": { lat: 32.0853, lng: 34.7818, city: "Tel Aviv" },
  "IL": { lat: 32.0853, lng: 34.7818, city: "Tel Aviv" },
  "Turkey": { lat: 41.0082, lng: 28.9784, city: "Istanbul" },
  "TR": { lat: 41.0082, lng: 28.9784, city: "Istanbul" },
  "Iran": { lat: 35.6892, lng: 51.3890, city: "Tehran" },
  "IR": { lat: 35.6892, lng: 51.3890, city: "Tehran" },
  "Qatar": { lat: 25.2854, lng: 51.5310, city: "Doha" },
  "QA": { lat: 25.2854, lng: 51.5310, city: "Doha" },
  
  // Africa
  "Mali": { lat: 12.6392, lng: -8.0029, city: "Bamako" },
  "ML": { lat: 12.6392, lng: -8.0029, city: "Bamako" },
  "South Africa": { lat: -33.9249, lng: 18.4241, city: "Cape Town" },
  "ZA": { lat: -33.9249, lng: 18.4241, city: "Cape Town" },
  "Egypt": { lat: 30.0444, lng: 31.2357, city: "Cairo" },
  "EG": { lat: 30.0444, lng: 31.2357, city: "Cairo" },
  "Nigeria": { lat: 9.0765, lng: 7.3986, city: "Abuja" },
  "NG": { lat: 9.0765, lng: 7.3986, city: "Abuja" },
  "Kenya": { lat: -1.2921, lng: 36.8219, city: "Nairobi" },
  "KE": { lat: -1.2921, lng: 36.8219, city: "Nairobi" },
  "Morocco": { lat: 33.5731, lng: -7.5898, city: "Casablanca" },
  "MA": { lat: 33.5731, lng: -7.5898, city: "Casablanca" },
  
  // Asia-Pacific
  "Australia": { lat: -33.8688, lng: 151.2093, city: "Sydney" },
  "AU": { lat: -33.8688, lng: 151.2093, city: "Sydney" },
  "South Korea": { lat: 37.5665, lng: 126.9780, city: "Seoul" },
  "Korea": { lat: 37.5665, lng: 126.9780, city: "Seoul" },
  "KR": { lat: 37.5665, lng: 126.9780, city: "Seoul" },
  "Japan": { lat: 35.6762, lng: 139.6503, city: "Tokyo" },
  "JP": { lat: 35.6762, lng: 139.6503, city: "Tokyo" },
  "Singapore": { lat: 1.3521, lng: 103.8198, city: "Singapore" },
  "SG": { lat: 1.3521, lng: 103.8198, city: "Singapore" },
  "Thailand": { lat: 13.7563, lng: 100.5018, city: "Bangkok" },
  "TH": { lat: 13.7563, lng: 100.5018, city: "Bangkok" },
  "Malaysia": { lat: 3.1390, lng: 101.6869, city: "Kuala Lumpur" },
  "MY": { lat: 3.1390, lng: 101.6869, city: "Kuala Lumpur" },
  "Indonesia": { lat: -6.2088, lng: 106.8456, city: "Jakarta" },
  "ID": { lat: -6.2088, lng: 106.8456, city: "Jakarta" },
  "Philippines": { lat: 14.5995, lng: 120.9842, city: "Manila" },
  "PH": { lat: 14.5995, lng: 120.9842, city: "Manila" },
  "India": { lat: 28.6139, lng: 77.2090, city: "New Delhi" },
  "IN": { lat: 28.6139, lng: 77.2090, city: "New Delhi" },
  "Pakistan": { lat: 33.6844, lng: 73.0479, city: "Islamabad" },
  "PK": { lat: 33.6844, lng: 73.0479, city: "Islamabad" },
  "Bangladesh": { lat: 23.8103, lng: 90.4125, city: "Dhaka" },
  "BD": { lat: 23.8103, lng: 90.4125, city: "Dhaka" },
  "Sri Lanka": { lat: 6.9271, lng: 79.8612, city: "Colombo" },
  "LK": { lat: 6.9271, lng: 79.8612, city: "Colombo" },
  "Taiwan": { lat: 25.0330, lng: 121.5654, city: "Taipei" },
  "TW": { lat: 25.0330, lng: 121.5654, city: "Taipei" },
  "Hong Kong": { lat: 22.3193, lng: 114.1694, city: "Hong Kong" },
  "HK": { lat: 22.3193, lng: 114.1694, city: "Hong Kong" },
  
  // Americas
  "Mexico": { lat: 19.4326, lng: -99.1332, city: "Mexico City" },
  "MX": { lat: 19.4326, lng: -99.1332, city: "Mexico City" },
  "Canada": { lat: 45.4215, lng: -75.6972, city: "Ottawa" },
  "CA": { lat: 45.4215, lng: -75.6972, city: "Ottawa" },
  "Brazil": { lat: -23.5505, lng: -46.6333, city: "São Paulo" },
  "BR": { lat: -23.5505, lng: -46.6333, city: "São Paulo" },
  "Argentina": { lat: -34.6037, lng: -58.3816, city: "Buenos Aires" },
  "AR": { lat: -34.6037, lng: -58.3816, city: "Buenos Aires" },
  "Chile": { lat: -33.4489, lng: -70.6693, city: "Santiago" },
  "CL": { lat: -33.4489, lng: -70.6693, city: "Santiago" },
  "Colombia": { lat: 4.7110, lng: -74.0721, city: "Bogotá" },
  "CO": { lat: 4.7110, lng: -74.0721, city: "Bogotá" },
  "Peru": { lat: -12.0464, lng: -77.0428, city: "Lima" },
  "PE": { lat: -12.0464, lng: -77.0428, city: "Lima" },
  
  // Oceania
  "New Zealand": { lat: -36.8485, lng: 174.7633, city: "Auckland" },
  "NZ": { lat: -36.8485, lng: 174.7633, city: "Auckland" },
  "Fiji": { lat: -18.1416, lng: 178.4419, city: "Suva" },
  "FJ": { lat: -18.1416, lng: 178.4419, city: "Suva" },
};

/**
 * Get coordinates for a location (country or city)
 * First checks MAJOR_AIRPORTS cache, then falls back to Nominatim API
 */
export async function geocodeLocation(locationName: string): Promise<{ lat: number; lng: number } | null> {
  if (!locationName) return null;
  
  const normalized = locationName.trim();
  
  // Check cache first
  if (geocodeCache.has(normalized)) {
    return geocodeCache.get(normalized)!;
  }
  
  // Check major airports database
  if (MAJOR_AIRPORTS[normalized]) {
    const coords = { lat: MAJOR_AIRPORTS[normalized].lat, lng: MAJOR_AIRPORTS[normalized].lng };
    geocodeCache.set(normalized, coords);
    return coords;
  }
  
  // Handle UPS location format: "CITY, STATE, CC" or "CITY, CC"
  // UPS always puts the 2-letter country code last, so parse it directly.
  const parts = normalized.split(',').map((p) => p.trim());
  if (parts.length >= 2) {
    const cc = parts[parts.length - 1].toUpperCase();
    if (MAJOR_AIRPORTS[cc]) {
      const coords = { lat: MAJOR_AIRPORTS[cc].lat, lng: MAJOR_AIRPORTS[cc].lng };
      geocodeCache.set(normalized, coords);
      console.log(`[Geocoding] UPS CC "${cc}" resolved from "${normalized}"`);
      return coords;
    }
  }

  // Fuzzy fallback: look for a partial substring match in either direction
  const normalizedLower = normalized.toLowerCase();
  for (const [key, value] of Object.entries(MAJOR_AIRPORTS)) {
    const keyLower = key.toLowerCase();
    // Only match if the key is reasonably long (≥3 chars) to avoid accidental hits
    if (
      key.length >= 3 &&
      (keyLower.includes(normalizedLower) || normalizedLower.includes(keyLower))
    ) {
      const coords = { lat: value.lat, lng: value.lng };
      geocodeCache.set(normalized, coords);
      console.log(`[Geocoding] Fuzzy matched "${normalized}" to "${key}"`);
      return coords;
    }
  }

  // Skip external API calls for now (to avoid CORS/network issues)
  // In production, you would implement server-side geocoding via an API route
  console.warn(`[Geocoding] Location "${normalized}" not found in MAJOR_AIRPORTS database. Skipping external API.`);
  return null;
  
  /* 
  // Fallback to Nominatim API (disabled to avoid CORS issues)
  // To enable: implement server-side geocoding via /api/geocode endpoint
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(normalized)}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'LogisticsApp/1.0',
        },
      }
    );
    
    if (!response.ok) {
      console.warn(`Geocoding failed for "${normalized}": ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const coords = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
      geocodeCache.set(normalized, coords);
      return coords;
    }
  } catch (error) {
    console.error(`Error geocoding "${normalized}":`, error);
  }
  
  return null;
  */
}

/**
 * Geocode multiple locations in batches (respects rate limits)
 */
export async function geocodeLocationsBatch(
  locations: string[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, { lat: number; lng: number }>> {
  const results = new Map<string, { lat: number; lng: number }>();
  const uniqueLocations = [...new Set(locations)];
  
  for (let i = 0; i < uniqueLocations.length; i++) {
    const location = uniqueLocations[i];
    const coords = await geocodeLocation(location);
    
    if (coords) {
      results.set(location, coords);
    }
    
    if (onProgress) {
      onProgress(i + 1, uniqueLocations.length);
    }
    
    // Rate limit: 1 request/second for Nominatim
    if (i < uniqueLocations.length - 1 && !MAJOR_AIRPORTS[location]) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

/**
 * Check if a location exists in our major airports database
 */
export function isMajorAirport(locationName: string): boolean {
  return locationName in MAJOR_AIRPORTS;
}

/**
 * Get all major airport names
 */
export function getAllMajorAirportNames(): string[] {
  return Object.keys(MAJOR_AIRPORTS);
}
