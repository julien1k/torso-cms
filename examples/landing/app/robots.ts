import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // /md holds the Markdown version of each page, which is served at the page's own address.
    rules: { userAgent: "*", allow: "/", disallow: ["/edit", "/md"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
