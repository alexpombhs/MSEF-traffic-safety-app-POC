export type OSMCrossing = {
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
};

type OSMElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
};
type OverpassResult = { elements?: OSMElement[] };

// Fetch Great Road geometry AND all crossing nodes in the nearby Bedford box.
// Spatial filtering happens in the app, including crossings on intersecting side streets.
// An empty API result is never interpreted as proof that no physical crossings exist.
const BOX = '42.465,-71.320,42.516,-71.230';
const QUERY = `[out:json][timeout:45];(way["highway"]["name"~"Great (Road|Rd)",i](${BOX});node["highway"="crossing"](${BOX}););out body geom;`;
const ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
];

function segmentDistanceMeters(lat: number, lon: number, a: {lat: number;lon: number}, b: {lat: number;lon: number}) {
  const latScale = 111_195;
  const lonScale = latScale * Math.cos(lat * Math.PI / 180);
  const dx = (b.lon - a.lon) * lonScale;
  const dy = (b.lat - a.lat) * latScale;
  const px = (lon - a.lon) * lonScale;
  const py = (lat - a.lat) * latScale;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / len2)) : 0;
  return Math.hypot(px - t * dx, py - t * dy);
}

function parseGreatRoadCrossings(json: OverpassResult): OSMCrossing[] {
  if (!Array.isArray(json.elements)) throw new Error('Unexpected Overpass response');
  const roads = json.elements.filter(e => e.type === 'way' && Array.isArray(e.geometry) && e.geometry.length > 1);
  const nodes = json.elements.filter(e => e.type === 'node' && Number.isFinite(e.lat) && Number.isFinite(e.lon));
  if (roads.length === 0) throw new Error('Great Road geometry not found in OpenStreetMap response');

  const crossingNodes = nodes.filter(node => {
    const lat = node.lat!, lon = node.lon!;
    return roads.some(road => {
      const geometry = road.geometry!;
      for (let i = 1; i < geometry.length; i++) {
        if (segmentDistanceMeters(lat, lon, geometry[i - 1], geometry[i]) <= 65) return true;
      }
      return false;
    });
  });

  return crossingNodes.map(node => ({
    id: node.id, lat: node.lat!, lon: node.lon!, tags: node.tags ?? {},
  }));
}

// Use one bounded request. Never let the UI spin through several slow servers.
export async function loadOSMCrossings(signal?: AbortSignal): Promise<OSMCrossing[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const response = await fetch('https://overpass.kumi.systems/api/interpreter', {
      method: 'POST',
      body: new URLSearchParams({ data: QUERY }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OpenStreetMap request failed (HTTP ${response.status})`);
    const crossings = parseGreatRoadCrossings(await response.json() as OverpassResult);
    if (!crossings.length) throw new Error('No crossing records found near Great Road');
    return crossings;
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (controller.signal.aborted) throw new Error('OpenStreetMap request timed out after 8 seconds');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

// Import a locally saved OSM GeoJSON FeatureCollection containing point features.
// This does not certify completeness; it only removes live-network dependence.
export function parseCrossingGeoJSON(raw: unknown): OSMCrossing[] {
  if (typeof raw !== 'object' || raw === null || !('features' in raw)) throw new Error('Expected a GeoJSON FeatureCollection');
  const collection = raw as { features?: unknown };
  if (!Array.isArray(collection.features)) throw new Error('Invalid GeoJSON features');
  const candidates = collection.features.flatMap((feature: unknown, index: number): OSMCrossing[] => {
    if (typeof feature !== 'object' || feature === null) return [];
    const f = feature as { id?: number | string; geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> };
    if (f.geometry?.type !== 'Point' || !Array.isArray(f.geometry.coordinates)) return [];
    const [lon, lat] = f.geometry.coordinates;
    if (typeof lon !== 'number' || typeof lat !== 'number' || !Number.isFinite(lon) || !Number.isFinite(lat)) return [];
    if (lat < 42.465 || lat > 42.516 || lon < -71.32 || lon > -71.23) return [];
    const tags = Object.fromEntries(Object.entries(f.properties ?? {}).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
    const rawId = f.id ?? f.properties?.['@id'] ?? f.properties?.id;
    const id = Number(String(rawId ?? index).replace(/^node\//, ''));
    if (!Number.isSafeInteger(id)) return [];
    return [{ id, lat, lon, tags }];
  });
  return [...new Map(candidates.map(c => [c.id, c])).values()];
}
