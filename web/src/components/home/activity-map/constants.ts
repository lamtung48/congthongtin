import type { Feature, Polygon } from "geojson";

/** Countries whose land mass we draw faintly behind Vietnam for context. */
export const NEIGHBOURS = new Set(["Laos", "Cambodia", "Thailand", "China", "Myanmar", "Malaysia", "Philippines"]);

/** Same bounding box the prototype used to fit the Mercator projection — extends
 * east over the South China Sea so Hoàng Sa / Trườngng Sa fit in frame. */
export const VIEW_BBOX: Feature<Polygon> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [101.6, 23.8],
        [117.6, 23.8],
        [117.6, 7.4],
        [101.6, 7.4],
        [101.6, 23.8],
      ],
    ],
  },
};
