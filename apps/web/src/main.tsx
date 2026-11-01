import React from 'react';
import { createRoot } from 'react-dom/client';
import { Alert, Box, CssBaseline, ThemeProvider, Typography, createTheme } from '@mui/material';
import App from './App';
import 'maplibre-gl/dist/maplibre-gl.css';

const theme = createTheme({ palette: { primary: { main: '#235c54' } } });

class StartupErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App rendering failed:', error, info);
  }
  render() {
    if (this.state.error) {
      return <Box sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Bedford Traffic Safety Explorer</Typography>
        <Alert severity="error">
          The app could not start. Open your browser developer tools (F12 → Console) for details.
          <Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>
            {this.state.error.message}
          </Box>
        </Alert>
      </Box>;
    }
    return this.props.children;
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <StartupErrorBoundary><App /></StartupErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>,
);
