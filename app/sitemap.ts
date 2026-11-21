import type { MetadataRoute } from "next";
import { createPublicClient } from "@/utils/supabase/server";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://leaguerankr.com"
  ).replace(/\/+$/, "");

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${siteUrl}/browse`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/consensus`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/stats`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/create`,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  try {
    const supabase = createPublicClient();
    const [{ data: rankings }, { data: activeSeasons }] = await Promise.all([
      supabase
        .from("rankings")
        .select("id, ranking_type, published_at, updated_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(500),
      supabase.from("seasons").select("id").eq("is_active", true),
    ]);

    for (const r of rankings ?? []) {
      const path =
        r.ranking_type === "player" ? `/tierlist/${r.id}` : `/rankings/${r.id}`;
      const mod = r.updated_at || r.published_at;
      entries.push({
        url: `${siteUrl}${path}`,
        lastModified: mod ? new Date(mod) : undefined,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    const activeSeasonIds = (activeSeasons ?? []).map((s) => s.id);
    if (activeSeasonIds.length > 0) {
      const { data: divisions } = await supabase
        .from("divisions")
        .select("id")
        .in("season_id", activeSeasonIds);
      const divIds = (divisions ?? []).map((d) => d.id);
      if (divIds.length > 0) {
        const { data: teams } = await supabase
          .from("teams")
          .select("id")
          .in("division_id", divIds);
        for (const t of teams ?? []) {
          entries.push({
            url: `${siteUrl}/stats/team/${encodeURIComponent(t.id)}`,
            changeFrequency: "weekly",
            priority: 0.6,
          });
        }
      }
    }
  } catch {
    // Fallback cleanly to static routes if database fetch fails
  }

  return entries;
}
