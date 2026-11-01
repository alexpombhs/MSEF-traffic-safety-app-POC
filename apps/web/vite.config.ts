import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    // Ensure that MUI, Emotion, and React DOM use the same React instance.
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    alias: {
      react: resolve(__dirname, '../../node_modules/react'),
      'react-dom': resolve(__dirname, '../../node_modules/react-dom'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom/client', '@mui/material', '@emotion/react', '@emotion/styled'],
  },
});
