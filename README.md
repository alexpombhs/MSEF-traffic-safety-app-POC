# MSEF Traffic Safety App

Research POC to make Bedford, Massachusetts traffic and pedestrian-crossing data understandable and eventually compare walking routes.

## Quick start

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev:web
```

The web app runs with a **demonstration map** only. It does not present crossing scores or claim any route is safe. To open the native shell, run `npm run start:mobile` (Expo).

## Structure

- `apps/web` — React, Vite, Material UI, MapLibre GL JS
- `apps/mobile` — Expo / React Native starter screen
- `packages/core` — shared types and research metadata
- `services/data-pipeline` — reserved for reproducible Python imports
- `supabase` — reserved for versioned PostGIS migrations

## Research safeguards

Keep measured facts, design features, survey perceptions and estimated risk distinct. Include source references, dates, and data confidence; never manufacture speeds, routes or safety scores.

## Roadmap

1. Verified crosswalk inventory and source metadata
2. Supabase/PostGIS schema and data import
3. Explainable crossing-condition assessments
4. Candidate walking routes and evidence-based comparison
5. Native MapLibre integration with an Expo development build
