import { ShieldAlert } from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { MatchSeriesContent } from "@/components/MatchSeriesContent";
import { loadAdminStatsContext } from "@/utils/riotStatsServer";

export const dynamic = "force-dynamic";

export default async function AdminMatchSeriesPage({
  params,
}: {
  params: Promise<{ seriesKey: string }>;
}) {
  const { seriesKey } = await params;
  const decodedKey = decodeURIComponent(seriesKey);
  const ctx = await loadAdminStatsContext({ includeRiotStats: false });

  if (!ctx.authorized) {
    return (
      <RetroWindow title="Match Results — Access Denied" theme="xp">
        <div className="py-8 px-4 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 mx-auto text-[#ff857a]" />
          <p className="text-xs text-[#a6a89e]">Admin Access Required.</p>
        </div>
      </RetroWindow>
    );
  }

  return (
    <MatchSeriesContent
      ctx={ctx}
      decodedKey={decodedKey}
      basePath="/admin/stats"
    />
  );
}
