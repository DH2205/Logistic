/**
 * Disruption-Aware Route Router
 *
 * Builds a global logistics hub graph, then runs Dijkstra's shortest-path
 * algorithm while blocking / penalising edges that pass through active
 * disruption zones (wars, natural disasters, storms, sanctions …).
 *
 * Public surface:
 *   findReroute(fromLat, fromLng, toLat, toLng, disruptions)  → waypoints[]
 *   regionToBbox(regionString)  → BBox | null
 *   LOGISTICS_HUBS              → all known hubs (for rendering)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface Hub {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'airport' | 'seaport' | 'storage';
}

export interface RouteEdge {
  from: string;
  to: string;
  distanceKm: number;
  mode: 'air' | 'sea' | 'land';
}

export type DisruptionType =
  | 'port_closure'
  | 'conflict_zone'
  | 'storm'
  | 'congestion'
  | 'airspace_closure'
  | 'sea_lane_closure';

export interface DisruptionZoneInput {
  id: string;
  name: string;
  bbox: BBox;
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Optional. If absent, inferred from `name` via inferDisruptionType. */
  type?: DisruptionType;
  /** Optional free-text used as an additional source for type inference. */
  description?: string;
}

export interface RouteWaypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export type RerouteStatus = 'ok' | 'rerouted' | 'no_safe_route';

export interface RerouteResult {
  waypoints: RouteWaypoint[];
  totalDistanceKm: number;
  blocked: boolean; // true if the original direct route was blocked
  /** Composite logistics score (lower is better). May be Infinity for no_safe_route. */
  score?: number;
  status?: RerouteStatus;
  /** Name of the originally-nearest destination hub (may equal selectedGateway). */
  originalGateway?: string;
  /** Name of the hub the route actually terminates at after substitution. */
  selectedGateway?: string;
  /** Disruption names that caused gateway substitution / edge blocking. */
  blockedBy?: string[];
  /** Human-readable explanation of the routing decision. */
  reasons?: string[];
  /** Soft warnings (e.g. inland transfer needed). */
  warnings?: string[];
  /** Candidate gateways that were tried but rejected. */
  rejectedRoutes?: Array<{ gateway: string; reason: string }>;
  /** Other valid gateways with their scores (best first, selected one excluded). */
  alternatives?: Array<{ gateway: string; score: number }>;
  metrics?: {
    execMs: number;
    nodeCount: number;
    edgeCount: number;
    disruptionCount: number;
    directDistanceKm: number;
    detourKm: number;
    detourPct: number;
    routeFound: boolean;
    hopCount: number;
    /** Next longer feasible hub-route length (deviation-path approximation), if any */
    secondBestHubKm?: number;
    /** Kilometres saved vs that second-best feasible route (0 if only one distinct route exists) */
    distanceSavedVsSecondBestKm?: number;
  };
}

export interface FindRerouteOptions {
  hubs?: Hub[];
  edges?: RouteEdge[];
  logMetrics?: boolean;
  /** If true, compute a longer alternative feasible path when possible (for DSS “optimisation gain”) */
  includeSecondBest?: boolean;
}

// ─── Hub graph ───────────────────────────────────────────────────────────────

export const LOGISTICS_HUBS: Hub[] = [
  // Southeast Asia
  { id: 'SG',     name: 'Singapore',        lat:   1.35, lng: 103.82, type: 'seaport'  },
  { id: 'MY',     name: 'Kuala Lumpur',     lat:   3.14, lng: 101.69, type: 'airport'  },
  { id: 'TH',     name: 'Bangkok',          lat:  13.76, lng: 100.50, type: 'airport'  },
  { id: 'VN',     name: 'Ho Chi Minh City', lat:  10.82, lng: 106.63, type: 'airport'  },
  { id: 'PH',     name: 'Manila',           lat:  14.60, lng: 120.98, type: 'seaport'  },
  { id: 'ID',     name: 'Jakarta',          lat:  -6.21, lng: 106.85, type: 'seaport'  },
  // East Asia
  { id: 'HK',     name: 'Hong Kong',        lat:  22.32, lng: 114.17, type: 'seaport'  },
  { id: 'CN',     name: 'Shanghai',         lat:  31.23, lng: 121.47, type: 'seaport'  },
  { id: 'CN2',    name: 'Beijing',          lat:  39.90, lng: 116.41, type: 'airport'  },
  { id: 'JP',     name: 'Tokyo',            lat:  35.68, lng: 139.65, type: 'seaport'  },
  { id: 'KR',     name: 'Seoul',            lat:  37.57, lng: 126.98, type: 'airport'  },
  { id: 'TW',     name: 'Taipei',           lat:  25.03, lng: 121.57, type: 'airport'  },
  // Oceania
  { id: 'AU',     name: 'Sydney',           lat: -33.87, lng: 151.21, type: 'seaport'  },
  // South Asia
  { id: 'IN',     name: 'Mumbai',           lat:  18.92, lng:  72.83, type: 'seaport'  },
  { id: 'IN2',    name: 'Delhi',            lat:  28.61, lng:  77.21, type: 'airport'  },
  { id: 'LK',     name: 'Colombo',          lat:   6.93, lng:  79.86, type: 'seaport'  },
  { id: 'PK',     name: 'Karachi',          lat:  24.86, lng:  67.00, type: 'seaport'  },
  // ⚠️ CONFLICT-ZONE hubs (blocked when war disruption is active)
  { id: 'AE',     name: 'Dubai',            lat:  25.20, lng:  55.27, type: 'seaport'  },
  { id: 'SA',     name: 'Riyadh',           lat:  24.71, lng:  46.68, type: 'airport'  },
  { id: 'IR',     name: 'Tehran',           lat:  35.69, lng:  51.39, type: 'airport'  },
  { id: 'IQ',     name: 'Baghdad',          lat:  33.34, lng:  44.36, type: 'airport'  },
  // East Africa & Horn
  { id: 'DJ',     name: 'Djibouti',         lat:  11.59, lng:  43.15, type: 'seaport'  },
  { id: 'KE',     name: 'Nairobi',          lat:  -1.29, lng:  36.82, type: 'airport'  },
  { id: 'TZ',     name: 'Dar es Salaam',    lat:  -6.79, lng:  39.21, type: 'seaport'  },
  // North Africa & Med
  { id: 'EG',     name: 'Cairo / Suez',     lat:  30.04, lng:  31.24, type: 'seaport'  },
  { id: 'MA',     name: 'Casablanca',       lat:  33.57, lng:  -7.59, type: 'seaport'  },
  // Southern Africa
  { id: 'ZA',     name: 'Cape Town',        lat: -33.92, lng:  18.42, type: 'seaport'  },
  // Europe
  { id: 'TR',     name: 'Istanbul',         lat:  41.01, lng:  28.98, type: 'seaport'  },
  { id: 'IT',     name: 'Rome / Genoa',     lat:  41.90, lng:  12.50, type: 'seaport'  },
  { id: 'ES',     name: 'Barcelona',        lat:  41.39, lng:   2.17, type: 'seaport'  },
  { id: 'FR',     name: 'Paris / Le Havre', lat:  48.86, lng:   2.35, type: 'seaport'  },
  { id: 'NL',     name: 'Rotterdam',        lat:  51.92, lng:   4.48, type: 'seaport'  },
  { id: 'DE',     name: 'Frankfurt / Hamburg', lat: 50.11, lng: 8.68, type: 'airport'  },
  { id: 'GB',     name: 'London / Felixstowe', lat: 51.51, lng: -0.13, type: 'seaport' },
  { id: 'PL',     name: 'Warsaw / Gdańsk',  lat:  52.23, lng:  21.01, type: 'airport'  },
  // North America
  { id: 'US_NY',  name: 'New York / New Jersey', lat: 40.71, lng: -74.01, type: 'seaport' },
  { id: 'US_LA',  name: 'Los Angeles',      lat:  34.05, lng:-118.24, type: 'seaport'  },
  { id: 'US_LGB', name: 'Long Beach',       lat:  33.77, lng:-118.19, type: 'seaport'  },
  { id: 'US_OAK', name: 'Oakland / San Francisco', lat: 37.80, lng:-122.27, type: 'seaport' },
  { id: 'US_SEA', name: 'Seattle / Tacoma', lat:  47.61, lng:-122.33, type: 'seaport'  },
  { id: 'US_HOU', name: 'Houston',          lat:  29.76, lng: -95.37, type: 'seaport'  },
  { id: 'US_SAV', name: 'Savannah',         lat:  32.08, lng: -81.09, type: 'seaport'  },
  { id: 'US_MIA', name: 'Miami',            lat:  25.77, lng: -80.19, type: 'seaport'  },
  { id: 'US_CH',  name: 'Chicago',          lat:  41.88, lng: -87.63, type: 'airport'  },
  { id: 'CA',     name: 'Toronto / Vancouver', lat: 43.65, lng: -79.38, type: 'airport' },
  { id: 'US_VAN', name: 'Vancouver',        lat:  49.28, lng:-123.12, type: 'seaport'  },
  { id: 'MX',     name: 'Mexico City',      lat:  19.43, lng: -99.13, type: 'airport'  },
  // South America
  { id: 'BR',     name: 'São Paulo / Santos', lat: -23.55, lng: -46.63, type: 'seaport' },
  { id: 'CO',     name: 'Bogotá / Cartagena', lat:  4.71, lng: -74.07, type: 'seaport' },
];

