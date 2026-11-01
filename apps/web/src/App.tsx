import { useEffect, useRef, useState } from 'react';
import { Alert, AppBar, Box, Button, Chip, Container, Link, Paper, Stack, Toolbar, Typography } from '@mui/material';
import { PROJECT_NAME } from '@msef/core';
import { loadOSMCrossings, type OSMCrossing } from './osmCrossings';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';

const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

function featuresFor(points: OSMCrossing[]) {
  return {
    type: 'FeatureCollection' as const,
    features: points.map((point) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [point.lon, point.lat] },
      properties: { id: point.id, crossing: point.tags.crossing ?? 'not specified' },
    })),
  };
}

export default function App() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [crossings, setCrossings] = useState<OSMCrossing[]>([]);
  const [selected, setSelected] = useState<OSMCrossing | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let disposed = false;
    let map: MapLibreMap | undefined;
    async function initializeMap() {
      if (!mapEl.current) return;
      try {
        const lib = await import('maplibre-gl');
        if (disposed || !mapEl.current) return;
        lib.setWorkerUrl(workerUrl);
        if (!lib.supported()) {
          setMapError('Interactive maps require WebGL2 support. Try an updated browser with hardware acceleration enabled.');
          return;
        }
        map = new lib.Map({
          container: mapEl.current,
          style: BASEMAP_STYLE,
          center: [-71.274, 42.490],
          zoom: 12.7,
        });
        mapRef.current = map;
        map.addControl(new lib.NavigationControl(), 'top-right');
        map.on('load', () => {
          if (disposed || !map) return;
          setMapReady(true);
          map.addSource('crossings', { type: 'geojson', data: featuresFor([]) });
          map.addLayer({
            id: 'crossings-points', type: 'circle', source: 'crossings',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 15, 8],
              'circle-color': '#18776b',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
            },
          });
          map.on('click', 'crossings-points', (event) => {
            const id = Number(event.features?.[0]?.properties?.id);
            if (Number.isFinite(id)) window.dispatchEvent(new CustomEvent('msef-crossing-selected', { detail: id }));
          });
          map.on('mouseenter', 'crossings-points', () => { if (map) map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', 'crossings-points', () => { if (map) map.getCanvas().style.cursor = ''; });
        });
        map.on('error', (event) => {
          if (!disposed) {
            console.error('MapLibre:', event.error);
            setMapError('The map provider could not load. Check your connection and browser console.');
          }
        });
      } catch (error) {
        console.error('Map startup:', error);
        if (!disposed) setMapError('Unable to start the map. See your browser console.');
      }
    }
    void initializeMap();
    return () => { disposed = true; mapRef.current = null; map?.remove(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false);
    setDataError(null);
    loadOSMCrossings(controller.signal).then((points) => {
      if (!controller.signal.aborted) { setCrossings(points); setLoaded(true); }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        console.error('OSM crossings:', error);
        setDataError('Crosswalk locations could not be retrieved from OpenStreetMap right now.');
        setLoaded(true);
      }
    });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    if (!mapReady) return;
    (mapRef.current?.getSource('crossings') as GeoJSONSource | undefined)?.setData(featuresFor(crossings));
  }, [crossings, mapReady]);

  useEffect(() => {
    const listener = (event: Event) => {
      const id = (event as CustomEvent<number>).detail;
      setSelected(crossings.find((item) => item.id === id) ?? null);
    };
    window.addEventListener('msef-crossing-selected', listener);
    return () => window.removeEventListener('msef-crossing-selected', listener);
  }, [crossings]);

  return <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7f6' }}>
    <AppBar position="static" elevation={0}><Toolbar><Typography variant="h6">{PROJECT_NAME}</Typography></Toolbar></AppBar>
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={1} sx={{ mb: 2 }}>
        <Typography variant="h5">Explore Bedford crossings</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label="Live OpenStreetMap locations" size="small" color="primary" variant="outlined"/>
          <Chip label={loaded ? `${crossings.length} mapped crossings` : 'Loading crossing locations…'} size="small"/>
          <Chip label="Safety scores not available" size="small" variant="outlined"/>
        </Stack>
        <Typography color="text.secondary">
          Explore crossings recorded by OpenStreetMap contributors in the Bedford area. Select a marker to view its source.
          A mapped crossing is not proof of safety or of current on-the-ground conditions.
        </Typography>
      </Stack>
      {mapError && <Alert severity="warning" sx={{ mb: 2 }}>{mapError}</Alert>}
      {dataError && <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => setReload((n) => n + 1)}>Retry</Button>}>{dataError}</Alert>}
      {!mapReady && !mapError && <Typography sx={{ mb: 1 }}>Loading Bedford map…</Typography>}
      <Box ref={mapEl} role="region" aria-label="Map of OpenStreetMap crossing locations in Bedford"
        sx={{ height: { xs: 440, md: 580 }, borderRadius: 2, overflow: 'hidden', border: '1px solid #dae1dd', bgcolor: '#e8eeeb' }} />
      {selected && <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
        <Typography variant="h6">Mapped crossing #{selected.id}</Typography>
        <Typography variant="body2">OSM crossing type: {selected.tags.crossing ?? 'Not documented'}</Typography>
        <Typography variant="body2">Coordinates: {selected.lat.toFixed(5)}, {selected.lon.toFixed(5)}</Typography>
        <Link href={`https://www.openstreetmap.org/node/${selected.id}`} target="_blank" rel="noopener noreferrer">Open original OpenStreetMap record</Link>
      </Paper>}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        Map © OpenStreetMap contributors; basemap by OpenFreeMap. Crossing inventory retrieved on demand using the Overpass API.
        This map covers a rectangular Bedford-area search region, not official town limits. Data may be incomplete or outdated.
        Traffic counts and road-safety findings from Bedford studies have not yet been geocoded or integrated.
      </Typography>
    </Container>
  </Box>;
}
