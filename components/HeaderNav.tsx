"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3, Eye, History, ListOrdered, Menu, Shield, Trophy, X } from "lucide-react";

interface HeaderNavProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
}

export function HeaderNav({ isLoggedIn, isAdmin }: HeaderNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleOutside(e: PointerEvent) {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileMenuOpen(false);
    }
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  return (
    <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
      <Link
        href="/"
        className="flex items-center gap-2.5 shrink-0 hover:brightness-110 transition"
      >
        <img
          src="/images/brand/rankr-icon.png"
          alt="Rankr"
          className="w-10 h-10 sm:w-11 sm:h-11 object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)] drop-shadow-[0_6px_12px_rgba(0,0,0,0.75)]"
        />
        <span className="wow-heading text-2xl sm:text-3xl font-bold text-[#f0c020] tracking-wide">
          Rankr
        </span>
      </Link>

      <nav className="hidden lg:flex flex-1 items-center justify-center gap-1.5 xl:gap-2 text-xs font-bold min-w-0 overflow-hidden">
        <Link
          href="/create"
          className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-white/95 hover:bg-white/15 border border-transparent hover:border-white/30 whitespace-nowrap"
        >
          <ListOrdered className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
          <span>Create</span>
        </Link>
        <Link
          href="/browse"
          className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-white/95 hover:bg-white/15 border border-transparent hover:border-white/30 whitespace-nowrap"
        >
          <Eye className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
          <span>Browse Content</span>
        </Link>
        <Link
          href="/consensus"
          className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-white/95 hover:bg-white/15 border border-transparent hover:border-white/30 whitespace-nowrap"
        >
          <Trophy className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
          <span>Consensus</span>
        </Link>
        <Link
          href="/stats"
          className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-white/95 hover:bg-white/15 border border-transparent hover:border-white/30 whitespace-nowrap"
        >
          <BarChart3 className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
          <span>Stats</span>
        </Link>
        {isLoggedIn && (
          <Link
            href="/my-history"
            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-white/95 hover:bg-white/15 border border-transparent hover:border-white/30 whitespace-nowrap"
          >
            <History className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
            <span>My History</span>
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-[#ffe57f] bg-black/25 hover:bg-black/40 border border-[#f0c020]/60 whitespace-nowrap"
          >
            <Shield className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
            <span>Admin</span>
          </Link>
        )}
      </nav>

      <div ref={mobileMenuRef} className="relative ml-auto lg:hidden shrink-0">
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
          className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-black/25 hover:bg-black/40 border border-white/25 text-white text-xs font-bold shrink-0"
        >
          {mobileMenuOpen ? <X className="w-4 h-4 shrink-0" /> : <Menu className="w-4 h-4 shrink-0" />}
          <span>Menu</span>
        </button>

        <div
          aria-hidden={!mobileMenuOpen}
          className={`absolute right-0 top-full mt-2 w-56 z-50 bg-[#14201a] border-2 border-[#c89b3c] rounded-lg shadow-2xl p-2 space-y-1 text-xs font-bold transition-opacity duration-100 ${
            mobileMenuOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none invisible"
          }`}
        >
            <Link
              href="/create"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded bg-black/25 hover:bg-white/10 text-white border border-white/10"
            >
              <ListOrdered className="w-4 h-4 text-[#f0c020] shrink-0" />
              <span>Create</span>
            </Link>
            <Link
              href="/browse"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded bg-black/25 hover:bg-white/10 text-white border border-white/10"
            >
              <Eye className="w-4 h-4 text-[#f0c020] shrink-0" />
              <span>Browse Content</span>
            </Link>
            <Link
              href="/consensus"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded bg-black/25 hover:bg-white/10 text-white border border-white/10"
            >
              <Trophy className="w-4 h-4 text-[#f0c020] shrink-0" />
              <span>Consensus</span>
            </Link>
            <Link
              href="/stats"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded bg-black/25 hover:bg-white/10 text-white border border-white/10"
            >
              <BarChart3 className="w-4 h-4 text-[#f0c020] shrink-0" />
              <span>Stats</span>
            </Link>
            {isLoggedIn && (
              <Link
                href="/my-history"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded bg-black/25 hover:bg-white/10 text-white border border-white/10"
              >
                <History className="w-4 h-4 text-[#f0c020] shrink-0" />
                <span>My History</span>
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded bg-black/35 hover:bg-black/50 text-[#ffe57f] border border-[#f0c020]/60"
              >
                <Shield className="w-4 h-4 text-[#f0c020] shrink-0" />
                <span>Admin</span>
              </Link>
            )}
        </div>
      </div>
    </div>
  );
}
