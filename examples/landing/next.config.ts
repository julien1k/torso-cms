import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { withCMS } from "torso-cms";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The docs are written in MDX, which Torso can edit like any other page.
  pageExtensions: ["ts", "tsx", "mdx"],
  // Pages are also served as Markdown to clients that ask for it (see proxy.ts), so caches
  // must keep the two apart.
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Vary", value: "Accept" }] }];
  },
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
