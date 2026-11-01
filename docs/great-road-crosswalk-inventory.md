# Great Road crosswalk inventory

The app reads `apps/web/src/data/great-road-crosswalks.geojson` at startup. This is the
version-controlled source snapshot. The initial snapshot intentionally has zero features:
the full current 2026 crossing inventory has not been verified or geocoded.

## Adding actual crossings

1. Obtain an OpenStreetMap crossing export (GeoJSON) or georeference the crossing
   locations against Bedford's official 2026 striping plans.
2. Ensure each point has accurate WGS84 coordinates in `[longitude, latitude]` order,
   an ID, a source, and a verification status.
3. Add individual point features to `great-road-crosswalks.geojson` and commit the
   updated file. Never add approximate intersection centers as confirmed crosswalks.
4. Use **Import GeoJSON** in the app to review candidate locations before committing.
   Imported records are saved in this browser (localStorage); they are not automatically
   committed or synchronized to another device.
5. **Retry live data** is only a supplementary discovery action, not a prerequisite
   for opening the map. Successful refreshes are cached locally, but they do not
   automatically modify the repository snapshot.

Primary town source:
https://www.bedfordma.gov/1033/Great-Road-Improvement-Project

The Town reported new crosswalk striping scheduled for October 25, 2026. Verify
actual installations before treating a plan as a completed physical inventory.

## Interpretation

- An empty static dataset means **not yet sourced**, not **zero crosswalks**.
- OSM candidate nodes may omit actual crossings or include crossings on side streets.
- Historic ATR stations are not crossing locations and remain hidden by default.
- Traffic and crash counts cannot be assigned to a particular crossing without
  independently supported location matching.
