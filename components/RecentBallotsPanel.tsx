"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BallotCard, getLeaguePrefix, type BallotCardData } from "@/components/BallotCard";

interface SeasonOption {
  id: string;
  name: string;
  slug: string;
  leagues?:
    | { name?: string; short_name?: string | null; slug?: string }
    | { name?: string; short_name?: string | null; slug?: string }[]
    | null;
}

interface DivisionOption {
  id: string;
  season_id: string;
  name: string;
  slug: string;
}

interface RecentBallotsPanelProps {
  ballots: (BallotCardData & {
    season_id?: string | null;
    division_id?: string | null;
  })[];
  seasons: SeasonOption[];
  divisions: DivisionOption[];
}

export function RecentBallotsPanel({
  ballots,
  seasons,
  divisions,
}: RecentBallotsPanelProps) {
  const [seasonSlug, setSeasonSlug] = useState("");
  const [divisionSlug, setDivisionSlug] = useState("");

  const selectedSeason = seasons.find((s) => s.slug === seasonSlug) ?? null;

  const divisionOptions = useMemo(() => {
    const pool = selectedSeason
      ? divisions.filter((d) => d.season_id === selectedSeason.id)
      : divisions;
    return Array.from(new Map(pool.map((d) => [d.slug, d])).values());
  }, [divisions, selectedSeason]);

  const filteredBallots = useMemo(() => {
    return ballots
      .filter((b) => {
        if (selectedSeason) {
          const bSeason = Array.isArray(b.seasons) ? b.seasons[0] : b.seasons;
          const matchesSeason =
            b.season_id === selectedSeason.id ||
            bSeason?.slug === selectedSeason.slug;
          if (!matchesSeason) return false;
        }
        if (divisionSlug) {
          const bDiv = Array.isArray(b.divisions)
            ? b.divisions[0]
            : b.divisions;
          const matchingIds = divisions
            .filter((d) => d.slug === divisionSlug)
            .map((d) => d.id);
          const matchesDiv =
            (b.division_id && matchingIds.includes(b.division_id)) ||
            bDiv?.slug === divisionSlug;
          if (!matchesDiv) return false;
        }
        return true;
      })
      .slice(0, 6);
  }, [ballots, selectedSeason, divisionSlug, divisions]);

  function handleSeasonChange(nextSlug: string) {
    setSeasonSlug(nextSlug);
    if (nextSlug && divisionSlug) {
      const nextSeason = seasons.find((s) => s.slug === nextSlug);
      const hasDiv = nextSeason
        ? divisions.some(
            (d) => d.season_id === nextSeason.id && d.slug === divisionSlug
          )
        : false;
      if (!hasDiv) {
        setDivisionSlug("");
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex flex-wrap items-end gap-2.5">
          <div>
            <label className="block text-[11px] font-bold text-[#d4d2c5] mb-1">
              Season
            </label>
            <select
              value={seasonSlug}
              onChange={(e) => handleSeasonChange(e.target.value)}
              className="xp-inset px-2.5 py-1.5 text-xs min-w-[180px]"
            >
              <option value="">All Seasons</option>
              {seasons.map((s) => {
                const league = Array.isArray(s.leagues)
                  ? s.leagues[0]
                  : s.leagues;
                const prefix = getLeaguePrefix(league ?? null);
                return (
                  <option key={s.id} value={s.slug}>
                    {prefix ? `${prefix}: ` : ""}
                    {s.name}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#d4d2c5] mb-1">
              Division
            </label>
            <select
              value={divisionSlug}
              onChange={(e) => setDivisionSlug(e.target.value)}
              className="xp-inset px-2.5 py-1.5 text-xs min-w-[160px]"
            >
              <option value="">All Divisions</option>
              {divisionOptions.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Link href="/browse" className="xp-btn text-xs">
          <span>Browse All →</span>
        </Link>
      </div>

      {filteredBallots.length === 0 ? (
        <div className="xp-inset p-6 text-center text-xs text-[#a6a89e]">
          No published rankings match the selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredBallots.map((b) => (
            <BallotCard key={b.id} ballot={b} />
          ))}
        </div>
      )}
    </div>
  );
}