// Edges — bidirectional; distanceKm is great-circle approximation
export const RAW_EDGES: RouteEdge[] = [
  // ── Southeast Asia ──
  { from: 'SG',  to: 'MY',    distanceKm:  350, mode: 'land' },
  { from: 'SG',  to: 'ID',    distanceKm:  900, mode: 'sea'  },
  { from: 'SG',  to: 'TH',    distanceKm: 1400, mode: 'air'  },
  { from: 'SG',  to: 'VN',    distanceKm: 1150, mode: 'sea'  },
  { from: 'SG',  to: 'PH',    distanceKm: 2400, mode: 'sea'  },
  { from: 'SG',  to: 'HK',    distanceKm: 2600, mode: 'sea'  },
  { from: 'SG',  to: 'IN',    distanceKm: 4400, mode: 'sea'  },
  { from: 'SG',  to: 'LK',    distanceKm: 2400, mode: 'sea'  },
  { from: 'SG',  to: 'AU',    distanceKm: 6300, mode: 'sea'  },
  { from: 'TH',  to: 'VN',    distanceKm:  900, mode: 'land' },
  { from: 'TH',  to: 'IN',    distanceKm: 3000, mode: 'air'  },
  { from: 'MY',  to: 'ID',    distanceKm:  500, mode: 'sea'  },
  // ── East Asia ──
  { from: 'HK',  to: 'CN',    distanceKm: 1200, mode: 'sea'  },
  { from: 'HK',  to: 'JP',    distanceKm: 2900, mode: 'sea'  },
  { from: 'HK',  to: 'KR',    distanceKm: 2000, mode: 'sea'  },
  { from: 'HK',  to: 'TW',    distanceKm:  750, mode: 'sea'  },
  { from: 'CN',  to: 'JP',    distanceKm: 1850, mode: 'sea'  },
  { from: 'CN',  to: 'KR',    distanceKm:  900, mode: 'sea'  },
  { from: 'CN2', to: 'CN',    distanceKm: 1100, mode: 'air'  },
  { from: 'CN2', to: 'KR',    distanceKm:  950, mode: 'air'  },
  { from: 'JP',  to: 'KR',    distanceKm:  950, mode: 'sea'  },
  { from: 'HK',  to: 'US_LA', distanceKm: 9300, mode: 'air'  }, // direct Trans-Pacific air
  { from: 'HK',  to: 'US_NY', distanceKm:13100, mode: 'air'  }, // direct Trans-Pacific to East Coast
  { from: 'JP',  to: 'US_LA', distanceKm: 8750, mode: 'sea'  },
  { from: 'JP',  to: 'US_NY', distanceKm:10800, mode: 'air'  }, // polar route JP → US East
  { from: 'KR',  to: 'US_LA', distanceKm: 9200, mode: 'sea'  },
  { from: 'CN',  to: 'US_LA', distanceKm:10400, mode: 'sea'  },
  // ── Trans-Pacific to alternative US West Coast gateways ──
  { from: 'HK',  to: 'US_SEA', distanceKm:10300, mode: 'sea' },
  { from: 'HK',  to: 'US_OAK', distanceKm: 9900, mode: 'sea' },
  { from: 'JP',  to: 'US_SEA', distanceKm: 7700, mode: 'sea' },
  { from: 'JP',  to: 'US_OAK', distanceKm: 8300, mode: 'sea' },
  { from: 'KR',  to: 'US_SEA', distanceKm: 8200, mode: 'sea' },
  { from: 'CN',  to: 'US_SEA', distanceKm: 9100, mode: 'sea' },
  { from: 'CN',  to: 'US_OAK', distanceKm: 9700, mode: 'sea' },
  { from: 'JP',  to: 'US_VAN', distanceKm: 7600, mode: 'sea' },
  { from: 'HK',  to: 'US_VAN', distanceKm:10200, mode: 'sea' },
  { from: 'AU',  to: 'JP',    distanceKm: 7800, mode: 'sea'  },
  { from: 'AU',  to: 'US_LA', distanceKm:12100, mode: 'sea'  },
  { from: 'AU',  to: 'ZA',    distanceKm: 8400, mode: 'sea'  }, // Cape of Good Hope bypass route
  // ── South Asia ──
  { from: 'IN',  to: 'LK',    distanceKm: 1400, mode: 'sea'  },
  { from: 'IN',  to: 'PK',    distanceKm: 1000, mode: 'land' },
  { from: 'IN',  to: 'IN2',   distanceKm: 1400, mode: 'air'  },
  { from: 'IN',  to: 'DJ',    distanceKm: 3700, mode: 'sea'  },
  { from: 'LK',  to: 'DJ',    distanceKm: 3200, mode: 'sea'  },
  { from: 'PK',  to: 'IN2',   distanceKm: 1000, mode: 'land' },
  // ── Southern Indian Ocean bypass (stays below 8°N — avoids Arabian Sea zone) ──
  // Arc from Colombo to Nairobi dips to ~2°N, safely south of the Arabian Sea zone
  { from: 'LK',  to: 'KE',    distanceKm: 4000, mode: 'sea'  },
  // Arc from Colombo to Dar es Salaam — alternative East Africa landfall
  { from: 'LK',  to: 'TZ',    distanceKm: 3500, mode: 'sea'  },
  // Mumbai to Dar es Salaam — skirts south of Arabian Sea when storms push north
  { from: 'IN',  to: 'TZ',    distanceKm: 4600, mode: 'sea'  },
  // Dar es Salaam northward connections
  { from: 'TZ',  to: 'DJ',    distanceKm: 1500, mode: 'sea'  },
  { from: 'TZ',  to: 'KE',    distanceKm:  600, mode: 'land' },
  // ── Gulf — CONFLICT ZONE edges ──
  { from: 'IN',  to: 'AE',    distanceKm: 2200, mode: 'sea'  },
  { from: 'PK',  to: 'AE',    distanceKm: 1500, mode: 'sea'  },
  { from: 'AE',  to: 'IR',    distanceKm: 1800, mode: 'air'  },
  { from: 'AE',  to: 'SA',    distanceKm: 1100, mode: 'land' },
  { from: 'AE',  to: 'IQ',    distanceKm: 1200, mode: 'land' },
  { from: 'AE',  to: 'EG',    distanceKm: 2400, mode: 'sea'  },
  { from: 'SA',  to: 'EG',    distanceKm: 2000, mode: 'sea'  },
  { from: 'SA',  to: 'IQ',    distanceKm: 1100, mode: 'land' },
  { from: 'IR',  to: 'TR',    distanceKm: 2000, mode: 'land' },
  { from: 'IR',  to: 'IQ',    distanceKm:  900, mode: 'land' },
  { from: 'IQ',  to: 'TR',    distanceKm: 1300, mode: 'land' },
  { from: 'PK',  to: 'IR',    distanceKm: 1500, mode: 'land' },
  { from: 'IN2', to: 'IR',    distanceKm: 2400, mode: 'air'  },
  // ── East Africa & Red Sea (safe bypass) ──
  { from: 'DJ',  to: 'EG',    distanceKm: 2100, mode: 'sea'  }, // Red Sea route
  { from: 'DJ',  to: 'KE',    distanceKm:  900, mode: 'air'  },
  { from: 'DJ',  to: 'TZ',    distanceKm: 1500, mode: 'sea'  },
  { from: 'KE',  to: 'TZ',    distanceKm:  600, mode: 'land' },
  { from: 'KE',  to: 'ZA',    distanceKm: 4200, mode: 'sea'  },
  { from: 'TZ',  to: 'ZA',    distanceKm: 3700, mode: 'sea'  },
  { from: 'ZA',  to: 'MA',    distanceKm: 7000, mode: 'sea'  }, // Cape of Good Hope bypass
  { from: 'ZA',  to: 'BR',    distanceKm: 6800, mode: 'sea'  },
  // ── Mediterranean ──
  { from: 'EG',  to: 'IT',    distanceKm: 2200, mode: 'sea'  },
  { from: 'EG',  to: 'TR',    distanceKm: 2200, mode: 'air'  },
  { from: 'TR',  to: 'IT',    distanceKm: 1900, mode: 'sea'  },
  { from: 'TR',  to: 'DE',    distanceKm: 2000, mode: 'air'  },
  { from: 'TR',  to: 'PL',    distanceKm: 1800, mode: 'air'  },
  { from: 'IT',  to: 'FR',    distanceKm: 1100, mode: 'sea'  },
  { from: 'IT',  to: 'DE',    distanceKm: 1100, mode: 'land' },
  { from: 'IT',  to: 'ES',    distanceKm: 1400, mode: 'sea'  },
  { from: 'IT',  to: 'GB',    distanceKm: 1800, mode: 'air'  },
  { from: 'ES',  to: 'MA',    distanceKm:  900, mode: 'sea'  },
  { from: 'ES',  to: 'FR',    distanceKm: 1000, mode: 'land' },
  { from: 'MA',  to: 'GB',    distanceKm: 2200, mode: 'sea'  },
  { from: 'MA',  to: 'FR',    distanceKm: 2100, mode: 'sea'  },
  { from: 'MA',  to: 'BR',    distanceKm: 6200, mode: 'sea'  },
  // ── Western Europe ──
  { from: 'DE',  to: 'GB',    distanceKm:  900, mode: 'air'  },
  { from: 'DE',  to: 'NL',    distanceKm:  250, mode: 'land' },
  { from: 'DE',  to: 'FR',    distanceKm:  500, mode: 'land' },
  { from: 'DE',  to: 'PL',    distanceKm:  600, mode: 'land' },
  { from: 'FR',  to: 'GB',    distanceKm:  450, mode: 'sea'  },
  { from: 'FR',  to: 'ES',    distanceKm: 1000, mode: 'land' },
  { from: 'NL',  to: 'GB',    distanceKm:  500, mode: 'sea'  },
  // ── Trans-Atlantic ──
  { from: 'GB',  to: 'US_NY', distanceKm: 5600, mode: 'sea'  },
  { from: 'FR',  to: 'US_NY', distanceKm: 5800, mode: 'sea'  },
  { from: 'MA',  to: 'US_NY', distanceKm: 6000, mode: 'sea'  },
  // ── North America ──
  { from: 'US_LA', to: 'US_NY', distanceKm: 4500, mode: 'air' },
  { from: 'US_NY', to: 'CA',    distanceKm:  800, mode: 'air' },
  { from: 'US_LA', to: 'CA',    distanceKm: 3500, mode: 'air' },
  { from: 'US_NY', to: 'US_CH', distanceKm: 1200, mode: 'air' },
  { from: 'US_NY', to: 'MX',    distanceKm: 3400, mode: 'air' },
  { from: 'US_LA', to: 'MX',    distanceKm: 2800, mode: 'air' },
  { from: 'CA',    to: 'US_CH', distanceKm: 1500, mode: 'air' },
  // ── Additional US gateway connectivity (intra-US) ──
  { from: 'US_LA',  to: 'US_LGB', distanceKm:   35, mode: 'land' },
  { from: 'US_OAK', to: 'US_LA',  distanceKm:  600, mode: 'land' },
  { from: 'US_SEA', to: 'US_OAK', distanceKm: 1100, mode: 'land' },
  { from: 'US_SEA', to: 'US_LA',  distanceKm: 1900, mode: 'land' },
  { from: 'US_VAN', to: 'US_SEA', distanceKm:  230, mode: 'land' },
  { from: 'US_VAN', to: 'CA',     distanceKm: 3400, mode: 'air'  },
  { from: 'US_SEA', to: 'US_CH',  distanceKm: 2800, mode: 'air'  },
  { from: 'US_OAK', to: 'US_CH',  distanceKm: 3000, mode: 'air'  },
  { from: 'US_LA',  to: 'US_HOU', distanceKm: 2200, mode: 'land' },
  { from: 'US_HOU', to: 'US_SAV', distanceKm: 1400, mode: 'land' },
  { from: 'US_HOU', to: 'US_CH',  distanceKm: 1500, mode: 'air'  },
  { from: 'US_SAV', to: 'US_NY',  distanceKm: 1200, mode: 'land' },
  { from: 'US_SAV', to: 'US_MIA', distanceKm:  700, mode: 'land' },
  { from: 'US_NY',  to: 'US_MIA', distanceKm: 2050, mode: 'sea'  },
  // Trans-Atlantic to alternative US East Coast gateways
  { from: 'GB',     to: 'US_SAV', distanceKm: 6500, mode: 'sea'  },
  { from: 'NL',     to: 'US_NY',  distanceKm: 5900, mode: 'sea'  },
  // ── South America ──
  { from: 'BR',    to: 'US_NY', distanceKm: 7700, mode: 'sea' },
  { from: 'BR',    to: 'FR',    distanceKm: 8500, mode: 'sea' },
  { from: 'BR',    to: 'CO',    distanceKm: 4000, mode: 'sea' },
  { from: 'CO',    to: 'MX',    distanceKm: 2800, mode: 'sea' },
  { from: 'CO',    to: 'US_NY', distanceKm: 4100, mode: 'sea' },
];

