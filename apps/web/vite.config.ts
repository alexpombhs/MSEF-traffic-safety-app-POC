import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    // Deduplicate shared React instances across npm workspaces.
    // Do not alias package names to directories: esbuild treats them as files.
    dedupe: ['react', 'react-dom'],
  },
});
