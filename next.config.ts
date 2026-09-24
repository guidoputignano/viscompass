import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // No file tracing for compiled data: nothing reads it from disk any more. The
  // bulk-export route was removed rather than gated, so the compiled series is
  // never delivered whole to anyone, signed in or not.
};

export default nextConfig;
