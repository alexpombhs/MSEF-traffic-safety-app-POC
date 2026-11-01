import { useEffect, useRef, useState } from 'react';
import { Alert, AppBar, Box, Chip, Container, Stack, Toolbar, Typography } from '@mui/material';
import { PROJECT_NAME } from '@msef/core';

export default function App() {
  const mapEl = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    let map: import('maplibre-gl').Map | undefined;

    async function initializeMap() {
      if (!mapEl.current) return;
      try {
        // Import lazily so a map library failure does not prevent the page from rendering.
        const maplibregl = await import('maplibre-gl');
        if (disposed || !mapEl.current) return;
        if (!maplibregl.default.supported()) {
          setMapError('This browser does not support the WebGL features required by the map.');
          return;
        }
        map = new maplibregl.default.Map({
          container: mapEl.current,
          style: 'https://demotiles.maplibre.org/style.json',
          center: [-71.273, 42.491],
          zoom: 12,
        });
        map.addControl(new maplibregl.default.NavigationControl(), 'top-right');
        map.on('load', () => { if (!disposed) setMapReady(true); });
        map.on('error', (event) => {
          if (!disposed) {
            console.error('MapLibre error:', event.error);
            setMapError('Unable to load the demonstration map. Check your connection and browser console.');
          }
        });
      } catch (error) {
        console.error('Map initialization failed:', error);
        if (!disposed) setMapError('Unable to initialize the map. Check the browser console for details.');
      }
    }

    void initializeMap();
    return () => {
      disposed = true;
      map?.remove();
    };
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7f6' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar><Typography variant="h6">{PROJECT_NAME}</Typography></Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
          <Typography variant="h5" sx={{ mr: 1 }}>Explore Bedford</Typography>
          <Chip label="Research prototype" size="small" variant="outlined" />
        </Stack>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Map foundation only. Verified crossing data and lower-risk routes will be added after data ingestion and validation.
        </Typography>
        {mapError && <Alert severity="warning" sx={{ mb: 2 }}>{mapError}</Alert>}
        {!mapReady && !mapError && <Typography color="text.secondary" sx={{ mb: 1 }}>Loading demonstration map…</Typography>}
        <Box ref={mapEl} role="region" aria-label="Interactive map of Bedford, Massachusetts"
          sx={{ height: { xs: 420, md: 600 }, borderRadius: 2, overflow: 'hidden', border: '1px solid #dae1dd' }} />
        <Typography variant="caption" color="text.secondary">
          Map tiles are demonstration data, not a verified pedestrian safety assessment.
        </Typography>
      </Container>
    </Box>
  );
}
