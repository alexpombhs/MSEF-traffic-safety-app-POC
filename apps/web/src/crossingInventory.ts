import { parseCrossingGeoJSON, type OSMCrossing } from './osmCrossings';
import inventoryText from './data/great-road-crosswalks.geojson?raw';

const CACHE_KEY = 'msef-great-road-crosswalk-inventory-v1';

function fromGeoJSON(raw: unknown): OSMCrossing[] {
  return parseCrossingGeoJSON(raw);
}

export const repositoryCrossings = fromGeoJSON(JSON.parse(inventoryText) as unknown);

export function readSavedCrossings(): OSMCrossing[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    return fromGeoJSON(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveCrossings(points: OSMCrossing[]): void {
  const collection = {
    type: 'FeatureCollection',
    features: points.map(point => ({
      type: 'Feature',
      id: point.id,
      geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
      properties: { ...point.tags, source: 'locally imported or fetched OSM data', verification: 'pending' },
    })),
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(collection));
}

export function mergeCrossings(...groups: OSMCrossing[][]): OSMCrossing[] {
  return [...new Map(groups.flat().map(point => [point.id, point])).values()];
}
