import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next generates AGENTS.md/CLAUDE.md by default; this repo keeps its agent
  // guidance in docs/ instead of per-app generated files.
  agentRules: false,
};

export default nextConfig;
