import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This workspace already has a project-owned, read-only AGENTS.md.
  // Prevent Next.js 16.3+ from trying to inject its own managed block into it.
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