// ─── Region → Bounding Box lookup ───────────────────────────────────────────

const REGION_BBOX_LOOKUP: [string, BBox][] = [
  ['iran',           { north: 39.8, south: 25.1, east: 63.3, west: 44.0 }],
  ['persian gulf',   { north: 30.5, south: 23.0, east: 57.0, west: 47.0 }],
  ['gulf of oman',   { north: 26.0, south: 21.5, east: 60.5, west: 56.0 }],
  ['arabian sea',    { north: 25.0, south:  8.0, east: 68.0, west: 51.0 }], // east:68 keeps Mumbai (72.8°E) outside
  ['middle east',    { north: 42.0, south: 12.0, east: 65.0, west: 25.0 }],
  ['red sea',        { north: 30.0, south: 12.0, east: 44.0, west: 32.0 }],
  ['ukraine',        { north: 52.4, south: 44.4, east: 40.2, west: 22.1 }],
  ['russia',         { north: 72.0, south: 41.0, east: 180.0, west: 19.0 }],
  ['taiwan strait',  { north: 27.0, south: 21.0, east: 121.5, west: 118.0 }],
  ['south china sea',{ north: 25.0, south:  3.0, east: 120.0, west: 105.0 }],
  ['horn of africa', { north: 15.0, south:  4.0, east: 52.0, west: 39.0 }],
  ['gulf of aden',   { north: 15.0, south: 10.0, east: 52.0, west: 42.0 }],
  ['suez',           { north: 31.5, south: 28.0, east: 33.0, west: 31.0 }],
  ['strait of malacca', { north: 6.0, south: 1.0, east: 104.5, west: 99.5 }],
  ['north korea',    { north: 42.7, south: 37.7, east: 130.7, west: 124.2 }],
  ['syria',          { north: 37.3, south: 32.3, east: 42.4, west: 35.7 }],
  ['yemen',          { north: 19.0, south: 11.9, east: 54.9, west: 41.7 }],
  ['somalia',        { north: 12.0, south: -2.0, east: 51.5, west: 40.9 }],
  ['libya',          { north: 33.2, south: 19.5, east: 25.2, west:  9.3 }],
  ['north atlantic', { north: 60.0, south: 35.0, east:  5.0, west:-50.0 }],
  ['bay of biscay',  { north: 48.0, south: 43.0, east: -1.0, west: -9.0 }],
  ['mediterranean',  { north: 46.0, south: 30.0, east: 36.0, west: -6.0 }],
  ['black sea',      { north: 46.6, south: 40.9, east: 41.0, west: 27.4 }],
  ['caribbean',      { north: 24.0, south: 10.0, east:-60.0, west:-87.0 }],
  ['gulf of mexico', { north: 30.5, south: 18.0, east:-80.0, west:-97.5 }],
  ['bermuda',        { north: 37.0, south: 28.0, east:-60.0, west:-70.0 }],
  ['bermuda triangle', { north: 37.0, south: 20.0, east:-60.0, west:-80.0 }],
  ['florida',        { north: 31.0, south: 24.5, east:-80.0, west:-87.5 }],
  ['bahamas',        { north: 27.5, south: 20.0, east:-72.0, west:-80.0 }],
  ['bengal',         { north: 22.0, south:  5.0, east: 95.0, west: 80.0 }],
  ['south atlantic', { north: 10.0, south:-55.0, east: 20.0, west:-45.0 }],
  ['south pacific',  { north:  5.0, south:-55.0, east:-70.0, west:140.0 }],
  ['east china sea', { north: 40.0, south: 24.0, east:130.0, west:118.0 }],
  ['coral sea',      { north:-10.0, south:-25.0, east:160.0, west:145.0 }],
  // ── Additional country / region entries ──────────────────────────────────
  // City / SAR entries — bboxes are regional (~300-500 km radius) so zones are
  // visible at world zoom level and capture surrounding sea/air lanes.
  ['hong kong',      { north: 25.0, south: 20.0, east:117.5, west:111.5 }],
  ['macau',          { north: 24.5, south: 20.5, east:115.5, west:111.0 }],
  ['bangkok',        { north: 16.5, south: 11.5, east:103.5, west: 97.5 }],
  ['tokyo',          { north: 38.5, south: 33.0, east:142.5, west:137.5 }],
  ['dubai',          { north: 27.5, south: 22.5, east: 58.0, west: 52.5 }],
  ['mumbai',         { north: 21.5, south: 16.5, east: 75.5, west: 70.0 }],
  ['karachi',        { north: 27.5, south: 22.5, east: 69.5, west: 64.5 }],
  ['manila',         { north: 17.5, south: 12.0, east:123.5, west:118.5 }],
  ['jakarta',        { north: -3.0, south: -8.5, east:109.0, west:104.0 }],
  ['ho chi minh',    { north: 13.5, south:  8.5, east:109.0, west:104.5 }],
  ['saigon',         { north: 13.5, south:  8.5, east:109.0, west:104.5 }],
  ['hanoi',          { north: 23.5, south: 18.5, east:108.0, west:103.5 }],
  // Country entries
  ['philippines',    { north: 21.1, south:  4.5, east:126.6, west:116.9 }],
  ['vietnam',        { north: 23.4, south:  8.6, east:109.5, west:102.1 }],
  ['thailand',       { north: 20.5, south:  5.6, east:105.6, west: 97.4 }],
  ['indonesia',      { north:  5.9, south: -8.8, east:141.0, west: 95.0 }],
  ['malaysia',       { north:  7.4, south:  1.0, east:119.3, west: 99.6 }],
  ['myanmar',        { north: 28.5, south: 10.0, east:101.2, west: 92.2 }],
  ['cambodia',       { north: 14.7, south: 10.4, east:107.6, west:102.3 }],
  ['laos',           { north: 22.5, south: 13.9, east:107.7, west:100.1 }],
  ['singapore',      { north:  1.5, south:  1.1, east:104.1, west:103.6 }],
  ['china',          { north: 53.6, south: 18.2, east:134.8, west: 73.5 }],
  ['japan',          { north: 45.5, south: 24.0, east:145.8, west:122.9 }],
  ['south korea',    { north: 38.6, south: 33.1, east:129.6, west:124.6 }],
  ['north korea',    { north: 42.7, south: 37.7, east:130.7, west:124.2 }],
  ['taiwan',         { north: 25.3, south: 21.9, east:122.0, west:120.0 }],
  ['india',          { north: 35.5, south:  6.7, east: 97.4, west: 68.2 }],
  ['pakistan',       { north: 37.1, south: 23.6, east: 77.8, west: 60.9 }],
  ['bangladesh',     { north: 26.6, south: 20.7, east: 92.7, west: 88.0 }],
  ['sri lanka',      { north:  9.9, south:  5.9, east: 81.9, west: 79.7 }],
  ['nepal',          { north: 30.4, south: 26.4, east: 88.2, west: 80.1 }],
  ['afghanistan',    { north: 38.5, south: 29.4, east: 74.9, west: 60.5 }],
  ['saudi arabia',   { north: 32.2, south: 16.4, east: 55.7, west: 34.6 }],
  ['turkey',         { north: 42.1, south: 36.0, east: 44.8, west: 26.0 }],
  ['israel',         { north: 33.3, south: 29.5, east: 35.9, west: 34.3 }],
  ['lebanon',        { north: 34.7, south: 33.1, east: 36.6, west: 35.1 }],
  ['iraq',           { north: 37.4, south: 29.1, east: 48.6, west: 38.8 }],
  ['jordan',         { north: 33.4, south: 29.2, east: 39.3, west: 34.9 }],
  ['egypt',          { north: 31.7, south: 22.0, east: 37.1, west: 24.7 }],
  ['ethiopia',       { north: 14.9, south:  3.4, east: 48.0, west: 33.0 }],
  ['kenya',          { north:  4.6, south: -4.7, east: 42.0, west: 34.0 }],
  ['nigeria',        { north: 13.9, south:  4.3, east: 14.7, west:  2.7 }],
  ['south africa',   { north:-22.1, south:-34.8, east: 32.9, west: 16.5 }],
  ['ukraine',        { north: 52.4, south: 44.4, east: 40.2, west: 22.1 }],
  ['poland',         { north: 54.8, south: 49.0, east: 24.2, west: 14.1 }],
  ['germany',        { north: 55.1, south: 47.3, east: 15.0, west:  6.0 }],
  ['france',         { north: 51.1, south: 42.3, east:  8.2, west: -4.8 }],
  ['uk',             { north: 60.9, south: 49.9, east:  1.8, west: -8.2 }],
  ['united kingdom', { north: 60.9, south: 49.9, east:  1.8, west: -8.2 }],
  ['spain',          { north: 43.8, south: 36.0, east:  4.3, west: -9.3 }],
  ['italy',          { north: 47.1, south: 37.9, east: 18.5, west:  6.6 }],
  ['greece',         { north: 41.7, south: 35.0, east: 28.2, west: 20.1 }],
  ['united states',  { north: 49.4, south: 25.1, east:-66.9, west:-124.8 }],
  ['usa',            { north: 49.4, south: 25.1, east:-66.9, west:-124.8 }],
  ['canada',         { north: 83.1, south: 42.0, east:-52.6, west:-141.0 }],
  ['mexico',         { north: 32.7, south: 14.5, east:-86.7, west:-117.1 }],
  ['brazil',         { north:  5.3, south:-33.7, east:-34.8, west:-73.9 }],
  ['argentina',      { north:-21.8, south:-55.1, east:-53.6, west:-73.6 }],
  ['australia',      { north:-10.7, south:-43.6, east:153.6, west:113.3 }],
  ['new zealand',    { north:-34.4, south:-47.3, east:178.5, west:166.4 }],
  ['pacific ocean',  { north: 60.0, south:-60.0, east:-100.0, west:120.0 }],
  ['indian ocean',   { north: 25.0, south:-60.0, east:115.0, west: 20.0 }],

  // ── More seas, straits & canals ─────────────────────────────────────────────
  ['strait of hormuz',  { north: 27.5, south: 25.0, east: 58.5, west: 55.5 }],
  ['hormuz',            { north: 27.5, south: 25.0, east: 58.5, west: 55.5 }],
  ['strait of gibraltar',{ north: 36.5, south: 35.5, east: -4.5, west: -6.0 }],
  ['gibraltar',         { north: 36.5, south: 35.5, east: -4.5, west: -6.0 }],
  ['bosphorus',         { north: 42.0, south: 40.5, east: 30.0, west: 27.5 }],
  ['dardanelles',       { north: 40.5, south: 39.8, east: 27.0, west: 25.5 }],
  ['suez canal',        { north: 31.5, south: 29.5, east: 33.0, west: 31.5 }],
  ['panama canal',      { north:  9.5, south:  8.5, east:-79.0, west:-80.0 }],
  ['lombok strait',     { north: -8.0, south: -9.5, east:116.5, west:115.0 }],
  ['sunda strait',      { north: -5.5, south: -7.0, east:106.0, west:104.5 }],
  ['malacca',           { north:  6.0, south:  1.0, east:104.5, west: 99.5 }],
  ['tsugaru strait',    { north: 41.8, south: 41.0, east:141.5, west:139.5 }],
  ['korean strait',     { north: 35.5, south: 33.0, east:131.0, west:128.5 }],
  ['mozambique channel',{ north:-10.0, south:-26.0, east: 41.0, west: 32.0 }],
  ['cape of good hope', { north:-33.0, south:-35.5, east: 19.5, west: 17.5 }],
  ['cape horn',         { north:-54.5, south:-56.5, east:-65.0, west:-68.0 }],
  ['drake passage',     { north:-55.0, south:-62.0, east:-55.0, west:-75.0 }],
  ['north sea',         { north: 62.0, south: 50.5, east:  9.0, west: -5.0 }],
  ['baltic sea',        { north: 66.0, south: 54.0, east: 30.0, west: 10.0 }],
  ['aegean sea',        { north: 42.0, south: 35.0, east: 28.5, west: 23.5 }],
  ['caspian sea',       { north: 47.2, south: 36.5, east: 54.5, west: 49.0 }],
  ['north pacific',     { north: 60.0, south: 15.0, east:-100.0, west:120.0 }],
  ['arabian gulf',      { north: 30.5, south: 23.0, east: 57.0, west: 47.0 }],
  ['sea of japan',      { north: 52.0, south: 32.0, east:142.0, west:128.0 }],
  ['yellow sea',        { north: 40.0, south: 31.0, east:126.0, west:120.0 }],
  ['java sea',          { north: -3.5, south: -8.0, east:116.0, west:105.0 }],
  ['celebes sea',       { north:  8.0, south:  1.0, east:127.0, west:119.0 }],
  ['banda sea',         { north: -3.5, south: -8.5, east:135.0, west:124.0 }],
  ['timor sea',         { north: -8.5, south:-13.5, east:132.0, west:122.0 }],
  ['arafura sea',       { north: -5.5, south:-11.0, east:141.0, west:131.0 }],
  ['tasman sea',        { north:-28.0, south:-48.0, east:170.0, west:152.0 }],
  ['north atlantic',    { north: 65.0, south: 20.0, east:  0.0, west:-80.0 }],
  ['south china sea',   { north: 25.0, south:  3.0, east:120.0, west:105.0 }],

  // ── Middle East & Central Asia (additional) ─────────────────────────────────
  ['kuwait',            { north: 30.1, south: 28.5, east: 48.5, west: 46.5 }],
  ['qatar',             { north: 26.2, south: 24.5, east: 51.7, west: 50.7 }],
  ['bahrain',           { north: 26.4, south: 25.7, east: 50.8, west: 50.3 }],
  ['oman',              { north: 26.6, south: 16.6, east: 60.0, west: 52.0 }],
  ['uae',               { north: 26.1, south: 22.6, east: 56.4, west: 51.6 }],
  ['united arab emirates', { north: 26.1, south: 22.6, east: 56.4, west: 51.6 }],
  ['azerbaijan',        { north: 41.9, south: 38.4, east: 50.4, west: 44.8 }],
  ['georgia',           { north: 43.6, south: 41.1, east: 46.7, west: 40.0 }],
  ['armenia',           { north: 41.3, south: 38.8, east: 46.6, west: 43.4 }],
  ['kazakhstan',        { north: 55.4, south: 40.6, east: 87.3, west: 50.9 }],
  ['uzbekistan',        { north: 45.6, south: 37.2, east: 73.1, west: 55.9 }],
  ['turkmenistan',      { north: 42.8, south: 35.1, east: 63.3, west: 52.5 }],
  ['kyrgyzstan',        { north: 43.2, south: 39.2, east: 80.3, west: 69.3 }],
  ['tajikistan',        { north: 41.0, south: 36.7, east: 75.1, west: 67.4 }],
  ['palestine',         { north: 32.6, south: 29.5, east: 35.7, west: 34.2 }],
  ['gaza',              { north: 31.6, south: 31.2, east: 34.6, west: 34.2 }],
  ['sinai',             { north: 31.0, south: 27.5, east: 34.9, west: 32.5 }],

  // ── Africa (additional) ──────────────────────────────────────────────────────
  ['morocco',           { north: 36.0, south: 27.7, east: -1.0, west:-13.2 }],
  ['algeria',           { north: 37.1, south: 19.1, east:  8.7, west: -8.7 }],
  ['tunisia',           { north: 37.5, south: 30.3, east: 11.6, west:  7.5 }],
  ['sudan',             { north: 23.0, south:  8.7, east: 38.6, west: 21.8 }],
  ['south sudan',       { north: 12.2, south:  3.5, east: 35.9, west: 24.1 }],
  ['ghana',             { north: 11.2, south:  4.7, east:  1.2, west: -3.3 }],
  ['senegal',           { north: 16.7, south: 12.3, east: -11.4, west:-17.5 }],
  ['ivory coast',       { north:  8.1, south:  4.4, east: -2.5, west: -8.6 }],
  ['tanzania',          { north: -0.9, south:-11.7, east: 40.4, west: 29.3 }],
  ['uganda',            { north:  4.2, south: -1.5, east: 35.0, west: 29.6 }],
  ['mozambique',        { north:-10.5, south:-26.9, east: 40.8, west: 32.7 }],
  ['angola',            { north: -4.4, south:-18.0, east: 24.1, west: 11.7 }],
  ['cameroon',          { north: 13.1, south:  1.7, east: 16.2, west:  8.5 }],
  ['democratic republic of congo', { north:  5.4, south:-13.5, east: 31.3, west: 12.2 }],
  ['drc',               { north:  5.4, south:-13.5, east: 31.3, west: 12.2 }],
  ['zambia',            { north: -8.2, south:-18.1, east: 33.7, west: 21.9 }],
  ['zimbabwe',          { north:-15.6, south:-22.5, east: 33.1, west: 25.2 }],
  ['madagascar',        { north:-11.9, south:-25.6, east: 50.5, west: 43.2 }],

  // ── Europe (additional) ─────────────────────────────────────────────────────
  ['netherlands',       { north: 53.6, south: 50.8, east:  7.2, west:  3.4 }],
  ['belgium',           { north: 51.5, south: 49.5, east:  6.4, west:  2.5 }],
  ['portugal',          { north: 42.2, south: 36.9, east: -6.2, west: -9.5 }],
  ['austria',           { north: 49.0, south: 46.4, east: 17.2, west:  9.5 }],
  ['switzerland',       { north: 47.8, south: 45.8, east: 10.5, west:  5.9 }],
  ['czech republic',    { north: 51.1, south: 48.5, east: 18.9, west: 12.1 }],
  ['czechia',           { north: 51.1, south: 48.5, east: 18.9, west: 12.1 }],
  ['hungary',           { north: 48.6, south: 45.7, east: 22.9, west: 16.1 }],
  ['romania',           { north: 48.3, south: 43.6, east: 29.7, west: 22.1 }],
  ['bulgaria',          { north: 44.2, south: 41.2, east: 28.6, west: 22.4 }],
  ['serbia',            { north: 46.2, south: 42.2, east: 23.0, west: 18.8 }],
  ['croatia',           { north: 46.6, south: 42.4, east: 19.5, west: 13.5 }],
  ['sweden',            { north: 69.1, south: 55.3, east: 24.2, west: 11.0 }],
  ['norway',            { north: 71.2, south: 57.9, east: 31.1, west:  4.6 }],
  ['finland',           { north: 70.1, south: 59.8, east: 31.6, west: 20.6 }],
  ['denmark',           { north: 57.8, south: 54.6, east: 15.2, west:  8.1 }],
  ['ireland',           { north: 55.4, south: 51.4, east: -6.0, west:-10.5 }],
  ['belarus',           { north: 56.2, south: 51.3, east: 32.8, west: 23.2 }],
  ['moldova',           { north: 48.5, south: 45.5, east: 30.2, west: 26.6 }],
  ['slovakia',          { north: 49.6, south: 47.7, east: 22.6, west: 16.8 }],
  ['iceland',           { north: 66.6, south: 63.4, east:-13.5, west:-24.5 }],

  // ── Asia-Pacific (additional countries) ──────────────────────────────────────
  ['timor-leste',       { north: -8.1, south:-10.0, east:127.4, west:124.0 }],
  ['east timor',        { north: -8.1, south:-10.0, east:127.4, west:124.0 }],
  ['brunei',            { north:  5.1, south:  4.0, east:115.4, west:114.1 }],
  ['papua new guinea',  { north: -2.5, south: -9.7, east:155.9, west:140.8 }],
  ['mongolia',          { north: 52.2, south: 41.6, east:119.9, west: 87.7 }],

  // ── Americas (additional) ────────────────────────────────────────────────────
  ['cuba',              { north: 23.3, south: 19.8, east:-74.1, west:-85.0 }],
  ['haiti',             { north: 20.1, south: 17.9, east:-71.6, west:-74.5 }],
  ['jamaica',           { north: 18.5, south: 17.7, east:-76.2, west:-78.4 }],
  ['puerto rico',       { north: 18.5, south: 17.9, east:-65.6, west:-67.3 }],
  ['dominican republic',{ north: 20.0, south: 17.5, east:-68.3, west:-72.0 }],
  ['colombia',          { north: 12.5, south: -4.2, east:-66.9, west:-79.0 }],
  ['venezuela',         { north: 12.2, south:  0.6, east:-59.8, west:-73.4 }],
  ['peru',              { north: -0.0, south:-18.4, east:-68.7, west:-81.4 }],
  ['chile',             { north:-17.5, south:-55.9, east:-66.4, west:-75.6 }],
  ['ecuador',           { north:  1.4, south: -5.0, east:-75.2, west:-81.0 }],
  ['bolivia',           { north:-10.0, south:-23.0, east:-57.5, west:-69.6 }],
  ['uruguay',           { north:-30.1, south:-34.9, east:-53.1, west:-58.5 }],
  ['paraguay',          { north:-19.3, south:-27.6, east:-54.3, west:-62.6 }],
  ['panama',            { north:  9.7, south:  7.2, east:-77.2, west:-83.1 }],
  ['costa rica',        { north: 11.2, south:  8.0, east:-82.6, west:-85.9 }],
  ['guatemala',         { north: 17.8, south: 13.7, east:-88.2, west:-92.2 }],
  ['honduras',          { north: 16.5, south: 13.0, east:-83.2, west:-89.4 }],
  ['nicaragua',         { north: 15.0, south: 10.7, east:-83.1, west:-87.7 }],

  // ── Major port cities ────────────────────────────────────────────────────────
  ['shanghai',          { north: 33.5, south: 29.5, east:123.5, west:119.5 }],
  ['shenzhen',          { north: 24.0, south: 21.5, east:115.0, west:112.5 }],
  ['guangzhou',         { north: 24.0, south: 21.5, east:115.0, west:112.5 }],
  ['beijing',           { north: 42.0, south: 38.5, east:118.5, west:115.0 }],
  ['osaka',             { north: 35.5, south: 33.5, east:136.5, west:134.5 }],
  ['busan',             { north: 36.0, south: 34.5, east:130.0, west:128.5 }],
  ['seoul',             { north: 38.5, south: 36.5, east:128.0, west:126.0 }],
  ['taipei',            { north: 26.0, south: 24.5, east:122.5, west:120.5 }],
  ['kuala lumpur',      { north:  4.5, south:  2.5, east:102.5, west:101.0 }],
  ['colombo',           { north:  8.5, south:  6.0, east: 81.5, west: 79.5 }],
  ['dhaka',             { north: 24.5, south: 22.5, east: 91.5, west: 89.5 }],
  ['yangon',            { north: 18.5, south: 16.0, east: 97.0, west: 95.5 }],
  ['rangoon',           { north: 18.5, south: 16.0, east: 97.0, west: 95.5 }],
  ['tehran',            { north: 37.5, south: 34.5, east: 53.5, west: 50.5 }],
  ['riyadh',            { north: 26.5, south: 23.5, east: 48.0, west: 45.5 }],
  ['doha',              { north: 26.0, south: 24.5, east: 52.0, west: 51.0 }],
  ['abu dhabi',         { north: 24.8, south: 23.5, east: 55.0, west: 53.5 }],
  ['muscat',            { north: 24.0, south: 22.5, east: 59.5, west: 57.5 }],
  ['cairo',             { north: 31.5, south: 29.5, east: 32.5, west: 30.5 }],
  ['casablanca',        { north: 35.5, south: 32.5, east: -6.0, west: -8.5 }],
  ['lagos',             { north:  7.5, south:  5.5, east:  4.5, west:  2.5 }],
  ['nairobi',           { north:  2.5, south: -3.0, east: 38.5, west: 35.5 }],
  ['dar es salaam',     { north: -5.5, south: -8.0, east: 40.5, west: 38.5 }],
  ['johannesburg',      { north:-25.5, south:-27.5, east: 29.5, west: 27.5 }],
  ['cape town',         { north:-32.5, south:-35.0, east: 20.0, west: 17.5 }],
  ['durban',            { north:-28.5, south:-30.5, east: 31.5, west: 29.5 }],
  ['istanbul',          { north: 42.5, south: 40.5, east: 30.0, west: 27.5 }],
  ['rotterdam',         { north: 52.5, south: 51.5, east:  5.5, west:  3.5 }],
  ['hamburg',           { north: 54.5, south: 52.5, east: 11.0, west:  8.5 }],
  ['london',            { north: 52.5, south: 50.5, east:  1.5, west: -1.5 }],
  ['new york',          { north: 42.0, south: 40.0, east:-72.5, west:-75.0 }],
  ['los angeles',       { north: 35.5, south: 33.0, east:-116.5, west:-119.5 }],
  ['miami',             { north: 26.5, south: 25.0, east:-79.5, west:-81.5 }],
  ['houston',           { north: 31.0, south: 29.0, east:-94.5, west:-96.5 }],
  ['seattle',           { north: 48.5, south: 46.5, east:-121.5, west:-123.5 }],
  ['vancouver',         { north: 50.5, south: 48.5, east:-121.5, west:-124.5 }],
  ['sydney',            { north:-32.5, south:-34.5, east:152.5, west:150.5 }],
  ['melbourne',         { north:-36.5, south:-38.5, east:146.0, west:143.5 }],
];

