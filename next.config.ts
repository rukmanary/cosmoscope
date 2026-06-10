import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static site: every page prerenders, all data/textures are static
  // assets, and ephemerides run in the browser — no server needed.
  output: "export",
};

export default nextConfig;
