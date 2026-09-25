import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // AGENTS.md is hand-maintained: it is this project's working agreement and is
  // paired with CLAUDE.md. next dev appends a generated block to it on every
  // start, which edits a reviewed document without review and pushes the two
  // files further apart. The Next guidance is still readable in
  // node_modules/next/dist/docs/ for anyone who wants it.
  agentRules: false,
  // No file tracing for compiled data: nothing reads it from disk any more. The
  // bulk-export route was removed rather than gated, so the compiled series is
  // never delivered whole to anyone, signed in or not.
};

export default nextConfig;
