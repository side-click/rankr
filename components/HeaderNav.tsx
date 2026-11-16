"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eye, History, ListOrdered, Menu, Shield, X } from "lucide-react";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlSeasonSlug = searchParams.get("season") ?? "";
  const selectedSeasonSlug =
    seasons.find((s) => s.slug === urlSeasonSlug)?.slug ?? "";

  function handleSeasonChange(newSlug: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (newSlug) {
      params.set("season", newSlug);
    } else {
      params.delete("season");
    }

    if (pathname === "/rank" || pathname === "/browse") {
      // Clear division/edition when switching seasons so stale slugs don't persist
      params.delete("division");
      params.delete("edition");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const seasonQuery = selectedSeasonSlug
    ? `?season=${encodeURIComponent(selectedSeasonSlug)}`
    : "";

  return (
    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
      <Link
        href="/"
        className="flex items-center gap-2.5 shrink-0 hover:brightness-110 transition"
      >
        <img
          src="/images/rankr_crop.png"
          alt="Rankr"
          className="w-10 h-10 sm:w-11 sm:h-11 object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)] drop-shadow-[0_6px_12px_rgba(0,0,0,0.75)]"
        />
        <span className="wow-heading text-2xl sm:text-3xl font-bold text-[#f0c020] tracking-wide">
          Rankr
        </span>
      </Link>

      {seasons.length > 0 && (
        <select
          aria-label="Select Season"
          value={selectedSeasonSlug}
          onChange={(e) => handleSeasonChange(e.target.value)}
          className="hidden md:block xp-inset px-2 py-1 text-xs font-bold w-[175px] lg:w-[195px] shrink-0 truncate"
        >
          <option value="">Select a Season</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.leagueName ? `${s.leagueName}: ` : ""}
              {s.name}
              {!s.is_active ? " (Inactive)" : ""}
            </option>
          ))}
        </select>
      )}

      <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 text-[11px] lg:text-xs font-bold min-w-0">
        <Link
          href={`/rank${seasonQuery}`}
          className="inline-flex items-center gap-1 lg:gap-1.5 px-1.5 lg:px-2 py-1.5 rounded text-white/95 hover:bg-white/15 border border-transparent hover:border-white/30 whitespace-nowrap"
        >
          <ListOrdered className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
          <span>Create Ranking</span>
        </Link>
        <Link
          href={`/browse${seasonQuery}`}
          className="inline-flex items-center gap-1 lg:gap-1.5 px-1.5 lg:px-2 py-1.5 rounded text-white/95 hover:bg-white/15 border border-transparent hover:border-white/30 whitespace-nowrap"
        >
          <Eye className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
          <span>Browse Rankings</span>
        </Link>
        {isLoggedIn && (
          <Link
            href="/my-rankings"
            className="inline-flex items-center gap-1 lg:gap-1.5 px-1.5 lg:px-2 py-1.5 rounded text-white/95 hover:bg-white/15 border border-transparent hover:border-white/30 whitespace-nowrap"
          >
            <History className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
            <span>My History</span>
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 lg:gap-1.5 px-1.5 lg:px-2 py-1.5 rounded text-[#ffe57f] bg-black/25 hover:bg-black/40 border border-[#f0c020]/60 whitespace-nowrap"
          >
            <Shield className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
            <span>Admin</span>
          </Link>
        )}
      </nav>

      <button
        type="button"
        onClick={() => setMobileMenuOpen((prev) => !prev)}
        aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileMenuOpen}
        className="md:hidden ml-auto inline-flex items-center justify-center p-1.5 rounded bg-black/25 hover:bg-black/40 border border-white/25 text-white shrink-0"
      >
        {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {mobileMenuOpen && (
        <div className="md:hidden fixed left-0 right-0 top-[52px] z-50 bg-[#14201a] border-b-2 border-[#c89b3c] shadow-2xl p-3 space-y-2.5">
          {seasons.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#a6a89e] mb-1">
                Active Season
              </label>
              <select
                aria-label="Select Season"
                value={selectedSeasonSlug}
                onChange={(e) => {
                  handleSeasonChange(e.target.value);
                  setMobileMenuOpen(false);
                }}
                className="w-full xp-inset px-2.5 py-2 text-xs font-bold"
              >
                <option value="">Select a Season</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.slug}>
                    {s.leagueName ? `${s.leagueName}: ` : ""}
                    {s.name}
                    {!s.is_active ? " (Inactive)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1 text-xs font-bold">
            <Link
              href={`/rank${seasonQuery}`}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded bg-black/25 hover:bg-white/10 text-white border border-white/10"
            >
              <ListOrdered className="w-4 h-4 text-[#f0c020] shrink-0" />
              <span>Create Ranking</span>
            </Link>
            <Link
              href={`/browse${seasonQuery}`}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded bg-black/25 hover:bg-white/10 text-white border border-white/10"
            >
              <Eye className="w-4 h-4 text-[#f0c020] shrink-0" />
              <span>Browse Rankings</span>
            </Link>
            {isLoggedIn && (
              <Link
                href="/my-rankings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded bg-black/25 hover:bg-white/10 text-white border border-white/10"
              >
                <History className="w-4 h-4 text-[#f0c020] shrink-0" />
                <span>My History</span>
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded bg-black/35 hover:bg-black/50 text-[#ffe57f] border border-[#f0c020]/60"
              >
                <Shield className="w-4 h-4 text-[#f0c020] shrink-0" />
                <span>Admin</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