// ─── Typo / alias normalization ──────────────────────────────────────────────
// Maps common misspellings and alternate names → canonical lookup key.
// Entries are checked as whole-word-ish substrings (via includes after replace).
const REGION_ALIASES: [RegExp, string][] = [
  // Philippines misspellings
  [/phillipines?/gi,           'philippines'],
  [/philippine[^s]/gi,         'philippines'],
  [/philipines?/gi,            'philippines'],
  [/filipin[eo]s?/gi,          'philippines'],
  // Viet Nam spacing
  [/\bviet\s*nam\b/gi,         'vietnam'],
  // English abbreviations
  [/\busa\b/gi,                'usa'],
  [/\bu\.s\.a\.?\b/gi,         'usa'],
  [/\bu\.s\.\b/gi,             'usa'],
  [/united states of america/gi,'usa'],
  [/\bu\.k\.?\b/gi,            'uk'],
  [/great britain/gi,          'united kingdom'],
  [/england/gi,                'united kingdom'],
  [/scotland/gi,               'united kingdom'],
  [/wales/gi,                  'united kingdom'],
  // Korea
  [/\bkorea\b/gi,              'south korea'],
  [/republic of korea/gi,      'south korea'],
  [/dprk/gi,                   'north korea'],
  // HK / UAE / SAR shortcuts
  [/\bhk\b/gi,                 'hong kong'],
  [/\buae\b/gi,                'uae'],
  [/\bu\.a\.e\.?\b/gi,         'uae'],
  // Taiwan
  [/formosa/gi,                'taiwan'],
  // Myanmar
  [/burma/gi,                  'myanmar'],
  // Sri Lanka
  [/ceylon/gi,                 'sri lanka'],
  // Iran
  [/persia\b/gi,               'iran'],
  // Thailand
  [/siam\b/gi,                 'thailand'],
  // Congo
  [/\bdrc\b/gi,                'drc'],
  [/congo\b/gi,                'democratic republic of congo'],
  // Czech
  [/czech rep/gi,              'czechia'],
  // Ivory Coast
  [/c[oô]te\s*d.ivoire/gi,     'ivory coast'],
  // Ho Chi Minh City
  [/hcmc\b/gi,                 'ho chi minh'],
  [/ho chi minh city/gi,       'ho chi minh'],
  // Common city shorthand
  [/\bnyc\b/gi,                'new york'],
  [/\bla\b(?=\s|,|$)/gi,       'los angeles'],
  [/\bsfo\b/gi,                'san francisco'],
  // Strait of Hormuz shorthand
  [/hormuz strait/gi,          'strait of hormuz'],
  // Suez shorthand
  [/suez canal/gi,             'suez canal'],
  // Middle east shorthand
  [/mideast/gi,                'middle east'],
  // East Timor
  [/east timor/gi,             'timor-leste'],
  // Yangon old name
  [/rangoon/gi,                'yangon'],
];

