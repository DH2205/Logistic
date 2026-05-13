import { NextRequest, NextResponse } from 'next/server';
import {
  DEMO_FROM,
  DEMO_TO,
  DisruptionZoneInput,
  findReroute,
  Hub,
  LOGISTICS_HUBS,
  RAW_EDGES,
  regionToBbox,
  RouteEdge,
} from '@/lib/disruption-router';

type Scenario = {
  id: string;
  disruptions: DisruptionZoneInput[];
};

function createScenarioDisruptions(): Scenario[] {
  const iranBbox = regionToBbox('iran, persian gulf, gulf of oman, arabian sea');
  const arabianSeaBbox = regionToBbox('arabian sea');
  const northAtlanticBbox = regionToBbox('north atlantic');

  const s0: Scenario = { id: 'D0', disruptions: [] };

  const s1: Scenario = {
    id: 'D1',
    disruptions: iranBbox
      ? [{ id: 'd1-iran', name: 'US-Iran Conflict 2026', bbox: iranBbox, severity: 'critical' }]
      : [],
  };

  const s2: Scenario = {
    id: 'D2',
    disruptions: [
      ...(s1.disruptions.length ? s1.disruptions : []),
      ...(arabianSeaBbox
        ? [{ id: 'd2-arabian', name: 'Arabian Sea Cyclone', bbox: arabianSeaBbox, severity: 'critical' as const }]
        : []),
    ],
  };

  const s3: Scenario = {
    id: 'D3',
    disruptions: [
      ...(s2.disruptions.length ? s2.disruptions : []),
      ...(northAtlanticBbox
        ? [{ id: 'd3-atlantic', name: 'North Atlantic Storm', bbox: northAtlanticBbox, severity: 'critical' as const }]
        : []),
    ],
  };

  return [s0, s1, s2, s3];
}

function summarize(values: number[]) {
  const count = values.length;
  const avg = count ? values.reduce((a, b) => a + b, 0) / count : 0;
  const min = count ? Math.min(...values) : 0;
  const max = count ? Math.max(...values) : 0;
  const variance = count
    ? values.reduce((acc, v) => acc + (v - avg) ** 2, 0) / count
    : 0;
  const stdDev = Math.sqrt(variance);
  return { count, avg, min, max, stdDev };
}

function buildExpandedGraph(extraHubs: number): { hubs: Hub[]; edges: RouteEdge[] } {
  const baseHubs = [...LOGISTICS_HUBS];
  const baseEdges = [...RAW_EDGES];

  if (!Number.isFinite(extraHubs) || extraHubs <= 0) {
    return { hubs: baseHubs, edges: baseEdges };
  }

  // Split up to N existing edges by inserting synthetic transition hubs.
  // This increases node/transition complexity while preserving global topology.
  const splits = Math.min(Math.floor(extraHubs), baseEdges.length);
  const nextHubs: Hub[] = [...baseHubs];
  const nextEdges: RouteEdge[] = [];

  for (let i = 0; i < baseEdges.length; i++) {
    const e = baseEdges[i];
    const from = baseHubs.find((h) => h.id === e.from);
    const to = baseHubs.find((h) => h.id === e.to);

    if (!from || !to) {
      nextEdges.push(e);
      continue;
    }

    if (i < splits) {
      const midId = `XH_${i + 1}`;
      const midHub: Hub = {
        id: midId,
        name: `Transition Hub ${i + 1}`,
        lat: (from.lat + to.lat) / 2,
        lng: (from.lng + to.lng) / 2,
        type: from.type,
      };
      nextHubs.push(midHub);

      nextEdges.push({
        from: e.from,
        to: midId,
        distanceKm: e.distanceKm / 2,
        mode: e.mode,
      });
      nextEdges.push({
        from: midId,
        to: e.to,
        distanceKm: e.distanceKm / 2,
        mode: e.mode,
      });
    } else {
      nextEdges.push(e);
    }
  }

  return { hubs: nextHubs, edges: nextEdges };
}

export async function GET(request: NextRequest) {
  const runsParam = Number(request.nextUrl.searchParams.get('runs') ?? '30');
  const runs = Number.isFinite(runsParam) ? Math.min(Math.max(runsParam, 1), 1000) : 30;
  const extraHubsParam = Number(request.nextUrl.searchParams.get('extraHubs') ?? '0');
  const extraHubs = Number.isFinite(extraHubsParam) ? Math.min(Math.max(extraHubsParam, 0), 500) : 0;
  const graph = buildExpandedGraph(extraHubs);

  const scenarios = createScenarioDisruptions();
  const output = scenarios.map((scenario) => {
    const execTimes: number[] = [];
    const detourPcts: number[] = [];
    const totalDistances: number[] = [];
    let successCount = 0;

    for (let i = 0; i < runs; i++) {
      const result = findReroute(
        DEMO_FROM.lat,
        DEMO_FROM.lng,
        DEMO_TO.lat,
        DEMO_TO.lng,
        scenario.disruptions,
        { hubs: graph.hubs, edges: graph.edges, logMetrics: false }
      );

      const m = result.metrics;
      if (m) {
        execTimes.push(m.execMs);
        if (Number.isFinite(m.detourPct)) detourPcts.push(m.detourPct);
        if (Number.isFinite(result.totalDistanceKm)) totalDistances.push(result.totalDistanceKm);
        if (m.routeFound) {
          successCount++;
        }
      }
    }

    return {
      scenario: scenario.id,
      disruptions: scenario.disruptions.length,
      runs,
      successRatePct: runs > 0 ? (successCount / runs) * 100 : 0,
      execMs: summarize(execTimes),
      detourPct: summarize(detourPcts),
      totalDistanceKm: summarize(totalDistances),
    };
  });

  return NextResponse.json({
    ok: true,
    from: 'DEMO_FROM (Singapore)',
    to: 'DEMO_TO (London)',
    runsPerScenario: runs,
    graph: {
      baseHubCount: LOGISTICS_HUBS.length,
      baseEdgeCount: RAW_EDGES.length,
      extraHubs,
      nodeCount: graph.hubs.length,
      edgeCount: graph.edges.length,
    },
    results: output,
  });
}

