/**
 * POST /api/locations/seed
 *
 * Bulk-inserts airports (from backend/lib/seed-data/airports.csv + iata-coords.json),
 * seaports and logistics storage hubs into the `locations` table, skipping
 * any that already exist (matched by name).
 *
 * Protected: requires a valid Bearer token.
 *
 * Schema: id, name, type, latitude, longitude, address, city, country,
 *         description, createdAt, updatedAt  — NO status column.
 */
import path from 'path';
import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { authenticateToken } from '@/lib/middleware';
import { v4 as uuidv4 } from 'uuid';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SeedLocation {
  name: string;
  type: 'airport' | 'seaport' | 'storage';
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  description: string;
}

// ─── CSV airport loader ───────────────────────────────────────────────────────
/**
 * Reads backend/lib/seed-data/airports.csv and iata-coords.json at runtime.
 * Returns one SeedLocation per row that has a known lat/lng.
 */
function loadAirportsFromCsv(): SeedLocation[] {
  const dataDir = path.join(process.cwd(), 'backend', 'lib', 'seed-data');
  const csvPath = path.join(dataDir, 'airports.csv');
  const coordsPath = path.join(dataDir, 'iata-coords.json');

  if (!fs.existsSync(csvPath) || !fs.existsSync(coordsPath)) {
    console.warn('[seed] airports.csv or iata-coords.json not found — skipping CSV airports');
    return [];
  }

  const coords: Record<string, [number, number]> = JSON.parse(
    fs.readFileSync(coordsPath, 'utf8'),
  );

  const csvText = fs.readFileSync(csvPath, 'utf8');
  const lines = csvText.split('\n');

  const airports: SeedLocation[] = [];

  // Skip header row (line 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields: iata,icao,name,"location, with commas",time
    const cols = parseCsvRow(line);
    if (cols.length < 4) continue;

    const iata = cols[0].trim().toUpperCase();
    const name = cols[2].trim();
    const location = cols[3].trim(); // "City, Country"

    if (!iata || !name || iata.length !== 3) continue;

    const latLng = coords[iata];
    if (!latLng) continue; // no coordinates for this code — skip

    // Parse "City, Country" — last segment is the country
    const parts = location.split(',').map((s) => s.trim());
    const country = parts.length > 1 ? parts[parts.length - 1] : location;
    const city = parts.length > 1 ? parts[0] : '';

    airports.push({
      name,
      type: 'airport',
      latitude: latLng[0],
      longitude: latLng[1],
      city,
      country,
      description: `IATA: ${iata}`,
    });
  }

  return airports;
}

