import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://leaguerankr.com"
  ).replace(/\/+$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/auth", "/my-history"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
