import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, AppBar, Box, Button, Card, CardContent, Chip, CircularProgress, Container, Divider, FormControlLabel,
  Link, List, ListItemButton, ListItemText, Paper, Stack, Switch, Tab, Tabs, Toolbar, Typography,
} from '@mui/material';
import { PROJECT_NAME } from '@msef/core';
import { loadOSMCrossings, parseCrossingGeoJSON, type OSMCrossing } from './osmCrossings';
import { trafficStudySites, type TrafficStudySite } from './trafficStudySites';
import ResearchWorkspace from './ResearchWorkspace';
import { documentedCrossingAreas } from './documentedCrossingAreas';
import { repositoryCrossings, readSavedCrossings, saveCrossings, mergeCrossings } from './crossingInventory';
import { studyIntersections, intersectionSource } from './studyIntersections';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';

const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const SAFETY_SOURCE = 'https://www.bedfordma.gov/DocumentCenter/View/2044/Appendix-B-Safety-Analysis---Bedford-Great-Road-Traffic-Optimization';
const STUDY_SOURCE = 'https://bedfordma.gov/768/Great-Road-Traffic-Optimization-Study';
const CRASH_PORTAL = 'https://apps.crashdata.dot.mass.gov/cdp/home';
const improvements = 'https://bedfordma.gov/1033/Great-Road-Improvement-Project';

function crossingFeatures(points: OSMCrossing[]) {
  return {
    type: 'FeatureCollection' as const,
    features: points.map(point => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [point.lon, point.lat] },
      properties: { id: point.id },
    })),
  };
}

function studyFeatures(points: TrafficStudySite[]) {
  return {
    type: 'FeatureCollection' as const,
    features: points.map(point => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [point.lon, point.lat] },
      properties: { id: point.id },
    })),
  };
}

function fieldValue(value?: string) {
  return value && value !== 'no' ? value.replace(/_/g, ' ') : value === 'no' ? 'No (OSM)' : 'Unknown';
}

const surveyFields = [
  { label: 'Crossing markings', key: 'crossing:markings' },
  { label: 'Traffic signals', key: 'crossing:signals' },
  { label: 'Curb ramps', key: 'kerb' },
  { label: 'Tactile paving', key: 'tactile_paving' },
  { label: 'Pedestrian island', key: 'crossing:island' },
  { label: 'Lighting', key: 'lit' },
] as const;

