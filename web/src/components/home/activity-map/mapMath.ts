import { geoMercator, geoPath } from "d3-geo";
import { VIEW_BBOX } from "./constants";

let cachedAspect: number | null = null;

/** Width/height ratio of VIEW_BBOX under a Mercator projection — computed once. */
export function mapAspectRatio(): number {
  if (cachedAspect) return cachedAspect;
  const p = geoMercator().fitExtent(
    [
      [0, 0],
      [1000, 100000],
    ],
    VIEW_BBOX
  );
  const a = p([101.6, 23.8]);
  const b = p([117.6, 7.4]);
  if (!a || !b) {
    cachedAspect = 1;
    return cachedAspect;
  }
  cachedAspect = Math.abs(b[0] - a[0]) / Math.abs(b[1] - a[1]);
  return cachedAspect;
}

/** Keep the map inside the host width at 1280–1920px without overflow. */
export function mapDims(hostWidth: number, maxHeight = 620) {
  const ar = mapAspectRatio();
  let W = Math.max(240, hostWidth || 640);
  let H = Math.round(W / ar);
  if (H > maxHeight) {
    H = maxHeight;
    W = Math.min(Math.round(H * ar), hostWidth || 640);
  }
  return { W: Math.round(W), H: Math.round(H) };
}

export function makeProjection(W: number, H: number, pad = 10) {
  const proj = geoMercator().fitExtent(
    [
      [pad, pad],
      [W - pad, H - pad],
    ],
    VIEW_BBOX
  );
  const path = geoPath(proj);
  return { proj, path };
}

/** d3.scaleSqrt([0, max], [rMin, rMax]) equivalent, without pulling in d3-scale. */
export function radiusScale(max: number, rMin = 2.6, rMax = 15) {
  const safeMax = max > 0 ? max : 1;
  return (v: number) => rMin + (rMax - rMin) * Math.sqrt(Math.max(v, 0) / safeMax);
}
