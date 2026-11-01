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

export async function loadOSMCrossings(signal?: AbortSignal): Promise<OSMCrossing[]> {
  let lastError: unknown;
  for (const endpoint of ENDPOINTS) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), 12000);
    const abort = () => timeoutController.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: new URLSearchParams({ data: QUERY }),
        signal: timeoutController.signal,
      });
      if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
      const crossings = parseGreatRoadCrossings(await response.json() as OverpassResult);
      if (crossings.length === 0) throw new Error('No nearby crossing nodes returned');
      return crossings;
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      lastError = timeoutController.signal.aborted ? new Error('Crossing data server timed out') : error;
      console.warn('Crossing data endpoint failed:', endpoint, error);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not load Great Road crossing candidates');
}