export default function App() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [crossings, setCrossings] = useState<OSMCrossing[]>(() => mergeCrossings(repositoryCrossings, readSavedCrossings()));
  const [loaded, setLoaded] = useState(true);
  const [crossingLoadStatus, setCrossingLoadStatus] = useState('Local crosswalk inventory loaded');
  const [crossingSource, setCrossingSource] = useState('Repository GeoJSON + local saved crossings');
  const [reload, setReload] = useState(0);
  const [selectedCrossingId, setSelectedCrossingId] = useState<number | null>(null);
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [showTrafficStations, setShowTrafficStations] = useState(false);
  const [activeTab, setActiveTab] = useState<'explore' | 'entry'>('explore');

  const selectedCrossing = useMemo(
    () => crossings.find(c => c.id === selectedCrossingId) ?? null,
    [crossings, selectedCrossingId],
  );
  const selectedStudy = trafficStudySites.find(s => s.id === selectedStudyId) ?? null;
  const selectedArea = documentedCrossingAreas.find(a => a.id === selectedAreaId) ?? null;
  const needSurvey = (point: OSMCrossing) => surveyFields.some(f => !point.tags[f.key]);
  const visibleCrossings = crossings.filter(point => !onlyMissing || needSurvey(point));

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
          center: [-71.275, 42.49],
          zoom: 13.5,
        });
        mapRef.current = map;
        map.addControl(new lib.NavigationControl(), 'top-right');
        map.on('load', () => {
          if (disposed || !map) return;
          setMapReady(true);
          map.addSource('crossings', { type: 'geojson', data: crossingFeatures([]) });
          map.addLayer({
            id: 'crossings-points', type: 'circle', source: 'crossings',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 5, 15, 9],
              'circle-color': '#087d72', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2,
            },
          });
          map.addSource('documented-crossing-areas', { type: 'geojson', data: {
            type: 'FeatureCollection',
            features: documentedCrossingAreas.map(area => ({
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: [area.lon, area.lat] },
              properties: { id: area.id },
            })),
          } });
          map.addLayer({
            id: 'documented-crossing-areas-points', type: 'circle', source: 'documented-crossing-areas',
            paint: {
              'circle-radius': 11,
              'circle-color': '#7650a4',
              'circle-opacity': 0.55,
              'circle-stroke-color': '#50366d',
              'circle-stroke-width': 2,
            },
          });
          map.on('click', 'documented-crossing-areas-points', event => {
            const id = String(event.features?.[0]?.properties?.id ?? '');
            if (id) window.dispatchEvent(new CustomEvent('msef-select-crossing-area', { detail: id }));
          });
          map.addSource('traffic-study-sites', { type: 'geojson', data: studyFeatures(trafficStudySites) });
          map.addLayer({
            id: 'traffic-study-sites-points', type: 'circle', source: 'traffic-study-sites',
            layout: { visibility: 'none' },
            paint: {
              'circle-radius': 10, 'circle-color': '#b76521',
              'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5,
            },
          });
          map.on('click', 'crossings-points', event => {
            const id = Number(event.features?.[0]?.properties?.id);
            if (Number.isFinite(id)) window.dispatchEvent(new CustomEvent('msef-select-crossing', { detail: id }));
          });
          map.on('click', 'traffic-study-sites-points', event => {
            const id = String(event.features?.[0]?.properties?.id ?? '');
            if (id) window.dispatchEvent(new CustomEvent('msef-select-study', { detail: id }));
          });
          for (const layer of ['crossings-points', 'traffic-study-sites-points']) {
            map.on('mouseenter', layer, () => { if (map) map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', layer, () => { if (map) map.getCanvas().style.cursor = ''; });
          }
        });
        map.on('error', event => {
          console.error('MapLibre:', event.error);
          if (!disposed) setMapError('The map service could not load. See the browser console.');
        });
      } catch (error) {
        console.error('Map startup:', error);
        if (!disposed) setMapError('Unable to start the map. See the browser console.');
      }
    }
    void initializeMap();
    return () => { disposed = true; mapRef.current = null; map?.remove(); };
  }, []);

  // Network refresh is explicitly requested. The initial map uses a local snapshot.
  useEffect(() => {
    if (reload === 0) return;
    const controller = new AbortController();
    setLoaded(false);
    setDataError(null);
    setCrossingLoadStatus('Checking OpenStreetMap for crossing updates…');
    loadOSMCrossings(controller.signal)
      .then(points => {
        if (controller.signal.aborted) return;
        const combined = mergeCrossings(repositoryCrossings, readSavedCrossings(), points);
        setCrossings(combined);
        try {
          saveCrossings(combined);
          setCrossingSource('Repository GeoJSON + cached OSM refresh');
        } catch {
          setCrossingSource('Repository GeoJSON + OSM (save blocked)');
          setDataError('Crossings loaded but this browser could not save them for next time. Export a backup.');
        }
        setLoaded(true);
        setCrossingLoadStatus(`${combined.length} crossings available; ${points.length} found in live OSM refresh`);
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        setDataError(`Live refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}. Saved crossings remain available.`);
        setCrossingLoadStatus('Using saved crosswalk inventory');
        setLoaded(true);
      });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    if (!mapReady) return;
    (mapRef.current?.getSource('crossings') as GeoJSONSource | undefined)
      ?.setData(crossingFeatures(visibleCrossings));
  }, [crossings, onlyMissing, mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (map?.getLayer('traffic-study-sites-points')) {
      map.setLayoutProperty('traffic-study-sites-points', 'visibility', showTrafficStations ? 'visible' : 'none');
    }
  }, [mapReady, showTrafficStations]);

  useEffect(() => {
    const cross = (event: Event) => {
      setSelectedCrossingId((event as CustomEvent<number>).detail);
      setSelectedStudyId(null);
    };
    const study = (event: Event) => {
      setSelectedStudyId((event as CustomEvent<string>).detail);
      setSelectedCrossingId(null);
    };
    const area = (event: Event) => { setSelectedAreaId((event as CustomEvent<string>).detail); setSelectedCrossingId(null); setSelectedStudyId(null); };
    window.addEventListener('msef-select-crossing-area', area);
    window.addEventListener('msef-select-crossing', cross);
    window.addEventListener('msef-select-study', study);
    return () => {
      window.removeEventListener('msef-select-crossing-area', area);
      window.removeEventListener('msef-select-crossing', cross);
      window.removeEventListener('msef-select-study', study);
    };
  }, []);

  function pickCrossing(point: OSMCrossing) {
    setSelectedCrossingId(point.id);
    setSelectedStudyId(null);
    mapRef.current?.flyTo({ center: [point.lon, point.lat], zoom: 16 });
  }

  function pickStudy(site: TrafficStudySite) {
    setShowTrafficStations(true);
    setSelectedStudyId(site.id);
    setSelectedCrossingId(null);
    mapRef.current?.flyTo({ center: [site.lon, site.lat], zoom: 15 });
  }

  async function importGeoJSON(file: File | undefined) {
    if (!file) return;
    try {
      const points = parseCrossingGeoJSON(JSON.parse(await file.text()) as unknown);
      if (!points.length) throw new Error('No valid Bedford-area point records in the file');
      const combined = mergeCrossings(repositoryCrossings, readSavedCrossings(), points);
      setCrossings(combined);
      setLoaded(true);
      setDataError(null);
      try { saveCrossings(combined); } catch { setDataError('Imported crossings are visible but could not be saved in this browser.'); }
      setCrossingSource('Repository GeoJSON + imported local GeoJSON');
      setCrossingLoadStatus(`${combined.length} candidates available (${points.length} newly imported)`);
    } catch (error) {
      setDataError(`Import failed: ${error instanceof Error ? error.message : 'Invalid file'}`);
    }
  }

  function exportInventory() {
    const headers = ['osm_id', 'latitude', 'longitude', 'crossing_type', ...surveyFields.map(field => field.key), 'source_url'];
    const rows = crossings.map(c => [
      c.id, c.lat, c.lon, c.tags.crossing ?? '',
      ...surveyFields.map(field => c.tags[field.key] ?? ''),
      `https://www.openstreetmap.org/node/${c.id}`,
    ]);
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'great-road-crossing-inventory.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7f6' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar><Typography variant="h6">{PROJECT_NAME} / Great Road Research</Typography></Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack spacing={0.8} sx={{ mb: 3 }}>
          <Typography variant="h4">Great Road · Crosswalk safety inventory</Typography>
          <Typography color="text.secondary">
            Explore mapped crossings, check documented infrastructure, and identify missing field observations.
            This is a research inventory, not a verified safety ranking.
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip color="primary" variant="outlined" icon={!loaded ? <CircularProgress size={14} color="inherit" /> : undefined} label={loaded ? `${crossings.length} candidate crossings in inventory` : 'Refreshing crossings…'} />
            <Chip variant="outlined" label={`${trafficStudySites.length} historic traffic stations (hidden by default)`} />
            <Chip variant="outlined" label="Crash records not yet linked to crossings" />
          </Stack>
        </Stack>

        <Paper variant="outlined" sx={{ mb: 2 }}>
          <Tabs value={activeTab} onChange={(_, value: 'explore' | 'entry') => {
            setActiveTab(value);
            if (value === 'explore') window.setTimeout(() => mapRef.current?.resize(), 0);
          }} aria-label="Great Road research sections">
            <Tab value="explore" label="Explore & Analyze" />
            <Tab value="entry" label="Field Data Entry" />
          </Tabs>
        </Paper>

        <Box role="tabpanel" aria-label="Explore and analyze" hidden={activeTab !== 'explore'} sx={{ display: activeTab === 'explore' ? 'block' : 'none' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(300px, 1fr)' }, gap: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" useFlexGap flexWrap="wrap">
                <Stack direction="row" spacing={2} alignItems="center" useFlexGap flexWrap="wrap">
                  <Chip size="small" label="● Crossing candidates (OSM)" sx={{ bgcolor: '#d9f1ec', color: '#075c53' }} />
                  <Chip size="small" label="● Documented crossing areas (approximate)" sx={{ bgcolor: '#ede4f6', color: '#50366d' }} />
                  <FormControlLabel control={<Switch size="small" checked={showTrafficStations} onChange={(_, visible) => { setShowTrafficStations(visible); if (!visible) setSelectedStudyId(null); }} />} label="Show traffic-count stations (2021)" />
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                  <Button size="small" onClick={() => setReload(n => n + 1)}>Retry live data</Button>
                </Stack>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                {!loaded && <CircularProgress size={16} aria-label="Loading crossings" />}
                <Typography variant="caption" color="text.secondary" role="status">{crossingLoadStatus}</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" display="block">Data source: {crossingSource}</Typography>
              {mapError && <Alert severity="warning" sx={{ my: 1 }}>{mapError}</Alert>}
              {dataError && <Alert severity="warning" sx={{ my: 1 }}>{dataError}</Alert>}
              {loaded && crossings.length === 0 && <Alert severity="info" sx={{ my: 1 }}>Purple reference markers are documented crossing AREAS, not exact crosswalks. The versioned inventory does not yet contain verified crossing coordinates. Import a sourced GeoJSON file or use Retry live data to discover candidates. No locations have been invented.</Alert>}
              {loaded && crossings.length === 0 && !dataError && <Alert severity="info" sx={{ my: 1 }}>No OpenStreetMap crossings were returned; the inventory is not complete.</Alert>}
              {!mapReady && !mapError && <Typography sx={{ my: 1 }}>Loading map…</Typography>}
              <Box ref={mapEl} role="region" aria-label="Great Road crossing and historic traffic map"
                sx={{ mt: 2, height: { xs: 370, md: 520 }, bgcolor: '#e6ece9', borderRadius: 1.5, overflow: 'hidden' }} />
              <Typography variant="caption" color="text.secondary">
                Crossing candidates are sourced from OpenStreetMap; they require verification against Bedford's latest plans.
                Orange station markers have approximate positions, not survey coordinates.
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6">Evidence available now</Typography>
              <Stack spacing={2} sx={{ mt: 1.5 }}>
                <Box>
                  <Typography fontWeight={600}>Great Road traffic study · 2021</Typography>
                  <Typography variant="body2" color="text.secondary">Measured counts at three stations. Stations are hidden on the map by default; choose a station below to display it and inspect its source.</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }} useFlexGap flexWrap="wrap">
                    {trafficStudySites.map(site => <Button key={site.id} variant={selectedStudyId === site.id ? 'contained' : 'outlined'} size="small" onClick={() => pickStudy(site)}>{site.label}</Button>)}
                  </Stack>
                </Box>
                <Divider />
                <Box>
                  <Typography fontWeight={600}>Crash analysis · 2017–2019</Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ my: 1 }}>
                    <Chip label="214 corridor crashes" />
                    <Chip label="43 injury crashes" />
                    <Chip label="1 pedestrian + 9 bicycle crashes" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Published corridor-level historical totals. Individual crash coordinates, annual trends and crossing associations have not yet been imported.
                    These totals do not establish the safety of any individual crossing.
                  </Typography>
                  <Link href={SAFETY_SOURCE} target="_blank" rel="noopener noreferrer">Bedford safety analysis (Appendix B)</Link>
                  {' · '}
                  <Link href={CRASH_PORTAL} target="_blank" rel="noopener noreferrer">MassDOT crash portal</Link>
                </Box>
              </Stack>
            </Paper>
          </Box>

          <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Crossing inventory</Typography>
                <Button size="small" disabled={!crossings.length} onClick={exportInventory}>Export CSV</Button>
              </Stack>
              <FormControlLabel control={<Switch checked={onlyMissing} onChange={(_, value) => setOnlyMissing(value)} />} label="Show crossings needing survey" />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {visibleCrossings.length} displayed · OSM candidates near Great Road, not a certified full inventory
              </Typography>
              <List dense sx={{ maxHeight: 325, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                {visibleCrossings.map((point, index) => (
                  <ListItemButton key={point.id} selected={selectedCrossingId === point.id} onClick={() => pickCrossing(point)}>
                    <ListItemText
                      primary={`Crossing ${index + 1} · OSM #${point.id}`}
                      secondary={`${fieldValue(point.tags.crossing)} · ${needSurvey(point) ? 'Features incomplete' : 'OSM fields present'}`}
                    />
                  </ListItemButton>
                ))}
                {!visibleCrossings.length && <Typography sx={{ p: 2 }} variant="body2" color="text.secondary">
                  {loaded ? 'No crossings match this filter.' : 'Loading candidate inventory…'}
                </Typography>}
              </List>
            </Paper>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6">Selected location</Typography>
                {selectedArea ? (
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <Typography fontWeight={600}>{selectedArea.name}</Typography>
                    <Alert severity="info">Reference area only. This is NOT a surveyed crosswalk marker.</Alert>
                    <Typography variant="body2">{selectedArea.details}</Typography>
                    <Typography variant="body2" color="text.secondary">{selectedArea.locationPrecision}</Typography>
                    <Link href={selectedArea.source} target="_blank" rel="noopener noreferrer">Location source</Link>
                    <Link href={STUDY_SOURCE} target="_blank" rel="noopener noreferrer">Crossing study source</Link>
                  </Stack>
                ) : selectedCrossing ? (
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <Typography fontWeight={600}>OSM crossing #{selectedCrossing.id}</Typography>
                    <Typography variant="body2">Crossing type: {fieldValue(selectedCrossing.tags.crossing)}</Typography>
                    {surveyFields.map(field => (
                      <Stack direction="row" justifyContent="space-between" key={field.key} spacing={1}>
                        <Typography variant="body2" color="text.secondary">{field.label}</Typography>
                        <Chip size="small" color={selectedCrossing.tags[field.key] ? 'default' : 'warning'}
                          label={fieldValue(selectedCrossing.tags[field.key])} />
                      </Stack>
                    ))}
                    <Divider />
                    <Typography variant="body2">Vehicle volume: Unknown at crossing</Typography>
                    <Typography variant="body2">Pedestrian count: Unknown</Typography>
                    <Typography variant="body2">Crash history: Not matched</Typography>
                    <Typography variant="caption" color="text.secondary">All fields above are contributor tags, not on-site verification.</Typography>
                    <Link href={`https://www.openstreetmap.org/node/${selectedCrossing.id}`} target="_blank" rel="noopener noreferrer">View original crossing data</Link>
                  </Stack>
                ) : selectedStudy ? (
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <Typography fontWeight={600}>{selectedStudy.label} · {selectedStudy.locationText}</Typography>
                    <Typography variant="h4">{selectedStudy.sample.vehicles.toLocaleString()} vehicles</Typography>
                    <Typography variant="body2">{selectedStudy.sample.date} · {selectedStudy.sample.direction}</Typography>
                    <Typography variant="body2">{selectedStudy.sample.description}</Typography>
                    <Alert severity="info">{selectedStudy.positionNote} This is not a crosswalk-specific count.</Alert>
                    <Link href={selectedStudy.sourceUrl} target="_blank" rel="noopener noreferrer">Open original study table</Link>
                  </Stack>
                ) : <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Select a crossing, traffic-study station, or an item in the inventory.
                </Typography>}
              </CardContent>
            </Card>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6">Next data to obtain</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
                Verify every physical crossing and collect missing signals, markings, accessibility, lighting,
                actual vehicle speeds, pedestrian volumes and yielding observations.
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Link href={STUDY_SOURCE} target="_blank" rel="noopener noreferrer">Town study</Link>
                <Link href={improvements} target="_blank" rel="noopener noreferrer">Recent road changes</Link>
              </Stack>
            </Paper>
          </Stack>
        </Box>
        <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
          <Typography variant="h6">Great Road corridor audit · 11 study intersections</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
            Bedford's traffic study identifies these intersections. This list is available even if live
            OpenStreetMap requests fail. The intersections are NOT an inventory of individual
            crosswalks: each may contain several crossing approaches. Exact crossing locations
            and current features must still be verified using 2026 plans or field surveys.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1, mt: 1 }}>
            {studyIntersections.map((name, index) => (
              <Box key={name} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                <Typography variant="body2" fontWeight={600}>{index + 1}. {name}</Typography>
                <Chip label="Crosswalk count not verified" size="small" variant="outlined" sx={{ mt: 1 }} />
              </Box>
            ))}
          </Box>
          <Link href={intersectionSource} target="_blank" rel="noopener noreferrer" sx={{ display: 'block', mt: 2 }}>
            Source: Bedford Great Road Traffic Optimization Study intersection map
          </Link>
        </Paper>
        </Box>
        {activeTab === 'entry' && (
          <Box role="tabpanel" aria-label="Field data entry">
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6">Manage crossing inventory</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
                Import a sourced GeoJSON crossing inventory for this browser. This is separate from exploring and analyzing the map.
              </Typography>
              <Button component="label" variant="outlined" size="small">
                Import crossing GeoJSON
                <input type="file" accept=".geojson,.json,application/geo+json,application/json" hidden onChange={e => { void importGeoJSON(e.target.files?.[0]); e.target.value = ''; }} />
              </Button>
            </Paper>
            <ResearchWorkspace crossings={crossings} selectedId={selectedCrossingId} />
          </Box>
        )}
        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 2 }}>
          Map © OpenStreetMap contributors; basemap OpenFreeMap. Missing does not mean absent, zero or safe.
          Historic observations are not live traffic. No crosswalk-specific crash rates or safety scores have been inferred.
        </Typography>
      </Container>
    </Box>
  );
}
