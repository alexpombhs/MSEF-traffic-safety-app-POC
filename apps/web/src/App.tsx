import { useEffect, useRef, useState } from 'react';
import { Alert, AppBar, Box, Button, Chip, Container, Link, Paper, Stack, Toolbar, Typography } from '@mui/material';
import { PROJECT_NAME } from '@msef/core';
import { loadOSMCrossings, type OSMCrossing } from './osmCrossings';
import { trafficStudySites, type TrafficStudySite } from './trafficStudySites';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';

const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

function crossingFeatures(points: OSMCrossing[]) {
  return {
    type: 'FeatureCollection' as const,
    features: points.map((point) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [point.lon, point.lat] },
      properties: { id: point.id, crossing: point.tags.crossing ?? 'not specified' },
    })),
  };
}

function studyFeatures(points: TrafficStudySite[]) {
  return {
    type: 'FeatureCollection' as const,
    features: points.map((point) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [point.lon, point.lat] },
      properties: { id: point.id, label: point.label },
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
  const [selectedCrossing, setSelectedCrossing] = useState<OSMCrossing | null>(null);
  const [selectedStudy, setSelectedStudy] = useState<TrafficStudySite | null>(null);
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

          map.addSource('crossings', { type: 'geojson', data: crossingFeatures([]) });
          map.addLayer({
            id: 'crossings-points',
            type: 'circle',
            source: 'crossings',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 15, 8],
              'circle-color': '#18776b',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
            },
          });

          map.addSource('traffic-study-sites', {
            type: 'geojson',
            data: studyFeatures(trafficStudySites),
          });
          map.addLayer({
            id: 'traffic-study-sites-points',
            type: 'circle',
            source: 'traffic-study-sites',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 7, 15, 11],
              'circle-color': '#c26a21',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2.5,
            },
          });

          map.on('click', 'crossings-points', (event) => {
            const id = Number(event.features?.[0]?.properties?.id);
            if (Number.isFinite(id)) {
              window.dispatchEvent(new CustomEvent('msef-crossing-selected', { detail: id }));
            }
          });

          map.on('click', 'traffic-study-sites-points', (event) => {
            const id = String(event.features?.[0]?.properties?.id ?? '');
            if (id) {
              window.dispatchEvent(new CustomEvent('msef-study-site-selected', { detail: id }));
            }
          });

          for (const layerId of ['crossings-points', 'traffic-study-sites-points']) {
            map.on('mouseenter', layerId, () => {
              if (map) map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', layerId, () => {
              if (map) map.getCanvas().style.cursor = '';
            });
          }
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

    return () => {
      disposed = true;
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false);
    setDataError(null);

    loadOSMCrossings(controller.signal)
      .then((points) => {
        if (!controller.signal.aborted) {
          setCrossings(points);
          setLoaded(true);
        }
      })
      .catch((error: unknown) => {
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
    (mapRef.current?.getSource('crossings') as GeoJSONSource | undefined)?.setData(crossingFeatures(crossings));
  }, [crossings, mapReady]);

  useEffect(() => {
    const crossingListener = (event: Event) => {
      const id = (event as CustomEvent<number>).detail;
      setSelectedCrossing(crossings.find((item) => item.id === id) ?? null);
      setSelectedStudy(null);
    };

    const studyListener = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      setSelectedStudy(trafficStudySites.find((item) => item.id === id) ?? null);
      setSelectedCrossing(null);
    };

    window.addEventListener('msef-crossing-selected', crossingListener);
    window.addEventListener('msef-study-site-selected', studyListener);

    return () => {
      window.removeEventListener('msef-crossing-selected', crossingListener);
      window.removeEventListener('msef-study-site-selected', studyListener);
    };
  }, [crossings]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7f6' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h6">{PROJECT_NAME}</Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Stack spacing={1} sx={{ mb: 2 }}>
          <Typography variant="h5">Explore Bedford crossings and traffic data</Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label="Crossings: OpenStreetMap" size="small" color="primary" variant="outlined" />
            <Chip label={loaded ? `${crossings.length} mapped crossings` : 'Loading crossing locations…'} size="small" />
            <Chip label={`${trafficStudySites.length} official traffic-count sites`} size="small" variant="outlined" />
          </Stack>

          <Typography color="text.secondary">
            Teal markers are crossings mapped by OpenStreetMap contributors. Orange markers are locations from Bedford's
            Great Road Traffic Optimization Study with measured traffic-count data. Select any marker for details.
          </Typography>
        </Stack>

        {mapError && <Alert severity="warning" sx={{ mb: 2 }}>{mapError}</Alert>}
        {dataError && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={<Button color="inherit" size="small" onClick={() => setReload((n) => n + 1)}>Retry</Button>}
          >
            {dataError}
          </Alert>
        )}

        {!mapReady && !mapError && <Typography sx={{ mb: 1 }}>Loading Bedford map…</Typography>}

        <Box
          ref={mapEl}
          role="region"
          aria-label="Map of Bedford crossing locations and official traffic study sites"
          sx={{
            height: { xs: 440, md: 580 },
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid #dae1dd',
            bgcolor: '#e8eeeb',
          }}
        />

        {selectedCrossing && (
          <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
            <Typography variant="h6">Mapped crossing #{selectedCrossing.id}</Typography>
            <Typography variant="body2">OSM crossing type: {selectedCrossing.tags.crossing ?? 'Not documented'}</Typography>
            <Typography variant="body2">
              Coordinates: {selectedCrossing.lat.toFixed(5)}, {selectedCrossing.lon.toFixed(5)}
            </Typography>
            <Link
              href={`https://www.openstreetmap.org/node/${selectedCrossing.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open original OpenStreetMap record
            </Link>
          </Paper>
        )}

        {selectedStudy && (
          <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
            <Stack spacing={0.5}>
              <Typography variant="h6">{selectedStudy.label}: {selectedStudy.locationText}</Typography>
              <Typography variant="body2">
                Sample measured volume: <strong>{selectedStudy.sample.vehicles.toLocaleString()} vehicles</strong>
              </Typography>
              <Typography variant="body2">
                {selectedStudy.sample.date} · {selectedStudy.sample.direction}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedStudy.sample.description}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedStudy.positionNote}
              </Typography>
              <Link href={selectedStudy.sourceUrl} target="_blank" rel="noopener noreferrer">
                Open Bedford source data
              </Link>
            </Stack>
          </Paper>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Map © OpenStreetMap contributors; basemap by OpenFreeMap. Crossing inventory is retrieved on demand using the
          Overpass API. Traffic-study values come from the Town of Bedford Great Road Traffic Optimization Study,
          Appendix D. Study-site marker positions are approximate within the named road segments because the report does
          not provide GPS coordinates. These measurements are historical observations, not current traffic conditions or
          safety scores.
        </Typography>
      </Container>
    </Box>
  );
}