function normalizeRegion(region: string): string {
  let s = region;
  for (const [pattern, replacement] of REGION_ALIASES) {
    s = s.replace(pattern, replacement);
  }
  return s;
}

/**
 * Convert a free-text region description to an approximate bounding box.
 * Returns the UNION of all matching bboxes (so "Iran, Persian Gulf" gives
 * a box that covers both). Common misspellings and alternate names are
 * normalised before the lookup so e.g. "Phillipines" still resolves.
 */
export function regionToBbox(region: string): BBox | null {
  const lower = normalizeRegion(region).toLowerCase();
  let merged: BBox | null = null;

  for (const [key, bbox] of REGION_BBOX_LOOKUP) {
    if (lower.includes(key)) {
      if (!merged) {
        merged = { ...bbox };
      } else {
        merged = {
          north: Math.max(merged.north, bbox.north),
          south: Math.min(merged.south, bbox.south),
          east:  Math.max(merged.east,  bbox.east),
          west:  Math.min(merged.west,  bbox.west),
        };
      }
    }
  }
  return merged;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Sample N points along the shortest arc and check containment.
 *  Handles the antimeridian (date line) correctly by always taking
 *  the shorter of the two possible longitude paths. */
function arcIntersectsBbox(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  bbox: BBox,
  samples = 24
): boolean {
  const lngA = a.lng;
  let lngB = b.lng;

  // Always take the shorter longitude path (handles date-line crossing)
  const diff = lngB - lngA;
  if (diff > 180)  lngB -= 360;
  if (diff < -180) lngB += 360;

  for (let i = 0; i <= samples; i++) {
    const t   = i / samples;
    const lat = a.lat + t * (b.lat - a.lat);
    let   lng = lngA  + t * (lngB  - lngA);

    // Normalise to –180…+180
    while (lng >  180) lng -= 360;
    while (lng < -180) lng += 360;

    if (
      lat >= bbox.south &&
      lat <= bbox.north &&
      lng >= bbox.west  &&
      lng <= bbox.east
    )
      return true;
  }
  return false;
}


function hubInBbox(hub: Hub, bbox: BBox): boolean {
  return (
    hub.lat >= bbox.south &&
    hub.lat <= bbox.north &&
    hub.lng >= bbox.west &&
    hub.lng <= bbox.east
  );
}

// ─── Logistics scoring constants (tunable) ────────────────────────────────────

/** Additive km-equivalent penalty per disruption severity (used by calculateEdgeScore). */
const SEVERITY_ADDITIVE_PENALTY: Record<string, number> = {
  low: 200,
  medium: 1000,
  high: 4000,
  critical: 20000,
};

/** Types that hard-block when severity is `high` (and always when `critical`). */
const SERIOUS_TYPES: ReadonlySet<DisruptionType> = new Set<DisruptionType>([
  'port_closure',
  'conflict_zone',
  'sea_lane_closure',
  'airspace_closure',
]);

/** West-coast US gateway cluster (for same-coast preference). */
const US_WEST_COAST = new Set(['US_LA', 'US_LGB', 'US_OAK', 'US_SEA', 'US_VAN']);
const US_EAST_COAST = new Set(['US_NY', 'US_SAV', 'US_MIA']);
const US_GULF       = new Set(['US_HOU']);
const US_INLAND     = new Set(['US_CH']);

/** All US gateway hub ids (used as candidate pool when destination is in the US). */
const US_GATEWAYS = new Set<string>([
  ...US_WEST_COAST, ...US_EAST_COAST, ...US_GULF, ...US_INLAND,
]);

// ─── Disruption type inference ────────────────────────────────────────────────

const TYPE_KEYWORDS: Array<[RegExp, DisruptionType]> = [
  [/port\s*closure|closed\s*port|closing\s*port/i, 'port_closure'],
  [/airspace/i,                                    'airspace_closure'],
  [/sea\s*lane|canal|strait/i,                     'sea_lane_closure'],
  [/storm|typhoon|hurricane|cyclone/i,             'storm'],
  [/congestion|delay|backlog/i,                    'congestion'],
  [/war|conflict|attack|invasion|missile/i,        'conflict_zone'],
];

export function inferDisruptionType(d: DisruptionZoneInput): DisruptionType {
  if (d.type) return d.type;
  const text = `${d.name ?? ''} ${d.description ?? ''}`;
  for (const [re, t] of TYPE_KEYWORDS) {
    if (re.test(text)) return t;
  }
  return 'conflict_zone'; // matches current default hard-block behaviour
}

// ─── Hub / edge blocking predicates ───────────────────────────────────────────

/** True when the hub sits inside the disruption bbox AND the disruption blocks hubs. */
export function isHubBlocked(hub: Hub, disruptions: DisruptionZoneInput[]): {
  blocked: boolean;
  by: DisruptionZoneInput[];
} {
  const by: DisruptionZoneInput[] = [];
  for (const d of disruptions) {
    if (!hubInBbox(hub, d.bbox)) continue;
    const t = inferDisruptionType(d);
    const sev = d.severity ?? 'medium';
    // port_closure & conflict_zone block hubs at high/critical
    if ((t === 'port_closure' || t === 'conflict_zone') &&
        (sev === 'high' || sev === 'critical')) {
      by.push(d);
    }
  }
  return { blocked: by.length > 0, by };
}

/** True if the edge’s arc touches the disruption bbox. */
function disruptionTouchesEdge(
  edge: RouteEdge,
  hubById: Map<string, Hub>,
  d: DisruptionZoneInput
): boolean {
  const a = hubById.get(edge.from);
  const b = hubById.get(edge.to);
  if (!a || !b) return false;
  return (
    hubInBbox(a, d.bbox) ||
    hubInBbox(b, d.bbox) ||
    arcIntersectsBbox(a, b, d.bbox, 48)
  );
}

// ─── Composite edge scoring ───────────────────────────────────────────────────

export interface EdgeScoreResult {
  score: number;
  blocked: boolean;
  reasons: string[];
}

export function calculateEdgeScore(
  edge: RouteEdge,
  hubById: Map<string, Hub>,
  disruptions: DisruptionZoneInput[]
): EdgeScoreResult {
  let score = edge.distanceKm;
  let blocked = false;
  const reasons: string[] = [];

  for (const d of disruptions) {
    if (!disruptionTouchesEdge(edge, hubById, d)) continue;
    const t = inferDisruptionType(d);
    const sev = d.severity ?? 'medium';

    // Type-specific blocking
    let typeBlocks = false;
    if (sev === 'critical' && SERIOUS_TYPES.has(t)) typeBlocks = true;
    if (sev === 'high' && SERIOUS_TYPES.has(t)) typeBlocks = true;
    if (t === 'airspace_closure' && edge.mode === 'air' &&
        (sev === 'high' || sev === 'critical')) typeBlocks = true;
    if (t === 'sea_lane_closure' && edge.mode === 'sea' &&
        (sev === 'high' || sev === 'critical')) typeBlocks = true;
    if (t === 'storm' && sev === 'critical' &&
        (edge.mode === 'sea' || edge.mode === 'air')) typeBlocks = true;
    if (t === 'congestion' && sev === 'critical') typeBlocks = true;

    if (typeBlocks) {
      blocked = true;
      reasons.push(`Edge ${edge.from}→${edge.to} blocked by ${sev} ${t} (${d.name})`);
      // Keep scanning so reasons accumulate, but score will be Infinity below.
      continue;
    }

    // Otherwise additive penalty (mode-aware)
    const base = SEVERITY_ADDITIVE_PENALTY[sev] ?? 0;
    let modeFactor = 1;
    if (t === 'storm' && (edge.mode === 'sea' || edge.mode === 'air')) modeFactor = 2;
    if (t === 'airspace_closure' && edge.mode === 'air') modeFactor = 3;
    if (t === 'sea_lane_closure' && edge.mode === 'sea') modeFactor = 3;
    if (t === 'congestion') modeFactor = 1;
    const penalty = base * modeFactor;
    score += penalty;
    reasons.push(`+${penalty} km penalty: ${sev} ${t} on ${edge.mode} edge (${d.name})`);
  }

  if (reasons.length === 0) {
    reasons.push(`Base distance ${edge.distanceKm} km`);
  }
  return { score: blocked ? Infinity : score, blocked, reasons };
}

// ─── Gateway substitution ─────────────────────────────────────────────────────

function usCoastOf(hubId: string): 'west' | 'east' | 'gulf' | 'inland' | null {
  if (US_WEST_COAST.has(hubId)) return 'west';
  if (US_EAST_COAST.has(hubId)) return 'east';
  if (US_GULF.has(hubId))       return 'gulf';
  if (US_INLAND.has(hubId))     return 'inland';
  return null;
}

/**
 * Generate plausible alternative gateways when the natural destination hub is blocked.
 * For now, supports US destinations explicitly; for other regions returns nearby unblocked hubs.
 */
export function generateGatewayCandidates(
  originalHub: Hub,
  toLat: number,
  toLng: number,
  disruptions: DisruptionZoneInput[],
  hubs: Hub[]
): Hub[] {
  const candidates: Hub[] = [];
  const isUS = US_GATEWAYS.has(originalHub.id);

  if (isUS) {
    for (const h of hubs) {
      if (!US_GATEWAYS.has(h.id)) continue;
      if (h.id === originalHub.id) continue;
      if (isHubBlocked(h, disruptions).blocked) continue;
      candidates.push(h);
    }
  } else {
    // Generic fallback: nearby unblocked hubs within ~3000 km
    for (const h of hubs) {
      if (h.id === originalHub.id) continue;
      if (isHubBlocked(h, disruptions).blocked) continue;
      const d = haversine(toLat, toLng, h.lat, h.lng);
      if (d <= 3000) candidates.push(h);
    }
  }
  return candidates;
}

export function calculateGatewayScore(
  originalHub: Hub,
  candidate: Hub,
  toLat: number,
  toLng: number,
  disruptions: DisruptionZoneInput[]
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  if (isHubBlocked(candidate, disruptions).blocked) {
    return { score: Infinity, reasons: [`${candidate.name} is inside a blocking disruption`] };
  }

  // Distance from the original destination point (km).
  const distToDest = haversine(toLat, toLng, candidate.lat, candidate.lng);
  let score = distToDest;
  reasons.push(`+${Math.round(distToDest)} km from original destination`);

  const originalCoast = usCoastOf(originalHub.id);
  const candCoast = usCoastOf(candidate.id);
  if (originalCoast && candCoast) {
    if (candCoast === originalCoast) {
      reasons.push('Same-coast bonus');
    } else if (candCoast === 'inland') {
      score += 4000;
      reasons.push('+4000 km penalty: inland hub as international entry');
    } else if (
      (originalCoast === 'west' && candCoast === 'east') ||
      (originalCoast === 'east' && candCoast === 'west')
    ) {
      score += 3000;
      reasons.push('+3000 km penalty: opposite coast');
    } else {
      score += 1500;
      reasons.push('+1500 km penalty: different coastal cluster');
    }
  }

  // Prefer seaport gateways
  if (candidate.type !== 'seaport') {
    score += 500;
    reasons.push('+500 km penalty: non-seaport gateway');
  }
  return { score, reasons };
}

// ─── Route validation ─────────────────────────────────────────────────────────

export function validateRoute(
  waypoints: RouteWaypoint[],
  disruptions: DisruptionZoneInput[],
  context: { directDistanceKm: number; totalDistanceKm: number; originalGatewayId: string }
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  if (waypoints.length < 2) failures.push('Route has fewer than 2 waypoints');
  if (!Number.isFinite(context.totalDistanceKm)) failures.push('Total distance is not finite');

  for (const w of waypoints) {
    for (const d of disruptions) {
      const t = inferDisruptionType(d);
      const sev = d.severity ?? 'medium';
      if ((sev === 'high' || sev === 'critical') &&
          (t === 'port_closure' || t === 'conflict_zone')) {
        if (w.lat >= d.bbox.south && w.lat <= d.bbox.north &&
            w.lng >= d.bbox.west  && w.lng <= d.bbox.east) {
          failures.push(`Waypoint "${w.name}" is inside ${sev} ${t} (${d.name})`);
        }
      }
    }
  }

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i], b = waypoints[i + 1];
    for (const d of disruptions) {
      const t = inferDisruptionType(d);
      const sev = d.severity ?? 'medium';
      if ((sev === 'critical' && (t === 'conflict_zone' || t === 'port_closure')) &&
          arcIntersectsBbox(a, b, d.bbox, 24)) {
        failures.push(`Segment ${a.name}→${b.name} crosses critical ${t} (${d.name})`);
      }
    }
  }

  // Sanity cap on detour bloat
  if (context.directDistanceKm > 0 &&
      Number.isFinite(context.totalDistanceKm) &&
      context.totalDistanceKm > context.directDistanceKm * 6) {
    failures.push(`Route is >6x direct distance (${Math.round(context.totalDistanceKm)} km vs ${Math.round(context.directDistanceKm)} km)`);
  }

  return { ok: failures.length === 0, failures };
}



