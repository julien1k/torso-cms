import type { MetadataRoute } from "next";
import { pages, statusPage } from "@/lib/navigation";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", ...[...pages, statusPage].map((page) => page.href)].map((path) => ({
    url: `${siteUrl}${path === "/" ? "" : path}`,
    priority: path === "/" ? 1 : 0.7,
  }));
}
