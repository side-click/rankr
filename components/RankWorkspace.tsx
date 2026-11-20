"use client";

import React, { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Lock, User } from "lucide-react";
import { ChampionHelmetIcon } from "@/components/ChampionHelmetIcon";
import { TeamGroupIcon } from "@/components/TeamGroupIcon";
import type {
  Division,
  DivisionTheme,
  Edition,
  RankingType,
  Season,
  SeasonPlayer,
  Team,
} from "@/types/database";
import { BallotEditor } from "@/components/BallotEditor";
import { ChampionPoolEditor } from "@/components/ChampionPoolEditor";
import { PlayerTierEditor } from "@/components/PlayerTierEditor";

interface RankWorkspaceProps {
  userId: string;
  initialAuthorName: string;
  initialAuthorAvatarUrl?: string | null;
  discordDefaultName: string;
  seasons: Season[];
  divisions: Division[];
  themes?: DivisionTheme[];
  editions: Edition[];
  teams: Team[];
  seasonPlayers: SeasonPlayer[];
  initialType?: RankingType;
  initialSeasonSlug?: string;
  initialDivisionSlug?: string;
  initialEditionSlug?: string;
}

export function RankWorkspace({
  userId,
  initialAuthorName,
  initialAuthorAvatarUrl,
  discordDefaultName,
  seasons,
  divisions,
  themes,
  editions,
  teams,
  seasonPlayers,
  initialType = "team",
  initialSeasonSlug,
  initialDivisionSlug,
  initialEditionSlug,
}: RankWorkspaceProps) {
  const [rankingType, setRankingType] = useState<RankingType>(initialType);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSelectRankingType(nextType: RankingType) {
    setRankingType(nextType);
    const params = new URLSearchParams(
      typeof window !== "undefined"
        ? window.location.search
        : searchParams.toString()
    );
    if (nextType === "player") {
      params.set("type", "player");
    } else if (nextType === "champion_pool") {
      params.set("type", "champion_pool");
      params.delete("variant");
    } else {
      params.delete("type");
      params.delete("variant");
    }
    const qs = params.toString();
    const nextUrl = qs ? `${pathname}?${qs}` : pathname;
    window.history.replaceState(null, "", nextUrl);
    router.replace(nextUrl, { scroll: false });
  }

  return (
    <div className="space-y-4">
      {/* Graphical Mode Selector: Team Power Rankings vs Player Tier List vs Champion Pool */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => handleSelectRankingType("team")}
          className={`text-left p-2.5 rounded-lg border-2 transition-all cursor-pointer flex items-center gap-3 ${
            rankingType === "team"
              ? "bg-[#221d12] border-[#f0c020] shadow-[0_0_20px_rgba(240,192,32,0.18)]"
              : "bg-[#15181f] border-white/10 hover:border-white/25 opacity-75 hover:opacity-100"
          }`}
        >
          <div
            className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
              rankingType === "team"
                ? "bg-[#382e12] border-[#f0c020] text-[#f0c020]"
                : "bg-black/30 border-white/15 text-[#c89b3c]/70"
            }`}
          >
            <TeamGroupIcon className="w-5 h-5" />
          </div>
          <span
            className={`font-black text-sm tracking-tight ${
              rankingType === "team" ? "text-[#f0c020]" : "text-[#f0ede0]"
            }`}
          >
            Team Power Rankings
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectRankingType("player")}
          className={`text-left p-2.5 rounded-lg border-2 transition-all cursor-pointer flex items-center gap-3 ${
            rankingType === "player"
              ? "bg-[#11241a] border-[#f0c020] shadow-[0_0_20px_rgba(240,192,32,0.18)]"
              : "bg-[#15181f] border-white/10 hover:border-white/25 opacity-75 hover:opacity-100"
          }`}
        >
          <div
            className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
              rankingType === "player"
                ? "bg-[#1b3827] border-[#f0c020] text-[#f0c020]"
                : "bg-black/30 border-white/15 text-[#c89b3c]/70"
            }`}
          >
            <User className="w-5 h-5" />
          </div>
          <span
            className={`font-black text-sm tracking-tight ${
              rankingType === "player" ? "text-[#f0c020]" : "text-[#f0ede0]"
            }`}
          >
            Player Tier List
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectRankingType("champion_pool")}
          className={`text-left p-2.5 rounded-lg border-2 transition-all cursor-pointer flex items-center gap-3 ${
            rankingType === "champion_pool"
              ? "bg-[#11241a] border-[#f0c020] shadow-[0_0_20px_rgba(240,192,32,0.18)]"
              : "bg-[#15181f] border-white/10 hover:border-white/25 opacity-75 hover:opacity-100"
          }`}
        >
          <div
            className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
              rankingType === "champion_pool"
                ? "bg-[#1b3827] border-[#f0c020] text-[#f0c020]"
                : "bg-black/30 border-white/15 text-[#c89b3c]/70"
            }`}
          >
            <ChampionHelmetIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span
              className={`font-black text-sm tracking-tight block ${
                rankingType === "champion_pool"
                  ? "text-[#f0c020]"
                  : "text-[#f0ede0]"
              }`}
            >
              Champion Pool
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#a6a89e]">
              <Lock className="w-2.5 h-2.5" /> Private
            </span>
          </div>
        </button>
      </div>

      {rankingType === "team" ? (
        <BallotEditor
          userId={userId}
          initialAuthorName={initialAuthorName}
          discordDefaultName={discordDefaultName}
          seasons={seasons}
          divisions={divisions}
          themes={themes}
          editions={editions}
          teams={teams}
          initialSeasonSlug={initialSeasonSlug}
          initialDivisionSlug={
            initialDivisionSlug === "all" ? undefined : initialDivisionSlug
          }
          initialEditionSlug={initialEditionSlug}
        />
      ) : rankingType === "champion_pool" ? (
        <ChampionPoolEditor
          userId={userId}
          authorName={initialAuthorName || discordDefaultName}
          authorAvatarUrl={initialAuthorAvatarUrl}
          discordDefaultName={discordDefaultName}
        />
      ) : (
        <PlayerTierEditor
          userId={userId}
          initialAuthorName={initialAuthorName}
          discordDefaultName={discordDefaultName}
          seasons={seasons}
          divisions={divisions}
          themes={themes}
          editions={editions}
          teams={teams}
          seasonPlayers={seasonPlayers}
          initialSeasonSlug={initialSeasonSlug}
          initialDivisionSlug={initialDivisionSlug}
          initialEditionSlug={initialEditionSlug}
        />
      )}
    </div>
  );
}
