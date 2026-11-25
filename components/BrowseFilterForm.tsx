"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

export interface BrowseFilterSeasonOption {
  id: string;
  slug: string;
  name: string;
  leaguePrefix: string | null;
}

export interface BrowseFilterDivisionOption {
  id: string;
  slug: string;
  name: string;
  season_id: string;
}

export interface BrowseFilterEditionOption {
  id: string;
  slug: string;
  name: string;
  season_id: string;
}

interface BrowseFilterFormProps {
  seasons: BrowseFilterSeasonOption[];
  divisions: BrowseFilterDivisionOption[];
  editions: BrowseFilterEditionOption[];
  initialType: string;
  initialSeason: string;
  initialDivision: string;
  initialEdition: string;
  initialAuthor: string;
}

export function BrowseFilterForm({
  seasons,
  divisions,
  editions,
  initialType,
  initialSeason,
  initialDivision,
  initialEdition,
  initialAuthor,
}: BrowseFilterFormProps) {
  const [selectedSeason, setSelectedSeason] = useState<string>(initialSeason);
  const [selectedDivision, setSelectedDivision] =
    useState<string>(initialDivision);
  const [selectedEdition, setSelectedEdition] =
    useState<string>(initialEdition);

  const activeSeasonObj = useMemo(
    () => seasons.find((s) => s.slug === selectedSeason) ?? null,
    [seasons, selectedSeason]
  );

  const seasonDivisions = useMemo(
    () =>
      activeSeasonObj
        ? divisions.filter((d) => d.season_id === activeSeasonObj.id)
        : [],
    [divisions, activeSeasonObj]
  );

  const seasonEditions = useMemo(
    () =>
      activeSeasonObj
        ? editions.filter((e) => e.season_id === activeSeasonObj.id)
        : [],
    [editions, activeSeasonObj]
  );

  function handleSeasonChange(nextSlug: string) {
    setSelectedSeason(nextSlug);
    const nextSeasonObj = seasons.find((s) => s.slug === nextSlug) ?? null;
    if (!nextSeasonObj) {
      setSelectedDivision("");
      setSelectedEdition("");
      return;
    }
    const nextDivs = divisions.filter((d) => d.season_id === nextSeasonObj.id);
    if (!nextDivs.some((d) => d.slug === selectedDivision)) {
      setSelectedDivision("");
    }
    const nextEds = editions.filter((e) => e.season_id === nextSeasonObj.id);
    if (!nextEds.some((e) => e.slug === selectedEdition)) {
      setSelectedEdition("");
    }
  }

  return (
    <form
      method="GET"
      className="xp-panel p-3 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end"
    >
      <div>
        <label className="block text-[11px] font-bold text-[#d4d2c5] mb-1">
          Type
        </label>
        <select
          name="type"
          defaultValue={initialType}
          className="w-full xp-inset px-2 py-1.5 text-xs"
        >
          <option value="">All Types</option>
          <option value="team">Team Power Rankings</option>
          <option value="player">Player Tier Lists</option>
          <option value="blog">Blogs</option>
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-[#d4d2c5] mb-1">
          Season
        </label>
        <select
          name="season"
          value={selectedSeason}
          onChange={(e) => handleSeasonChange(e.target.value)}
          className="w-full xp-inset px-2 py-1.5 text-xs"
        >
          <option value="">All Seasons</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.leaguePrefix ? `${s.leaguePrefix}: ` : ""}
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-[#d4d2c5] mb-1">
          Division
        </label>
        <select
          name="division"
          value={selectedDivision}
          disabled={!activeSeasonObj}
          onChange={(e) => setSelectedDivision(e.target.value)}
          className="w-full xp-inset px-2 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!activeSeasonObj ? (
            <option value="">Select a season first...</option>
          ) : (
            <>
              {seasonDivisions.length !== 1 && (
                <option value="">All Divisions</option>
              )}
              {seasonDivisions.map((d) => (
                <option key={d.id} value={d.slug}>
                  {d.name}
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-[#d4d2c5] mb-1">
          Edition
        </label>
        <select
          name="edition"
          value={selectedEdition}
          disabled={!activeSeasonObj}
          onChange={(e) => setSelectedEdition(e.target.value)}
          className="w-full xp-inset px-2 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!activeSeasonObj ? (
            <option value="">Select a season first...</option>
          ) : (
            <>
              <option value="">All Editions</option>
              {seasonEditions.map((e) => (
                <option key={e.id} value={e.slug}>
                  {e.name}
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-[#d4d2c5] mb-1">
          Author
        </label>
        <input
          type="text"
          name="author"
          defaultValue={initialAuthor}
          placeholder="Author name..."
          className="w-full xp-inset px-2 py-1.5 text-xs"
        />
      </div>

      <div className="flex gap-2">
        <button type="submit" className="xp-btn xp-btn-primary text-xs flex-1">
          <Search className="w-3.5 h-3.5" />
          <span>Filter</span>
        </button>
        <Link href="/browse?season=" prefetch={false} className="xp-btn text-xs">
          Reset
        </Link>
      </div>
    </form>
  );
}
