import { useEffect, useRef } from 'react';
import { AppBar, Box, Chip, Container, Stack, Toolbar, Typography } from '@mui/material';
import maplibregl from 'maplibre-gl';
import { PROJECT_NAME } from '@msef/core';

export default function App() {
  const mapEl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mapEl.current) return;
    const map = new maplibregl.Map({
      container: mapEl.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [-71.273, 42.491],
      zoom: 12
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    return () => map.remove();
  }, []);
  return <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7f6' }}>
    <AppBar position="static" elevation={0}><Toolbar><Typography variant="h6">{PROJECT_NAME}</Typography></Toolbar></AppBar>
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ mr: 1 }}>Explore Bedford</Typography>
        <Chip label="Research prototype" size="small" variant="outlined" />
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Map foundation only. Verified crossing data and lower-risk routes will be added after data ingestion and validation.</Typography>
      <Box ref={mapEl} role="region" aria-label="Interactive map of Bedford, Massachusetts" sx={{ height: { xs: 420, md: 600 }, borderRadius: 2, overflow: 'hidden', border: '1px solid #dae1dd' }}/>
      <Typography variant="caption" color="text.secondary">Map tiles are demonstration data, not a verified pedestrian safety assessment.</Typography>
    </Container>
  </Box>;
}
