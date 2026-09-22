"use client";

import { useEffect, useState } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { ActivityMapData } from "@/domain/activity";
import { withBasePath } from "@/lib/basePath";

export type MapLoadState = "loading" | "loaded" | "empty" | "error" | "geo";

interface MapDataResult {
  state: MapLoadState;
  data: ActivityMapData | null;
  vnFeature: Feature<Geometry> | null;
  nearFeatures: Feature<Geometry>[];
}

let geoCache: FeatureCollection<Geometry> | null = null;

export function useActivityMapData(): MapDataResult {
  const [result, setResult] = useState<MapDataResult>({
    state: "loading",
    data: null,
    vnFeature: null,
    nearFeatures: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let data: ActivityMapData;
      try {
        // A fetch, not `getContentProvider().getActivityMap()` directly —
        // `DatabaseProvider` calls Prisma, which cannot run in a browser at
        // all (see `/api/activity-map/route.ts`'s own header comment for
        // why this indirection exists specifically for this hook).
        const res = await fetch(withBasePath("/api/activity-map"));
        if (!res.ok) throw new Error(`activity-map fetch failed: ${res.status}`);
        data = (await res.json()) as ActivityMapData;
      } catch {
        if (!cancelled) setResult({ state: "error", data: null, vnFeature: null, nearFeatures: [] });
        return;
      }

      try {
        if (!geoCache) {
          // Plain GeoJSON, not the world-atlas topojson this used to be — see
          // docs/ECOSYSTEM_INTEGRATION.md, "Đồ hoạ bản đồ" for how it's
          // generated. Exactly Vietnam (Natural Earth 10m: real coastline
          // detail, the small islands included) plus the fixed neighbour set
          // at a coarser 50m (they're backdrop only, never labelled or
          // clicked) — nothing else, so no runtime allowlist filter is
          // needed for "which features count as neighbours" the way the old
          // whole-world file needed one.
          const tr = await fetch(withBasePath("/data/vietnam-region-map.json"));
          if (!tr.ok) throw new Error("geo");
          geoCache = (await tr.json()) as FeatureCollection<Geometry>;
        }
        const land = geoCache.features;
        const vn = land.find((f) => (f.properties as { name?: string } | null)?.name === "Vietnam");
        const near = land.filter((f) => f !== vn);
        if (!vn) throw new Error("geo");
        if (cancelled) return;
        setResult({
          state: (data.provinces ?? []).length ? "loaded" : "empty",
          data,
          vnFeature: vn,
          nearFeatures: near,
        });
      } catch {
        if (!cancelled) setResult({ state: "geo", data, vnFeature: null, nearFeatures: [] });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return result;
}
