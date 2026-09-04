"use client";

import { useEffect, useState } from "react";
import * as topojson from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import type { ActivityMapData } from "@/domain/activity";
import { getActivityMap } from "@/services/homepageService";
import { withBasePath } from "@/lib/basePath";
import { NEIGHBOURS } from "./constants";

export type MapLoadState = "loading" | "loaded" | "empty" | "error" | "geo";

interface MapDataResult {
  state: MapLoadState;
  data: ActivityMapData | null;
  vnFeature: Feature<Geometry> | null;
  nearFeatures: Feature<Geometry>[];
}

let topoCache: Topology | null = null;

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
        data = await getActivityMap();
      } catch {
        if (!cancelled) setResult({ state: "error", data: null, vnFeature: null, nearFeatures: [] });
        return;
      }

      try {
        if (!topoCache) {
          const tr = await fetch(withBasePath("/data/countries-110m.json"));
          if (!tr.ok) throw new Error("geo");
          topoCache = (await tr.json()) as Topology;
        }
        const objects = topoCache.objects.countries;
        const land = (topojson.feature(topoCache, objects) as unknown as { features: Feature<Geometry>[] }).features;
        const vn = land.find(
          (f) => String(f.id) === "704" || /viet\s?nam/i.test((f.properties as { name?: string } | null)?.name ?? "")
        );
        const near = land.filter((f) => NEIGHBOURS.has((f.properties as { name?: string } | null)?.name ?? ""));
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
