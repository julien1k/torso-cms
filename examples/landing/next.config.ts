import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { withCMS } from "torso-cms";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The docs are written in MDX, which Torso can edit like any other page.
  pageExtensions: ["ts", "tsx", "mdx"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withMDX = createMDX({});

export default withCMS(withMDX(nextConfig));
