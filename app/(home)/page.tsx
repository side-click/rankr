import { RetroWindow } from "@/components/RetroWindow";
import { BetaHomeView } from "@/components/BetaHomeView";
import { loadBetaHomeData } from "@/utils/betaHomeData";
import { getFocusedSeasonSlug } from "@/utils/focusedSeasonServer";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const params = await searchParams;
  const effectiveSeason = await getFocusedSeasonSlug(params.season);
  const data = await loadBetaHomeData(effectiveSeason);

  if (data.allSeasons.length === 0) {
    return (
      <RetroWindow title="Database Setup Required" theme="xp">
        <div className="flex items-start gap-3 text-sm">
          <ShieldAlert className="w-6 h-6 text-[#f0c020] shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-bold text-[#f5f2e6]">
              Database tables not initialized.
            </p>
            <ol className="list-decimal list-inside space-y-1 text-xs tabular-nums p-2.5 xp-inset">
              <li>supabase/migrations/001_initial_schema.sql</li>
              <li>supabase/migrations/002_seed_season_4_5.sql</li>
              <li>supabase/migrations/003_add_leagues.sql</li>
              <li>supabase/migrations/004_league_short_name.sql</li>
            </ol>
          </div>
        </div>
      </RetroWindow>
    );
  }

  return <BetaHomeView data={data} />;
}
