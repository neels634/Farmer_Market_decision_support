import type { NextConfig } from "next";

// Cache Components / partial prefetching are left off: every screen depends on
// per-browser demo state (localStorage) and the current date, so there is
// nothing useful to prerender and the stricter prerender rules only add noise.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
