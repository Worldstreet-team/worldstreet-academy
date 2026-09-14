import type { MetadataRoute } from "next"
import { appUrl } from "@/lib/app-url"

/**
 * /robots.txt — crawl the public site; keep the signed-in apps, the API and
 * the local-dev auth pages out. /verify stays crawlable on purpose: its pages
 * say noindex, and a crawler has to fetch a page to read that.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/instructor", "/admin", "/api/", "/login", "/register"],
    },
    sitemap: appUrl("/sitemap.xml"),
  }
}
