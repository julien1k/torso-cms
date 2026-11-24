import type { MetadataRoute } from "next";
import { allPages } from "@/lib/navigation";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return allPages.map(({ href }) => ({
    url: `${siteUrl}${href === "/" ? "" : href}`,
    priority: href === "/" ? 1 : 0.7,
  }));
}
