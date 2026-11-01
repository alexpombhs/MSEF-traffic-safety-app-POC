export type TrafficStudySite = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  locationText: string;
  positionNote: string;
  sourceName: string;
  sourceUrl: string;
  sample: {
    date: string;
    direction: string;
    vehicles: number;
    description: string;
  };
};

export const trafficStudySites: TrafficStudySite[] = [
  {
    id: 'atr-a',
    label: 'ATR-A',
    lat: 42.4911,
    lon: -71.2836,
    locationText: 'Great Road (Route 4), west of Mudge Way',
    positionNote: 'Approximate map position within the road segment named in the study.',
    sourceName: 'Bedford Great Road Traffic Optimization Study — Appendix D',
    sourceUrl: 'https://bedfordma.gov/DocumentCenter/View/2046/Appendix-D-Traffic-Count-Data---Bedford-Great-Road-Traffic-Optimization',
    sample: {
      date: 'October 15, 2021',
      direction: 'EB + WB combined',
      vehicles: 15343,
      description: '24-hour traffic volume reported for Friday.',
    },
  },
  {
    id: 'atr-b',
    label: 'ATR-B',
    lat: 42.4877,
    lon: -71.2734,
    locationText: 'Great Road, east of Loomis Road',
    positionNote: 'Approximate map position within the road segment named in the study.',
    sourceName: 'Bedford Great Road Traffic Optimization Study — Appendix D',
    sourceUrl: 'https://bedfordma.gov/DocumentCenter/View/2046/Appendix-D-Traffic-Count-Data---Bedford-Great-Road-Traffic-Optimization',
    sample: {
      date: 'October 25, 2021',
      direction: 'WB',
      vehicles: 10659,
      description: '24-hour westbound classified-traffic total reported for Monday.',
    },
  },
  {
    id: 'atr-c',
    label: 'ATR-C',
    lat: 42.4856,
    lon: -71.2604,
    locationText: 'Great Road, west of Shawsheen Road',
    positionNote: 'Approximate map position within the road segment named in the study.',
    sourceName: 'Bedford Great Road Traffic Optimization Study — Appendix D',
    sourceUrl: 'https://bedfordma.gov/DocumentCenter/View/2046/Appendix-D-Traffic-Count-Data---Bedford-Great-Road-Traffic-Optimization',
    sample: {
      date: 'October 26, 2021',
      direction: 'WB',
      vehicles: 8761,
      description: '24-hour westbound classified-traffic total reported for Tuesday.',
    },
  },
];
