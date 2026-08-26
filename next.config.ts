import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.244", "dev-mac"],
  // Lets the deploy script build into an alternate directory and swap it in
  // atomically, so the live server never reads a half-overwritten .next/.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