/** Minimal CSV row parser that handles double-quoted fields. */
function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── Static seaports & storage hubs ──────────────────────────────────────────
const STATIC_LOCATIONS: SeedLocation[] = [
  // ── SEAPORTS ──────────────────────────────────────────────────────────────
  // Asia-Pacific
  { name: 'Port of Shanghai', type: 'seaport', latitude: 31.3820, longitude: 121.5650, city: 'Shanghai', country: 'China', description: "World's busiest container port (47 M TEU/yr)" },
  { name: 'Port of Singapore', type: 'seaport', latitude: 1.2655, longitude: 103.8197, city: 'Singapore', country: 'Singapore', description: "World's second-largest container port and global transshipment hub" },
  { name: 'Port of Ningbo-Zhoushan', type: 'seaport', latitude: 29.8683, longitude: 121.5500, city: 'Ningbo', country: 'China', description: "World's third-busiest port by TEU" },
  { name: 'Port of Shenzhen (Yantian)', type: 'seaport', latitude: 22.5630, longitude: 114.2641, city: 'Shenzhen', country: 'China', description: 'Major South China export container port' },
  { name: 'Port of Guangzhou', type: 'seaport', latitude: 23.0949, longitude: 113.4278, city: 'Guangzhou', country: 'China', description: 'Pearl River Delta freight hub' },
  { name: 'Port of Qingdao', type: 'seaport', latitude: 36.0587, longitude: 120.3193, city: 'Qingdao', country: 'China', description: 'North China international container gateway' },
  { name: 'Port of Tianjin (Xingang)', type: 'seaport', latitude: 38.9873, longitude: 117.7202, city: 'Tianjin', country: 'China', description: 'Gateway port for Beijing and northern China' },
  { name: 'Port of Busan', type: 'seaport', latitude: 35.1050, longitude: 129.0403, city: 'Busan', country: 'South Korea', description: 'Northeast Asia transshipment hub' },
  { name: 'Port of Hong Kong', type: 'seaport', latitude: 22.2812, longitude: 114.1739, city: 'Hong Kong', country: 'China (SAR)', description: 'Major transshipment and trade finance centre' },
  { name: 'Port of Kaohsiung', type: 'seaport', latitude: 22.6273, longitude: 120.2644, city: 'Kaohsiung', country: 'Taiwan', description: "Taiwan's largest container port" },
  { name: 'Port of Yokohama', type: 'seaport', latitude: 35.4437, longitude: 139.6380, city: 'Yokohama', country: 'Japan', description: 'Tokyo Bay main container port' },
  { name: 'Port of Kobe', type: 'seaport', latitude: 34.6837, longitude: 135.1800, city: 'Kobe', country: 'Japan', description: 'Major Japanese cargo and automotive hub' },
  { name: 'Port of Tokyo', type: 'seaport', latitude: 35.6230, longitude: 139.7749, city: 'Tokyo', country: 'Japan', description: 'Capital city container and RoRo port' },
  { name: 'Port of Tanjung Pelepas', type: 'seaport', latitude: 1.3630, longitude: 103.5558, city: 'Johor Bahru', country: 'Malaysia', description: 'Maersk–MSC transshipment hub' },
  { name: 'Port Klang', type: 'seaport', latitude: 3.0085, longitude: 101.3893, city: 'Klang', country: 'Malaysia', description: "Malaysia's largest seaport" },
  { name: 'Port of Bangkok (Laem Chabang)', type: 'seaport', latitude: 13.0851, longitude: 100.8810, city: 'Laem Chabang', country: 'Thailand', description: "Thailand's largest deep-sea port" },
  { name: 'Port of Jakarta (Tanjung Priok)', type: 'seaport', latitude: -6.1049, longitude: 106.8800, city: 'Jakarta', country: 'Indonesia', description: "Indonesia's busiest container port" },
  { name: 'Port of Manila', type: 'seaport', latitude: 14.5854, longitude: 120.9588, city: 'Manila', country: 'Philippines', description: 'Philippine islands primary container gateway' },
  { name: 'Port of Ho Chi Minh City (Cat Lai)', type: 'seaport', latitude: 10.7543, longitude: 106.7500, city: 'Ho Chi Minh City', country: 'Vietnam', description: "Vietnam's busiest container terminal" },
  { name: 'Port of Colombo', type: 'seaport', latitude: 6.9396, longitude: 79.8432, city: 'Colombo', country: 'Sri Lanka', description: 'South Asia transshipment hub on India–Europe corridor' },
  { name: 'Port of Mumbai (Jawaharlal Nehru)', type: 'seaport', latitude: 18.9500, longitude: 72.8500, city: 'Mumbai', country: 'India', description: "India's largest container port" },
  { name: 'Port of Chennai', type: 'seaport', latitude: 13.0827, longitude: 80.2857, city: 'Chennai', country: 'India', description: 'East India automobile and container port' },
  { name: 'Port of Mundra', type: 'seaport', latitude: 22.8379, longitude: 69.7050, city: 'Mundra', country: 'India', description: "India's largest private port" },

  // Europe
  { name: 'Port of Rotterdam', type: 'seaport', latitude: 51.9225, longitude: 4.4792, city: 'Rotterdam', country: 'Netherlands', description: "Europe's largest port and global logistics gateway" },
  { name: 'Port of Antwerp-Bruges', type: 'seaport', latitude: 51.2390, longitude: 4.4162, city: 'Antwerp', country: 'Belgium', description: "Europe's second-largest port" },
  { name: 'Port of Hamburg', type: 'seaport', latitude: 53.5333, longitude: 9.9833, city: 'Hamburg', country: 'Germany', description: 'Northern Europe container hub (Gateway to Asia)' },
  { name: 'Port of Piraeus', type: 'seaport', latitude: 37.9485, longitude: 23.6395, city: 'Athens', country: 'Greece', description: "Europe's fastest-growing port (COSCO hub)" },
  { name: 'Port of Valencia', type: 'seaport', latitude: 39.4432, longitude: -0.3244, city: 'Valencia', country: 'Spain', description: "Spain's largest container port" },
  { name: 'Port of Algeciras', type: 'seaport', latitude: 36.1408, longitude: -5.4532, city: 'Algeciras', country: 'Spain', description: 'Strait of Gibraltar transshipment hub' },
  { name: 'Port of Barcelona', type: 'seaport', latitude: 41.3465, longitude: 2.1662, city: 'Barcelona', country: 'Spain', description: 'Mediterranean cruise and cargo hub' },
  { name: 'Port of Genoa', type: 'seaport', latitude: 44.4056, longitude: 8.9463, city: 'Genoa', country: 'Italy', description: 'Northern Italy freight gateway' },
  { name: 'Port of Le Havre', type: 'seaport', latitude: 49.4938, longitude: 0.1079, city: 'Le Havre', country: 'France', description: "France's largest container port" },
  { name: 'Port of Felixstowe', type: 'seaport', latitude: 51.9571, longitude: 1.3511, city: 'Felixstowe', country: 'United Kingdom', description: "UK's busiest container port" },
  { name: 'Port of Bremerhaven', type: 'seaport', latitude: 53.5455, longitude: 8.5795, city: 'Bremerhaven', country: 'Germany', description: 'Major European automobile import/export hub' },

  // Middle East & Africa
  { name: 'Port of Jebel Ali', type: 'seaport', latitude: 25.0038, longitude: 55.0628, city: 'Dubai', country: 'UAE', description: "Middle East's largest port and MENA logistics hub" },
  { name: 'Port of Salalah', type: 'seaport', latitude: 17.0186, longitude: 54.0922, city: 'Salalah', country: 'Oman', description: 'Indian Ocean major transshipment hub' },
  { name: 'Suez Canal Container Terminal', type: 'seaport', latitude: 31.2497, longitude: 32.3178, city: 'Port Said', country: 'Egypt', description: 'Suez Canal northern entry point' },
  { name: 'Port of Djibouti', type: 'seaport', latitude: 11.5880, longitude: 43.1455, city: 'Djibouti City', country: 'Djibouti', description: 'Horn of Africa gateway for landlocked East Africa' },
  { name: 'Port of Durban', type: 'seaport', latitude: -29.8673, longitude: 31.0266, city: 'Durban', country: 'South Africa', description: "Africa's busiest container port" },
  { name: 'Port of Cape Town', type: 'seaport', latitude: -33.9062, longitude: 18.4228, city: 'Cape Town', country: 'South Africa', description: 'Cape route container and reefer hub' },
  { name: 'Port of Mombasa', type: 'seaport', latitude: -4.0659, longitude: 39.6633, city: 'Mombasa', country: 'Kenya', description: 'East Africa primary container gateway' },
  { name: 'Port of Lagos (Apapa)', type: 'seaport', latitude: 6.4474, longitude: 3.3903, city: 'Lagos', country: 'Nigeria', description: 'West Africa largest port' },
  { name: 'Port of Casablanca', type: 'seaport', latitude: 33.6038, longitude: -7.6131, city: 'Casablanca', country: 'Morocco', description: 'North Africa largest commercial port' },

  // Americas
  { name: 'Port of Los Angeles', type: 'seaport', latitude: 33.7395, longitude: -118.2730, city: 'Los Angeles', country: 'USA', description: "USA's busiest container port (trans-Pacific gateway)" },
  { name: 'Port of Long Beach', type: 'seaport', latitude: 33.7542, longitude: -118.2165, city: 'Long Beach', country: 'USA', description: "USA's second-busiest container port" },
  { name: 'Port of New York and New Jersey', type: 'seaport', latitude: 40.6892, longitude: -74.0445, city: 'New York', country: 'USA', description: 'US East Coast largest container port' },
  { name: 'Port of Savannah', type: 'seaport', latitude: 32.0350, longitude: -81.1007, city: 'Savannah', country: 'USA', description: 'US South-East Coast fastest-growing container hub' },
  { name: 'Port of Houston', type: 'seaport', latitude: 29.7604, longitude: -95.3698, city: 'Houston', country: 'USA', description: 'US Gulf Coast petrochemical and container hub' },
  { name: 'Port of Seattle-Tacoma', type: 'seaport', latitude: 47.5480, longitude: -122.4342, city: 'Seattle', country: 'USA', description: 'US Pacific Northwest container gateway' },
  { name: 'Port of Vancouver', type: 'seaport', latitude: 49.2965, longitude: -123.1180, city: 'Vancouver', country: 'Canada', description: "Canada's largest port — Asia-Pacific gateway" },
  { name: 'Port of Montreal', type: 'seaport', latitude: 45.5540, longitude: -73.5224, city: 'Montreal', country: 'Canada', description: "Canada's largest inland container port" },
  { name: 'Port of Santos', type: 'seaport', latitude: -23.9629, longitude: -46.3220, city: 'Santos', country: 'Brazil', description: "Latin America's largest port" },
  { name: 'Port of Cartagena', type: 'seaport', latitude: 10.4236, longitude: -75.5485, city: 'Cartagena', country: 'Colombia', description: 'Caribbean transshipment hub' },
  { name: 'Port of Balboa', type: 'seaport', latitude: 8.9667, longitude: -79.5613, city: 'Panama City', country: 'Panama', description: 'Pacific side of the Panama Canal' },
  { name: 'Port of Colon (Cristobal)', type: 'seaport', latitude: 9.3547, longitude: -79.8930, city: 'Colón', country: 'Panama', description: 'Atlantic side of the Panama Canal' },
  { name: 'Port of Valparaíso', type: 'seaport', latitude: -33.0272, longitude: -71.6294, city: 'Valparaíso', country: 'Chile', description: "Chile's main container port" },
  { name: 'Port of Buenos Aires', type: 'seaport', latitude: -34.5989, longitude: -58.3705, city: 'Buenos Aires', country: 'Argentina', description: "Mercosur's main transshipment port" },

  // ── LOGISTICS STORAGE HUBS ─────────────────────────────────────────────────
  { name: 'DHL Global Forwarding Hub — Singapore', type: 'storage', latitude: 1.3190, longitude: 103.9640, city: 'Singapore', country: 'Singapore', description: 'DHL Asia-Pacific air express logistics centre' },
  { name: 'FedEx Asia Pacific Hub — Guangzhou', type: 'storage', latitude: 23.3920, longitude: 113.2990, city: 'Guangzhou', country: 'China', description: 'FedEx primary Asia-Pacific hub' },
  { name: 'UPS Worldport — Louisville', type: 'storage', latitude: 38.1913, longitude: -85.7314, city: 'Louisville', country: 'USA', description: 'UPS global express package sorting mega-hub' },
  { name: 'FedEx World Hub — Memphis', type: 'storage', latitude: 35.0612, longitude: -89.9670, city: 'Memphis', country: 'USA', description: 'FedEx global overnight sorting super-hub' },
  { name: 'Amazon Fulfillment Center — Robbinsville NJ', type: 'storage', latitude: 40.2170, longitude: -74.5690, city: 'Robbinsville', country: 'USA', description: 'Amazon US East Coast mega-fulfillment centre' },
  { name: 'DHL Express Hub — Leipzig', type: 'storage', latitude: 51.4317, longitude: 12.2300, city: 'Leipzig', country: 'Germany', description: 'DHL European express parcel hub' },
  { name: 'Cainiao Global Logistics Hub — Hangzhou', type: 'storage', latitude: 30.2741, longitude: 120.1551, city: 'Hangzhou', country: 'China', description: "Alibaba's Cainiao Network global logistics centre" },
  { name: 'JAFZA Free Zone Warehouse Complex', type: 'storage', latitude: 24.9855, longitude: 55.0693, city: 'Dubai', country: 'UAE', description: 'Jebel Ali Free Zone — largest free zone in the world' },
  { name: 'TNT Express Hub — Liège', type: 'storage', latitude: 50.6410, longitude: 5.4420, city: 'Liège', country: 'Belgium', description: 'FedEx/TNT European sorting hub' },
  { name: 'Changi Airfreight Centre', type: 'storage', latitude: 1.3554, longitude: 103.9896, city: 'Singapore', country: 'Singapore', description: "Singapore's dedicated air cargo ground-handling complex" },
  { name: 'Hong Kong Cargo Terminals (HAS)', type: 'storage', latitude: 22.3244, longitude: 113.9108, city: 'Hong Kong', country: 'China (SAR)', description: "World's largest air cargo terminal complex" },
  { name: 'Rotterdam Maasvlakte Distribution Park', type: 'storage', latitude: 51.9580, longitude: 4.0161, city: 'Rotterdam', country: 'Netherlands', description: 'Europe largest container and distribution logistics zone' },
  { name: 'Incheon Airport Cargo Village', type: 'storage', latitude: 37.4594, longitude: 126.4362, city: 'Incheon', country: 'South Korea', description: 'Korea Air Logistics and Samsung SDC hub' },
  { name: 'Memphis Distribution Center Cluster', type: 'storage', latitude: 35.1270, longitude: -90.0490, city: 'Memphis', country: 'USA', description: "USA mid-south logistics corridor (Nike, Target, AutoZone)" },
];

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const authResult = await authenticateToken(req);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Build full list: CSV airports + static seaports/storage
    const csvAirports = loadAirportsFromCsv();
    const ALL_LOCATIONS = [...csvAirports, ...STATIC_LOCATIONS];

    console.log(`[seed] loaded ${csvAirports.length} airports from CSV, ${STATIC_LOCATIONS.length} seaports/storage`);

    // Fetch existing names to skip duplicates
    const { data: existing, error: fetchErr } = await supabase
      .from('locations')
      .select('name');

    if (fetchErr) {
      console.error('[seed] fetch existing failed:', fetchErr.message);
      return NextResponse.json({ error: 'Could not read existing locations: ' + fetchErr.message }, { status: 500 });
    }

    const existingNames = new Set((existing || []).map((r: any) => r.name));

    const now = new Date().toISOString();

    const toInsert = ALL_LOCATIONS
      .filter((l) => !existingNames.has(l.name))
      .map((l) => ({
        id: uuidv4(),
        name: l.name,
        type: l.type,
        latitude: l.latitude,
        longitude: l.longitude,
        address: '',
        city: l.city,
        country: l.country,
        description: l.description,
        created_at: now,
        updated_at: now,
      }));

    if (toInsert.length === 0) {
      return NextResponse.json({
        success: true,
        inserted: 0,
        skipped: existing?.length ?? 0,
        csvAirports: csvAirports.length,
        message: 'All locations already exist.',
      });
    }

    // Insert in chunks of 25 to stay well under Supabase request limits
    const CHUNK = 25;
    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const { error } = await supabase
        .from('locations')
        .insert(chunk)
        .select('id');

      if (error) {
        console.error(`[seed] chunk ${Math.floor(i / CHUNK) + 1} error:`, error.message, error.details);
        errors.push(`Chunk ${Math.floor(i / CHUNK) + 1}: ${error.message}`);
      } else {
        inserted += chunk.length;
      }
    }

    console.log(`[seed] done: ${inserted} inserted, ${existingNames.size} skipped, ${errors.length} chunk errors`);

    return NextResponse.json({
      success: errors.length === 0 || inserted > 0,
      inserted,
      skipped: existingNames.size,
      total: ALL_LOCATIONS.length,
      csvAirports: csvAirports.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (err: any) {
    console.error('[seed] unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message },
      { status: 500 },
    );
  }
}
