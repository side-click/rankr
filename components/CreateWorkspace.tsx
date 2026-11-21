"use client";

import React, { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { FileText, Lock, User } from "lucide-react";
import { ChampionHelmetIcon } from "@/components/ChampionHelmetIcon";
import { SignInRequiredWindow } from "@/components/SignInRequiredWindow";
import { TeamGroupIcon } from "@/components/TeamGroupIcon";
import type {
  Blog,
  CreateContentType,
  Division,
  DivisionTheme,
  Edition,
  Season,
  SeasonPlayer,
  Team,
} from "@/types/database";
import { TeamRankingEditor } from "@/components/TeamRankingEditor";
import { ChampionPoolEditor } from "@/components/ChampionPoolEditor";
import { PlayerTierEditor } from "@/components/PlayerTierEditor";
import { BlogEditor } from "@/components/BlogEditor";

interface CreateWorkspaceProps {
  userId: string | null;
  initialAuthorName: string;
  initialAuthorAvatarUrl?: string | null;
  discordDefaultName: string;
  seasons: Season[];
  divisions: Division[];
  themes?: DivisionTheme[];
  editions: Edition[];
  teams: Team[];
  seasonPlayers: SeasonPlayer[];
  initialType?: CreateContentType;
  initialSeasonSlug?: string;
  initialDivisionSlug?: string;
  initialEditionSlug?: string;
  initialBlog?: Blog | null;
  requireAllowlist?: boolean;
}

export function CreateWorkspace({
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
  initialBlog,
  requireAllowlist = false,
}: CreateWorkspaceProps) {
  const [contentType, setContentType] = useState<CreateContentType>(initialType);
  const [activeTabDirty, setActiveTabDirty] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSelectContentType(nextType: CreateContentType) {
    if (nextType === contentType) return;
    if (
      activeTabDirty &&
      !window.confirm(
        "You have unsaved changes. Switch tabs and discard your unsaved work?"
      )
    ) {
      return;
    }
    setActiveTabDirty(false);
    setContentType(nextType);
    const params = new URLSearchParams(
      typeof window !== "undefined"
        ? window.location.search
        : searchParams.toString()
    );
    if (nextType === "player") {
      params.set("type", "player");
      params.delete("edit");
    } else if (nextType === "blog") {
      params.set("type", "blog");
      params.delete("variant");
    } else if (nextType === "champion_pool") {
      params.set("type", "champion_pool");
      params.delete("variant");
      params.delete("edit");
    } else {
      params.delete("type");
      params.delete("variant");
      params.delete("edit");
    }
    const qs = params.toString();
    const nextUrl = qs ? `${pathname}?${qs}` : pathname;
    window.history.replaceState(null, "", nextUrl);
  }

  return (
    <div className="space-y-4">
      {/* Graphical Mode Selector: Team Power Rankings vs Player Tier List vs Blog Post vs Champion Pool */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => handleSelectContentType("team")}
          className={`text-left p-2.5 rounded-lg border-2 transition-all cursor-pointer flex items-center gap-3 ${
            contentType === "team"
              ? "bg-[#221d12] border-[#f0c020] shadow-[0_0_20px_rgba(240,192,32,0.18)]"
              : "bg-[#15181f] border-white/10 hover:border-white/25 opacity-75 hover:opacity-100"
          }`}
        >
          <div
            className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
              contentType === "team"
                ? "bg-[#382e12] border-[#f0c020] text-[#f0c020]"
                : "bg-black/30 border-white/15 text-[#c89b3c]/70"
            }`}
          >
            <TeamGroupIcon className="w-5 h-5" />
          </div>
          <span
            className={`font-black text-sm tracking-tight ${
              contentType === "team" ? "text-[#f0c020]" : "text-[#f0ede0]"
            }`}
          >
            Team Power Rankings
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectContentType("player")}
          className={`text-left p-2.5 rounded-lg border-2 transition-all cursor-pointer flex items-center gap-3 ${
            contentType === "player"
              ? "bg-[#11241a] border-[#f0c020] shadow-[0_0_20px_rgba(240,192,32,0.18)]"
              : "bg-[#15181f] border-white/10 hover:border-white/25 opacity-75 hover:opacity-100"
          }`}
        >
          <div
            className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
              contentType === "player"
                ? "bg-[#1b3827] border-[#f0c020] text-[#f0c020]"
                : "bg-black/30 border-white/15 text-[#c89b3c]/70"
            }`}
          >
            <User className="w-5 h-5" />
          </div>
          <span
            className={`font-black text-sm tracking-tight ${
              contentType === "player" ? "text-[#f0c020]" : "text-[#f0ede0]"
            }`}
          >
            Player Tier List
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectContentType("blog")}
          className={`text-left p-2.5 rounded-lg border-2 transition-all cursor-pointer flex items-center gap-3 ${
            contentType === "blog"
              ? "bg-[#141e2e] border-[#f0c020] shadow-[0_0_20px_rgba(240,192,32,0.18)]"
              : "bg-[#15181f] border-white/10 hover:border-white/25 opacity-75 hover:opacity-100"
          }`}
        >
          <div
            className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
              contentType === "blog"
                ? "bg-[#1c2b42] border-[#f0c020] text-[#f0c020]"
                : "bg-black/30 border-white/15 text-[#c89b3c]/70"
            }`}
          >
            <FileText className="w-5 h-5" />
          </div>
          <span
            className={`font-black text-sm tracking-tight ${
              contentType === "blog" ? "text-[#f0c020]" : "text-[#f0ede0]"
            }`}
          >
            Blog Post
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectContentType("champion_pool")}
          className={`text-left p-2.5 rounded-lg border-2 transition-all cursor-pointer flex items-center gap-3 ${
            contentType === "champion_pool"
              ? "bg-[#11241a] border-[#f0c020] shadow-[0_0_20px_rgba(240,192,32,0.18)]"
              : "bg-[#15181f] border-white/10 hover:border-white/25 opacity-75 hover:opacity-100"
          }`}
        >
          <div
            className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
              contentType === "champion_pool"
                ? "bg-[#1b3827] border-[#f0c020] text-[#f0c020]"
                : "bg-black/30 border-white/15 text-[#c89b3c]/70"
            }`}
          >
            <ChampionHelmetIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span
              className={`font-black text-sm tracking-tight block ${
                contentType === "champion_pool"
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

      {contentType === "champion_pool" ? (
        <ChampionPoolEditor
          userId={userId}
          authorName={initialAuthorName || discordDefaultName}
          authorAvatarUrl={initialAuthorAvatarUrl}
          discordDefaultName={discordDefaultName}
          onUnsavedChange={setActiveTabDirty}
        />
      ) : !userId ? (
        <SignInRequiredWindow requireAllowlist={requireAllowlist} />
      ) : contentType === "team" ? (
        <TeamRankingEditor
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
          onUnsavedChange={setActiveTabDirty}
        />
      ) : contentType === "player" ? (
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
          onUnsavedChange={setActiveTabDirty}
        />
      ) : (
        <BlogEditor
          userId={userId}
          initialAuthorName={initialAuthorName}
          discordDefaultName={discordDefaultName}
          seasons={seasons}
          initialSeasonSlug={initialSeasonSlug}
          initialBlog={initialBlog}
        />
      )}
    </div>
  );
}
