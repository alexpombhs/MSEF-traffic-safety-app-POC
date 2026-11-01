export type OSMCrossing = {
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
};

type LatLon = { lat: number; lon: number };
type OSMElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
  geometry?: LatLon[];
};
type OverpassResult = { elements?: OSMElement[] };

// Main OSM map API is independent from Overpass. This is only a candidate
// inventory: crossings not in OSM require checking Bedford plans/fieldwork.
const BBOX = '-71.320,42.465,-71.230,42.516';
const OVERPASS_BBOX = '42.465,-71.320,42.516,-71.230';
const OVERPASS_QUERY = `[out:json][timeout:20];(way["highway"]["name"~"Great (Road|Rd)",i](${OVERPASS_BBOX});node["highway"="crossing"](${OVERPASS_BBOX}););out body geom;`;
const TIMEOUT_MS = 10000;

function distanceMeters(lat: number, lon: number, a: LatLon, b: LatLon): number {
  const latScale = 111195;
  const lonScale = latScale * Math.cos(lat * Math.PI / 180);
  const dx = (b.lon - a.lon) * lonScale;
  const dy = (b.lat - a.lat) * latScale;
  const px = (lon - a.lon) * lonScale;
  const py = (lat - a.lat) * latScale;
  const t = dx * dx + dy * dy ? Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(px - t * dx, py - t * dy);
}

function filterNearGreatRoad(nodes: OSMCrossing[], roads: LatLon[][]): OSMCrossing[] {
  if (!roads.length) throw new Error('Great Road geometry not found in response');
  const segments = roads.flatMap(geometry =>
    geometry.slice(1).map((end, index) => [geometry[index], end] as const));
  const filtered = nodes.filter(node =>
    segments.some(([a, b]) => distanceMeters(node.lat, node.lon, a, b) <= 65));
  return [...new Map(filtered.map(node => [node.id, node])).values()];
}

function parseMapXML(xml: string): OSMCrossing[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid OSM XML response');
  const allNodes = new Map<number, OSMCrossing>();
  const crossings: OSMCrossing[] = [];
  for (const element of Array.from(doc.querySelectorAll('node'))) {
    const id = Number(element.getAttribute('id'));
    const lat = Number(element.getAttribute('lat'));
    const lon = Number(element.getAttribute('lon'));
    if (!Number.isSafeInteger(id) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const tags = Object.fromEntries(Array.from(element.querySelectorAll(':scope > tag')).map(tag =>
      [tag.getAttribute('k') ?? '', tag.getAttribute('v') ?? '']));
    const node = { id, lat, lon, tags };
    allNodes.set(id, node);
    if (tags.highway === 'crossing') crossings.push(node);
  }
  const roads: LatLon[][] = [];
  for (const way of Array.from(doc.querySelectorAll('way'))) {
    const tags = Object.fromEntries(Array.from(way.querySelectorAll(':scope > tag')).map(tag =>
      [tag.getAttribute('k') ?? '', tag.getAttribute('v') ?? '']));
    if (!tags.highway || !/Great (Road|Rd)/i.test(tags.name ?? '')) continue;
    const geometry = Array.from(way.querySelectorAll(':scope > nd'))
      .map(nd => allNodes.get(Number(nd.getAttribute('ref'))))
      .filter((n): n is OSMCrossing => !!n);
    if (geometry.length > 1) roads.push(geometry);
  }
  return filterNearGreatRoad(crossings, roads);
}

function parseOverpass(json: OverpassResult): OSMCrossing[] {
  if (!Array.isArray(json.elements)) throw new Error('Unexpected Overpass response');
  const roads = json.elements.filter(element =>
    element.type === 'way' && element.tags?.highway && /Great (Road|Rd)/i.test(element.tags.name ?? '') &&
    Array.isArray(element.geometry) && element.geometry.length > 1
  ).map(element => element.geometry!);
  const crossings = json.elements.filter(e =>
    e.type === 'node' && e.tags?.highway === 'crossing' &&
    Number.isFinite(e.lat) && Number.isFinite(e.lon)
  ).map(e => ({ id: e.id, lat: e.lat!, lon: e.lon!, tags: e.tags ?? {} }));
  return filterNearGreatRoad(crossings, roads);
}

async function boundedFetch(url: string, init: RequestInit, outer?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const cancel = () => controller.abort();
  outer?.addEventListener('abort', cancel, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (outer?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (controller.signal.aborted) throw new Error('Data service timed out');
    throw error;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', cancel);
  }
}

export async function loadOSMCrossings(signal?: AbortSignal): Promise<OSMCrossing[]> {
  let lastError: unknown;
  const sources = [
    async () => {
      const response = await boundedFetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${BBOX}`, {}, signal);
      if (!response.ok) throw new Error(`OpenStreetMap map API HTTP ${response.status}`);
      return parseMapXML(await response.text());
    },
    async () => {
      const response = await boundedFetch('https://overpass.private.coffee/api/interpreter', {
        method: 'POST',
        body: new URLSearchParams({ data: OVERPASS_QUERY }),
      }, signal);
      if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
      return parseOverpass(await response.json() as OverpassResult);
    },
  ];
  for (const source of sources) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    try {
      const result = await source();
      if (result.length) return result;
      lastError = new Error('No Great Road crossing nodes matched this source');
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
      console.warn('Crosswalk lookup failed:', error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Neither live source returned crossings');
}

export function parseCrossingGeoJSON(raw: unknown): OSMCrossing[] {
  if (typeof raw !== 'object' || raw === null || !('features' in raw)) throw new Error('Expected GeoJSON FeatureCollection');
  const data = raw as { features?: unknown };
  if (!Array.isArray(data.features)) throw new Error('Invalid GeoJSON features');
  const crossings = data.features.flatMap((feature: unknown, index: number): OSMCrossing[] => {
    if (!feature || typeof feature !== 'object') return [];
    const f = feature as { id?: string | number; geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> };
    if (f.geometry?.type !== 'Point' || !Array.isArray(f.geometry.coordinates)) return [];
    const [lon, lat] = f.geometry.coordinates;
    if (typeof lon !== 'number' || typeof lat !== 'number' || !Number.isFinite(lon) || !Number.isFinite(lat)) return [];
    if (lat < 42.465 || lat > 42.516 || lon < -71.320 || lon > -71.230) return [];
    const rawId = f.id ?? f.properties?.['@id'] ?? f.properties?.id;
    const id = Number(String(rawId ?? index).replace(/^node\//, ''));
    if (!Number.isSafeInteger(id)) return [];
    const tags = Object.fromEntries(Object.entries(f.properties ?? {}).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
    return [{ id, lat, lon, tags }];
  });
  return [...new Map(crossings.map(c => [c.id, c])).values()];
}
