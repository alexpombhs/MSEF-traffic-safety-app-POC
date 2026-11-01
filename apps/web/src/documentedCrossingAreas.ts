export type DocumentedCrossingArea = {
  id: string; name: string; lat: number; lon: number;
  locationPrecision: string; source: string; details: string;
};

// These are reference-area markers, NOT the coordinates of crosswalk markings.
// Town Hall position is the independently published coordinate of the building.
// Never promote this marker to a verified crosswalk without geocoding the crossing.
export const documentedCrossingAreas: DocumentedCrossingArea[] = [
  {
    id: 'town-hall-area',
    name: 'Town Hall crossing area',
    lat: 42.49169,
    lon: -71.28175,
    locationPrecision: 'Town Hall building location; crosswalk position not verified',
    source: 'https://mapcarta.com/W211982714',
    details: 'Bedford Great Road traffic study documents a Town Hall midblock crossing with flashing beacons (historical conditions). The point shown marks the building area, not the crossing.',
  },
];
