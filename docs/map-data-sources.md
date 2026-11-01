# Geographic data provenance

## OpenStreetMap crossing locations (first working layer)

The web app requests nodes with `highway=crossing` from Overpass within the approximate Bedford-area bbox:
`42.466,-71.315,42.514,-71.236` (south, west, north, east).

- **Origin:** OpenStreetMap contributors (ODbL); requests use public Overpass instances.
- **Use:** Mapped crossing **locations only**, with original OSM node IDs and tags.
- **Limitations:** This is not a surveyed inventory, does not represent official town limits, and cannot establish whether a crossing is safe or exists unchanged today.
- **Failure:** Show a retrieval error with retry; do not populate fake coordinates.
- **Coverage:** Includes mapped crossing nodes within the bounding rectangle; some outside town may be included and some crossings may not be mapped.
- **Production consideration:** Use a cached server-side import and attribution rather than depending on a public Overpass API for each visitor. Follow OSM and tile-provider attribution/usage requirements.

## Next layers
The Bedford Great Road PDFs and survey materials need source-specific extraction, geographic matching and manual verification before appearing as measured data on the map. No safety score or route ranking is currently supported.