// ─── Binary min-heap (priority queue) ────────────────────────────────────────

class MinHeap {
  private heap: { id: string; d: number }[] = [];

  get size() { return this.heap.length; }

  push(item: { id: string; d: number }) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  pop(): { id: string; d: number } | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  private _bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent].d <= this.heap[i].d) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private _sinkDown(i: number) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.heap[l].d < this.heap[smallest].d) smallest = l;
      if (r < n && this.heap[r].d < this.heap[smallest].d) smallest = r;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

// ─── Dijkstra ────────────────────────────────────────────────────────────────

function dijkstra(
  startId: string,
  endId: string,
  disruptions: DisruptionZoneInput[],
  hubs: Hub[],
  edges: RouteEdge[],
  blockedHubIds: Set<string> = new Set()
): { path: string[]; totalKm: number } {
  const hubById = new Map(hubs.map((h) => [h.id, h]));

  // Build adjacency list (bidirectional), skipping blocked hubs entirely.
  const adj = new Map<string, { to: string; edge: RouteEdge }[]>();
  for (const h of hubs) adj.set(h.id, []);
  for (const e of edges) {
    if (blockedHubIds.has(e.from) || blockedHubIds.has(e.to)) continue;
    adj.get(e.from)!.push({ to: e.to, edge: e });
    adj.get(e.to)!.push({ to: e.from, edge: e });
  }

  const dist = new Map<string, number>(hubs.map((h) => [h.id, Infinity]));
  const prev = new Map<string, string | null>(hubs.map((h) => [h.id, null]));
  dist.set(startId, 0);

  const pq = new MinHeap();
  pq.push({ id: startId, d: 0 });

  while (pq.size > 0) {
    const { id: u, d } = pq.pop()!;
    if (d > dist.get(u)!) continue;
    if (u === endId) break;

    for (const { to: v, edge } of adj.get(u) ?? []) {
      if (blockedHubIds.has(v)) continue;
      const { score } = calculateEdgeScore(edge, hubById, disruptions);
      if (!Number.isFinite(score)) continue;
      const nd = d + score;
      if (nd < dist.get(v)!) {
        dist.set(v, nd);
        prev.set(v, u);
        pq.push({ id: v, d: nd });
      }
    }
  }

  const path: string[] = [];
  let cur: string | null = endId;
  while (cur) {
    path.unshift(cur);
    cur = prev.get(cur) ?? null;
    if (path.length > hubs.length + 1) break;
  }

  return { path, totalKm: dist.get(endId) ?? Infinity };
}

