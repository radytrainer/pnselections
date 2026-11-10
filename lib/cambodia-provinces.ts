/**
 * Approximate provincial-capital coordinates for Cambodia's 25 provinces,
 * keyed by the `code` column in the `provinces` table (see
 * docs/seed-data.sql). Used to plot circle markers on the map since we don't
 * yet have precise province boundary polygons (GeoJSON) — see the
 * "GeoJSON accuracy" risk in docs/11-roadmap.md and the future-enhancements
 * note in docs/12-future-enhancements.md. Swap this for a real choropleth
 * once a verified boundary dataset is sourced.
 */
export const PROVINCE_COORDINATES: Record<string, [number, number]> = {
  BMC: [13.7, 102.99],
  BTB: [13.0957, 103.2022],
  KPC: [12.0, 105.45],
  KPN: [12.2497, 104.665],
  KPSP: [11.4546, 104.5269],
  KPT: [12.7111, 104.8887],
  KPT2: [10.6104, 104.1817],
  KAN: [11.2, 105.0],
  KEP: [10.4833, 104.3167],
  KOH: [11.6153, 102.9836],
  KRT: [12.4881, 106.0186],
  MDK: [12.45, 107.1833],
  OMC: [14.1667, 103.5],
  PLN: [12.8489, 102.6075],
  PNH: [11.5564, 104.9282],
  PSH: [10.6104, 103.5294],
  PVH: [13.8068, 104.9744],
  PVG: [11.4861, 105.3251],
  PST: [12.5388, 103.9192],
  RTK: [13.7367, 106.9875],
  SRP: [13.3633, 103.8564],
  STR: [13.5259, 105.9683],
  SVR: [11.0877, 105.7993],
  TKO: [10.9908, 104.7849],
  TBK: [11.9, 105.7],
};

/** Geographic center of Cambodia, used as the map's initial view. */
export const CAMBODIA_CENTER: [number, number] = [12.5657, 104.991];

/** Cambodia's bounding box (padded slightly), used to keep the map locked
 * on Cambodia so neighboring countries (Thailand/Laos/Vietnam) stay out of
 * view instead of panning/zooming into view. */
export const CAMBODIA_BOUNDS: [[number, number], [number, number]] = [
  [9.0, 101.8],
  [15.0, 108.0],
];
