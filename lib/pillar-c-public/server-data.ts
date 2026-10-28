import "server-only";
import asset from "@/data/public-compiled/pillar-c.json";
import type { PublicCData } from "@/lib/pillar-c-public/model";

/** A dedicated public-only build, bundled at deployment. No private Storage read or service key. */
export function getPublicPillarC(): PublicCData {
  if (asset.schema !== "public-pillar-c-v1" || asset.region !== "Abruzzo" || asset.trend.length !== 8 || asset.forecast.series.length !== 3) throw new Error("PUBLIC_C_DATA");
  return asset as PublicCData;
}
