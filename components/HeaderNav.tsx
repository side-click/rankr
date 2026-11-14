"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eye, ListOrdered } from "lucide-react";

interface HeaderSeasonOption {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  leagueName: string;
}

interface HeaderNavProps {
  seasons: HeaderSeasonOption[];
  isLoggedIn: boolean;
  isAdmin: boolean;
}

export function HeaderNav({ seasons, isLoggedIn, isAdmin }: HeaderNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlSeasonSlug = searchParams.get("season") ?? "";
  const selectedSeasonSlug =
    seasons.find((s) => s.slug === urlSeasonSlug)?.slug ??
    seasons.find((s) => s.is_active)?.slug ??
    seasons[0]?.slug ??
    "";

  function handleSeasonChange(newSlug: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (newSlug) {
      params.set("season", newSlug);
    } else {
      params.delete("season");
    }

    // If on /rank or /browse, stay on current page with new season; otherwise navigate to /rank
    if (pathname === "/rank" || pathname === "/browse") {
      // Clear division/edition when switching seasons so stale slugs don't persist
      params.delete("division");
      params.delete("edition");
      router.push(`${pathname}?${params.toString()}`);
    } else {
      router.push(`/rank?season=${encodeURIComponent(newSlug)}`);
    }
  }

  const seasonQuery = selectedSeasonSlug
    ? `?season=${encodeURIComponent(selectedSeasonSlug)}`
    : "";

  return (
    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
      <Link
        href="/"
        className="flex items-center gap-2 shrink-0 hover:brightness-110 transition"
      >
        <img
          src="/images/rankr_crop.png"
          alt="Rankr"
          className="w-7 h-7 object-contain drop-shadow"
        />
        <span className="wow-heading text-xl sm:text-2xl font-bold text-[#f0c020] tracking-wide">
          Rankr
        </span>
      </Link>

      {seasons.length > 0 && (
        <select
          aria-label="Select Season"
          value={selectedSeasonSlug}
          onChange={(e) => handleSeasonChange(e.target.value)}
          className="xp-inset px-2 py-1 text-xs font-bold w-[140px] sm:w-[195px] shrink-0 truncate"
        >
          {seasons.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.leagueName ? `${s.leagueName}: ` : ""}
              {s.name}
              {!s.is_active ? " (Inactive)" : ""}
            </option>
          ))}
        </select>
      )}

      <nav className="flex items-center gap-1 text-xs font-bold min-w-0">
        <Link
          href={`/rank${seasonQuery}`}
          className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-white/95 hover:bg-white/15 border border-transparent hover:border-white/30 whitespace-nowrap"
        >
          <ListOrdered className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
          <span>Create Ranking</span>
        </Link>
        <Link
          href={`/browse${seasonQuery}`}
          className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-white/95 hover:bg-white/15 border border-transparent hover:border-white/30 whitespace-nowrap"
        >
          <Eye className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
          <span>Published Rankings</span>
        </Link>
        {isLoggedIn && (
          <Link
            href="/my-rankings"
            className="px-2 py-1.5 rounded text-white/95 hover:bg-white/15 border border-transparent hover:border-white/30 whitespace-nowrap"
          >
            My History
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/admin"
            className="px-2 py-1.5 rounded text-[#ffe57f] bg-black/25 hover:bg-black/40 border border-[#f0c020]/60 whitespace-nowrap"
          >
            Admin
          </Link>
        )}
      </nav>
    </div>
  );
}