/**
 * Approximate second-shortest *feasible* hub path under the same disruption rules:
 * remove one edge from the shortest path, re-run Dijkstra, keep the best longer total.
 * (Deviation-path step; exact k-shortest would use Yen’s algorithm.)
 */
function secondShortestHubPathKm(
  startId: string,
  endId: string,
  disruptions: DisruptionZoneInput[],
  hubs: Hub[],
  edges: RouteEdge[],
  shortestPathIds: string[],
  shortestTotalKm: number
): number | null {
  if (shortestPathIds.length < 2 || !Number.isFinite(shortestTotalKm)) return null;
  let bestLonger = Infinity;
  for (let i = 0; i < shortestPathIds.length - 1; i++) {
    const u = shortestPathIds[i];
    const v = shortestPathIds[i + 1];
    const filtered = edges.filter(
      (e) => !((e.from === u && e.to === v) || (e.from === v && e.to === u)),
    );
    const { totalKm } = dijkstra(startId, endId, disruptions, hubs, filtered);
    if (Number.isFinite(totalKm) && totalKm > shortestTotalKm + 1e-3 && totalKm < bestLonger) {
      bestLonger = totalKm;
    }
  }
  return bestLonger === Infinity ? null : bestLonger;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Return the hub closest to the given coordinates. */
export function findNearestHub(lat: number, lng: number, hubs: Hub[] = LOGISTICS_HUBS): Hub {
  let nearest = hubs[0];
  let minD = Infinity;
  for (const h of hubs) {
    const d = haversine(lat, lng, h.lat, h.lng);
    if (d < minD) {
      minD = d;
      nearest = h;
    }
  }
  return nearest;
}

/**
 * Check whether the direct arc from (fromLat,fromLng) to (toLat,toLng)
 * intersects any active disruption zone.
 * Uses the shorter geodesic arc (antimeridian-aware), which is also the
 * path rendered on screen after the antimeridian split in LeafletMapView.
 */
export function directRouteBlocked(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  disruptions: DisruptionZoneInput[]
): boolean {
  const a = { lat: fromLat, lng: fromLng };
  const b = { lat: toLat,   lng: toLng   };
  for (const d of disruptions) {
    if (arcIntersectsBbox(a, b, d.bbox, 40)) return true;
  }
  return false;
}

/**
 * True if any segment of a lat/lng polyline intersects any disruption bbox.
 */
export function polylineIntersectsDisruption(
  points: { lat: number; lng: number }[],
  disruptions: DisruptionZoneInput[]
): boolean {
  if (points.length < 2 || disruptions.length === 0) return false;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    for (const d of disruptions) {
      if (arcIntersectsBbox(a, b, d.bbox, 40)) return true;
    }
  }
  return false;
}

/**
 * Broad Asia–Pacific origin → Americas destination: use thesis “Indo–Med–Atlantic”
 * planning corridor (VN→SG→IN→AE→Suez→Europe→US) for conflict-zone demos.
 * Real UPS flights may be Trans-Pacific and miss the box; thesis evaluates this strategic lane.
 */
export function qualifiesAsiaAmericasThesisBaseline(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): boolean {
  const originAsia =
    fromLat >= -15 &&
    fromLat <= 55 &&
    fromLng >= 92 &&
    fromLng <= 160;
  const destAmericas =
    toLat >= -55 &&
    toLat <= 72 &&
    toLng <= -40 &&
    toLng >= -168;
  return originAsia && destAmericas;
}

/**
 * Hub chain for screenshots / thesis: maritime–air corridor through ME/Suez (crosses Gulf hubs).
 */
export function getThesisStrategicBaselineWaypoints(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  hubs: Hub[] = LOGISTICS_HUBS
): RouteWaypoint[] {
  const hubById = new Map(hubs.map((h) => [h.id, h]));
  const endHub = findNearestHub(toLat, toLng, hubs);

  const corridorIds: string[] = ['SG', 'IN', 'AE', 'EG', 'FR', 'GB', 'US_NY'];
  if (
    endHub.id === 'US_LA' ||
    endHub.id === 'US_CH' ||
    endHub.id === 'CA'
  ) {
    corridorIds.push(endHub.id);
  }

  const wps: RouteWaypoint[] = [
    {
      id: '_origin',
      name: 'Origin',
      lat: fromLat,
      lng: fromLng,
    },
    ...corridorIds.map((id) => {
      const h = hubById.get(id)!;
      return { id: h.id, name: h.name, lat: h.lat, lng: h.lng };
    }),
    {
      id: '_dest',
      name: 'Destination',
      lat: toLat,
      lng: toLng,
    },
  ];
  return wps;
}

/** True when the thesis Indo–Med corridor hits an active disruption (e.g. Gulf conflict). */
export function thesisStrategicCorridorBlocked(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  disruptions: DisruptionZoneInput[]
): boolean {
  if (!disruptions.length) return false;
  if (!qualifiesAsiaAmericasThesisBaseline(fromLat, fromLng, toLat, toLng)) return false;
  const baseline = getThesisStrategicBaselineWaypoints(
    fromLat,
    fromLng,
    toLat,
    toLng
  );
  const pts = baseline.map((w) => ({ lat: w.lat, lng: w.lng }));
  return polylineIntersectsDisruption(pts, disruptions);
}

/**
 * Thesis Scenario S1 (US–Iran / Hormuz): fixed hub sequence for the demo
 * tracking number, matching the written thesis narrative.
 */
export const THESIS_S1_DEMO_TRACKING_NUMBER = '1ZB8678F6735719517';

export function isThesisS1DemoTracking(trackingNumber: string | null | undefined): boolean {
  const a = (trackingNumber || '').replace(/\s+/g, '').toUpperCase();
  const b = THESIS_S1_DEMO_TRACKING_NUMBER.toUpperCase();
  return a.length > 0 && a === b;
}

/**
 * Hong Kong → Singapore → Colombo → Djibouti → Cairo/Suez → Rome/Genoa →
 * Paris/Le Havre → New York → Chicago
 */
