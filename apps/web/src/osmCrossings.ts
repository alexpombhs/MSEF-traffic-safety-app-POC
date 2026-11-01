export type OSMCrossing = {
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
};

type OverpassResult = {
  elements?: Array<{ type: string; id: number; lat?: number; lon?: number; tags?: Record<string, string> }>;
};

// Candidate crossings within 30 m of OSM Great Road highway ways in central Bedford.
// The road name and buffer must be checked against Bedford construction plans:
// this is not a certified town crosswalk inventory.
const QUERY = `[out:json][timeout:40];way["highway"]["name"~"Great (Road|Rd)",i](42.465,-71.320,42.516,-71.230)->.greatroad;node(around.greatroad:55)["highway"="crossing"];out body;`;
const ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

export async function loadOSMCrossings(signal?: AbortSignal): Promise<OSMCrossing[]> {
  let lastError: unknown;
  for (const endpoint of ENDPOINTS) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: new URLSearchParams({ data: QUERY }),
        signal,
      });
      if (!response.ok) throw new Error(`Crossing data request failed (HTTP ${response.status})`);
      const json = await response.json() as OverpassResult;
      if (!Array.isArray(json.elements)) throw new Error('Unexpected crossing-data response');
      const points = json.elements.filter((item) =>
        item.type === 'node' && Number.isFinite(item.lat) && Number.isFinite(item.lon)
      ).map((item) => ({
        id: item.id,
        lat: item.lat as number,
        lon: item.lon as number,
        tags: item.tags ?? {},
      }));
      if (points.length === 0) throw new Error("No crossings returned; verify the Overpass Great Road match.");
      return [...new Map(points.map((point) => [point.id, point])).values()];
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unable to retrieve OpenStreetMap crossings');
}
