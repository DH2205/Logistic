/**
 * Client/server-safe helpers: build disruption zones from stored map state
 * and summarise Dijkstra reroute + distance saved vs a second feasible path.
 */
import {
  directRouteBlocked,
  findReroute,
  regionToBbox,
  thesisStrategicCorridorBlocked,
  type DisruptionZoneInput,
} from './disruption-router';
import { geocodeLocation } from './geocoding';

export type StoredLogisticsDisruption = {
  id: string;
  name: string;
  region: string;
  active: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  bbox?: { north: number; south: number; east: number; west: number };
};

export type TrackingRerouteInsight = {
  blockedBy: string[];
  optimalHubKm: number;
  secondBestHubKm: number | null;
  /** Hub-km saved vs next longer feasible route, when a second-best path exists */
  distanceSavedKm: number | null;
  /** Shortest hub path if disruption penalties were ignored (may cross blocked zones) */
  baselineClearNetworkKm: number | null;
  /** optimalHubKm - baselineClearNetworkKm when both defined (often positive when detouring) */
  detourVsClearNetworkKm: number | null;
  hubChain: string;
};

export function parseStoredDisruptions(raw: string | null): StoredLogisticsDisruption[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function storedDisruptionsToZones(
  list: StoredLogisticsDisruption[]
): DisruptionZoneInput[] {
  return list
    .filter((d) => d.active)
    .map((d) => {
      const bbox = d.bbox ?? regionToBbox(d.region) ?? regionToBbox(d.name) ?? null;
      if (!bbox) return null;
      return { id: d.id, name: d.name, bbox, severity: d.severity };
    })
    .filter((z): z is DisruptionZoneInput => z !== null);
}

/**
 * When active zones affect the great-circle or thesis corridor, compute optimal reroute
 * and compare to an unconstrained hub baseline + optional second-best feasible path.
 */
export async function computeTrackingRerouteInsight(
  fromLabel: string,
  toLabel: string,
  zones: DisruptionZoneInput[]
): Promise<TrackingRerouteInsight | null> {
  if (zones.length === 0) return null;
  const from = await geocodeLocation(fromLabel || '');
  const to = await geocodeLocation(toLabel || '');
  if (!from || !to) return null;

  const chordBlocked = directRouteBlocked(from.lat, from.lng, to.lat, to.lng, zones);
  const corridorBlocked = thesisStrategicCorridorBlocked(from.lat, from.lng, to.lat, to.lng, zones);
  if (!chordBlocked && !corridorBlocked) return null;

  const optimal = findReroute(from.lat, from.lng, to.lat, to.lng, zones, {
    logMetrics: false,
    includeSecondBest: true,
  });
  if (!optimal.metrics?.routeFound || !Number.isFinite(optimal.totalDistanceKm)) return null;

  const baseline = findReroute(from.lat, from.lng, to.lat, to.lng, [], { logMetrics: false });
  const baselineKm = Number.isFinite(baseline.totalDistanceKm) ? baseline.totalDistanceKm : null;
  const optimalKm = optimal.totalDistanceKm;
  const detourVsClear =
    baselineKm !== null
      ? Math.round((optimalKm - baselineKm) * 100) / 100
      : null;

  const second =
    optimal.metrics.secondBestHubKm !== undefined ? optimal.metrics.secondBestHubKm : null;
  const saved =
    optimal.metrics.distanceSavedVsSecondBestKm !== undefined
      ? optimal.metrics.distanceSavedVsSecondBestKm
      : null;

  return {
    blockedBy: zones.map((z) => z.name),
    optimalHubKm: Math.round(optimalKm * 100) / 100,
    secondBestHubKm: second !== null ? Math.round(second * 100) / 100 : null,
    distanceSavedKm: saved,
    baselineClearNetworkKm: baselineKm !== null ? Math.round(baselineKm * 100) / 100 : null,
    detourVsClearNetworkKm: detourVsClear,
    hubChain: optimal.waypoints.map((w) => w.name).join(' → '),
  };
}
