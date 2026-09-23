import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The compiled public series lives outside `public/` so Next never serves it
  // as a static asset; the export route reads it from disk, so it has to be
  // traced into the deployment explicitly.
  outputFileTracingIncludes: {
    "/api/pillar-a/export": ["./data/public-compiled/*.csv"],
  },
};

export default nextConfig;