export function getThesisS1RerouteWaypoints(): RouteWaypoint[] {
  return [
    { id: 's1-hk', name: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
    { id: 's1-sin', name: 'Singapore', lat: 1.3521, lng: 103.8198 },
    { id: 's1-cmb', name: 'Colombo', lat: 6.9271, lng: 79.8612 },
    { id: 's1-jib', name: 'Djibouti', lat: 11.589, lng: 43.145 },
    { id: 's1-suez', name: 'Cairo / Suez', lat: 30.0055, lng: 32.5475 },
    { id: 's1-rom', name: 'Rome / Genoa', lat: 41.9028, lng: 12.4964 },
    { id: 's1-par', name: 'Paris / Le Havre', lat: 48.8566, lng: 2.3522 },
    { id: 's1-nyc', name: 'New York', lat: 40.7128, lng: -74.006 },
    { id: 's1-ord', name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  ];
}

export function pathLengthKmForWaypoints(wps: RouteWaypoint[]): number {
  let sum = 0;
  for (let i = 1; i < wps.length; i++) {
    sum += haversine(wps[i - 1].lat, wps[i - 1].lng, wps[i].lat, wps[i].lng);
  }
  return sum;
}

/**
 * Compute the optimal rerouted path from (fromLat,fromLng) to (toLat,toLng)
 * that avoids the given disruption zones.
 *
 * Returns the ordered list of hub waypoints (including the snapped
 * origin/destination hubs) and the total route distance.
 */
export function findReroute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  disruptions: DisruptionZoneInput[],
  options: FindRerouteOptions = {}
): RerouteResult {
  const hubs = options.hubs ?? LOGISTICS_HUBS;
  const edges = options.edges ?? RAW_EDGES;
  const logMetrics = options.logMetrics ?? true;
  const includeSecondBest = options.includeSecondBest ?? false;
  const startTime = performance.now();
  const startHub = findNearestHub(fromLat, fromLng, hubs);
  const originalGateway = findNearestHub(toLat, toLng, hubs);

  const isBlocked = directRouteBlocked(fromLat, fromLng, toLat, toLng, disruptions);
  const directDistanceKmEarly = haversine(fromLat, fromLng, toLat, toLng);

  // ── Gateway substitution: pick alternative endpoint if original is blocked ──
  const gatewayBlock = isHubBlocked(originalGateway, disruptions);
  const reasons: string[] = [];
  const warnings: string[] = [];
  const blockedByNames: string[] = [];
  const rejectedRoutes: Array<{ gateway: string; reason: string }> = [];
  const allBlockedHubIds = new Set<string>(
    hubs.filter((h) => isHubBlocked(h, disruptions).blocked).map((h) => h.id)
  );

  let endHub: Hub = originalGateway;
  let status: RerouteStatus = isBlocked ? 'rerouted' : 'ok';
  let alternatives: Array<{ gateway: string; score: number }> = [];
  let selectedRoute: { path: string[]; totalKm: number; score: number } | null = null;

  if (gatewayBlock.blocked) {
    status = 'rerouted';
    for (const d of gatewayBlock.by) blockedByNames.push(d.name);
    reasons.push(
      `Original gateway ${originalGateway.name} is inside a ${gatewayBlock.by[0]?.severity ?? 'critical'} ${
        inferDisruptionType(gatewayBlock.by[0])
      } zone (${gatewayBlock.by.map((d) => d.name).join(', ')}).`
    );

    const candidates = generateGatewayCandidates(originalGateway, toLat, toLng, disruptions, hubs);
    type Ranked = { hub: Hub; gwScore: number; gwReasons: string[]; path: string[]; routeKm: number; total: number };
    const ranked: Ranked[] = [];

    for (const cand of candidates) {
      const { score: gwScore, reasons: gwReasons } = calculateGatewayScore(
        originalGateway, cand, toLat, toLng, disruptions
      );
      if (!Number.isFinite(gwScore)) {
        rejectedRoutes.push({ gateway: cand.name, reason: 'gateway score Infinity (inside disruption)' });
        continue;
      }
      const { path, totalKm } = dijkstra(startHub.id, cand.id, disruptions, hubs, edges, allBlockedHubIds);
      if (!Number.isFinite(totalKm) || path.length < 2 || path[path.length - 1] !== cand.id) {
        rejectedRoutes.push({ gateway: cand.name, reason: 'no feasible Dijkstra path' });
        continue;
      }
      // Build waypoints for validation
      const hubById = new Map(hubs.map((h) => [h.id, h]));
      const wps: RouteWaypoint[] = path
        .filter((id) => hubById.has(id))
        .map((id) => {
          const h = hubById.get(id)!;
          return { id: h.id, name: h.name, lat: h.lat, lng: h.lng };
        });
      const v = validateRoute(wps, disruptions, {
        directDistanceKm: directDistanceKmEarly,
        totalDistanceKm: totalKm,
        originalGatewayId: originalGateway.id,
      });
      if (!v.ok) {
        rejectedRoutes.push({ gateway: cand.name, reason: v.failures.join('; ') });
        continue;
      }
      const total = gwScore + totalKm;
      ranked.push({ hub: cand, gwScore, gwReasons, path, routeKm: totalKm, total });
    }

    ranked.sort((a, b) => a.total - b.total);
    if (ranked.length > 0) {
      const best = ranked[0];
      endHub = best.hub;
      selectedRoute = { path: best.path, totalKm: best.routeKm, score: best.total };
      reasons.push(`${best.hub.name} selected as best alternative gateway (gateway score ${Math.round(best.gwScore)}).`);
      reasons.push(...best.gwReasons.map((r) => `  • ${r}`));
      reasons.push('Final route avoids all blocking disruption zones.');
      alternatives = ranked.slice(1, 4).map((r) => ({
        gateway: r.hub.name,
        score: Math.round(r.total),
      }));
      if (best.hub.type !== 'seaport' || best.hub.id === 'US_CH') {
        warnings.push(`Inland or non-seaport gateway selected (${best.hub.name}); manual transfer may be required.`);
      }
      if (US_GATEWAYS.has(originalGateway.id) && usCoastOf(best.hub.id) !== usCoastOf(originalGateway.id)) {
        warnings.push(`Selected gateway is on a different US coast than the original destination — inland delivery distance may be significant.`);
      }
    } else {
      status = 'no_safe_route';
      reasons.push('No safe alternative gateway found; all candidates failed validation or were unreachable.');
    }
  }

  // If no substitution happened, run normal Dijkstra to originalGateway
  if (!selectedRoute && status !== 'no_safe_route') {
    const { path, totalKm } = dijkstra(startHub.id, endHub.id, disruptions, hubs, edges, allBlockedHubIds);
    const hubById = new Map(hubs.map((h) => [h.id, h]));
    const candidateWaypoints: RouteWaypoint[] = path
      .filter((id) => hubById.has(id))
      .map((id) => {
        const h = hubById.get(id)!;
        return { id: h.id, name: h.name, lat: h.lat, lng: h.lng };
      });
    const validation = validateRoute(candidateWaypoints, disruptions, {
      directDistanceKm: directDistanceKmEarly,
      totalDistanceKm: totalKm,
      originalGatewayId: originalGateway.id,
    });
    if (!validation.ok) {
      status = 'no_safe_route';
      reasons.push(...validation.failures);
      rejectedRoutes.push({
        gateway: originalGateway.name,
        reason: validation.failures.join('; '),
      });
    } else {
      selectedRoute = { path, totalKm, score: totalKm };
    }
    // Surface disruptions that affected edge scoring (but didn't fully block) for transparency
    if (isBlocked && selectedRoute) {
      reasons.push(`Direct route blocked; rerouted via ${path.length - 2} intermediate hub(s).`);
      for (const d of disruptions) {
        const sev = d.severity ?? 'medium';
        if (sev === 'high' || sev === 'critical') blockedByNames.push(d.name);
      }
    }
  }

  const path = selectedRoute?.path ?? [];
  const totalKm = selectedRoute?.totalKm ?? Infinity;

  let secondBestHubKm: number | undefined;
  let distanceSavedVsSecondBestKm: number | undefined;
  if (
    includeSecondBest &&
    disruptions.length > 0 &&
    path.length >= 2 &&
    Number.isFinite(totalKm) &&
    path[0] === startHub.id &&
    path[path.length - 1] === endHub.id
  ) {
    const s2 = secondShortestHubPathKm(
      startHub.id,
      endHub.id,
      disruptions,
      hubs,
      edges,
      path,
      totalKm
    );
    if (s2 !== null) {
      secondBestHubKm = s2;
      distanceSavedVsSecondBestKm = Math.round((s2 - totalKm) * 100) / 100;
    }
  }

  const hubById = new Map(hubs.map((h) => [h.id, h]));

  const waypoints: RouteWaypoint[] = path
    .filter((id) => hubById.has(id))
    .map((id) => {
      const h = hubById.get(id)!;
      return { id: h.id, name: h.name, lat: h.lat, lng: h.lng };
    });

  const endTime = performance.now();
  const execMs = endTime - startTime;
  const directDistanceKm = haversine(fromLat, fromLng, toLat, toLng);
  const detourKm = totalKm - directDistanceKm;
  const detourPct = directDistanceKm > 0 ? (detourKm / directDistanceKm) * 100 : 0;

  // Useful for benchmark screenshots in DevTools / terminal
  if (logMetrics) {
    console.log(
      `[REROUTE] ${execMs.toFixed(2)} ms | Nodes: ${hubs.length} | ` +
      `Edges: ${edges.length} | Disruptions: ${disruptions.length} | ` +
      `Distance: ${totalKm.toFixed(2)} km | Detour: ${detourKm.toFixed(2)} km (${detourPct.toFixed(2)}%)`
    );
  }

  // De-duplicate accumulated names
  const dedupedBlockedBy = Array.from(new Set(blockedByNames));
  const routeFound = waypoints.length > 1 && Number.isFinite(totalKm);
  if (!routeFound && status !== 'no_safe_route') {
    status = 'no_safe_route';
    if (reasons.length === 0) {
      reasons.push('No feasible route found through the current hub graph.');
    }
  }

  return {
    waypoints,
    totalDistanceKm: totalKm,
    blocked: isBlocked,
    score: selectedRoute?.score ?? Infinity,
    status,
    originalGateway: originalGateway.name,
    selectedGateway: endHub.name,
    blockedBy: dedupedBlockedBy,
    reasons,
    warnings,
    rejectedRoutes: rejectedRoutes.length > 0 ? rejectedRoutes : undefined,
    alternatives: alternatives.length > 0 ? alternatives : undefined,
    metrics: {
      execMs,
      nodeCount: hubs.length,
      edgeCount: edges.length,
      disruptionCount: disruptions.length,
      directDistanceKm,
      detourKm,
      detourPct,
      routeFound,
      hopCount: waypoints.length,
      secondBestHubKm,
      distanceSavedVsSecondBestKm,
    },
  };
}

// ─── Demo Scenario ───────────────────────────────────────────────────────────

/**
 * Pre-built demo: Singapore → London route disrupted by the US-Iran Conflict.
 *
 * The straight geodesic crosses the Persian Gulf / Iran zone.
 * Dijkstra reroutes via: Singapore → Mumbai → Colombo → Djibouti → Cairo → Rome → London
 */
export const DEMO_DISRUPTION: DisruptionZoneInput = {
  id: 'demo-iran-conflict-2026',
  name: 'US–Iran Conflict 2026',
  bbox: { north: 38.0, south: 22.0, east: 64.0, west: 44.0 },
  severity: 'critical',
};

export const DEMO_ORDER = {
  orderId:       'DEMO-SG-LONDON',
  trackingNumber:'DEMO-SG-LONDON',
  packageName:   'Demo Package — Singapore → London',
  origin:        { country: 'Singapore' },
  destination:   { country: 'United Kingdom' },
  fromLocation:  'Singapore',
  toLocation:    'London, GB',
  status:        'in_transit',
  deliveryStatus:'in_transit',
  senderName:    'ACME Asia (Singapore)',
  senderAddress: '1 Harbour Front, Singapore',
  receiverName:  'Global Logistics (UK)',
  receiverAddress:'10 Canary Wharf, London',
  trackingNumber2:'1Z-DEMO-2026',
  carrier:       'UPS',
};

export const DEMO_FROM = { lat: 1.35, lng: 103.82 };
export const DEMO_TO   = { lat: 51.51, lng: -0.13  };
