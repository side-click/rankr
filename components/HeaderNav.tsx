"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Eye, History, ListOrdered, Menu, Shield, Trophy, X } from "lucide-react";

interface HeaderNavProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
  isOperator?: boolean;
}

export function HeaderNav({
  isLoggedIn,
  isAdmin,
  isOperator = false,
}: HeaderNavProps) {
  const pathname = usePathname() || "/";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  const isActive = (prefix: string) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`);

  const desktopLinkClass = (prefix: string) =>
    `inline-flex items-center gap-1.5 px-2 py-1.5 rounded border whitespace-nowrap transition ${
      isActive(prefix)
        ? "bg-white/15 border-[#f0c020]/50 text-[#ffe57f]"
        : "text-white/95 hover:bg-white/15 border-transparent hover:border-white/30"
    }`;

  const mobileLinkClass = (prefix: string) =>
    `flex items-center gap-2 px-3 py-2 rounded border transition ${
      isActive(prefix)
        ? "bg-white/15 border-[#f0c020]/50 text-[#ffe57f]"
        : "bg-black/25 hover:bg-white/10 text-white border-white/10"
    }`;

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
          width={44}
          height={44}
          className="w-10 h-10 sm:w-11 sm:h-11 object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)] drop-shadow-[0_6px_12px_rgba(0,0,0,0.75)]"
        />
        <span className="wow-heading text-2xl sm:text-3xl font-bold text-[#f0c020] tracking-wide">
          Rankr
        </span>
      </Link>

      <nav className="hidden lg:flex flex-1 items-center justify-center gap-1.5 xl:gap-2 text-xs font-bold min-w-0 overflow-hidden">
        <Link href="/create" className={desktopLinkClass("/create")}>
          <ListOrdered className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
          <span>Create</span>
        </Link>
        <Link href="/browse" className={desktopLinkClass("/browse")}>
          <Eye className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
          <span>Browse Content</span>
        </Link>
        <Link href="/consensus" className={desktopLinkClass("/consensus")}>
          <Trophy className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
          <span>Consensus</span>
        </Link>
        <Link href="/stats" className={desktopLinkClass("/stats")}>
          <BarChart3 className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
          <span>Stats</span>
        </Link>
        {isLoggedIn && (
          <Link href="/my-history" className={desktopLinkClass("/my-history")}>
            <History className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
            <span>My History</span>
          </Link>
        )}
        {(isAdmin || isOperator) && (
          <Link
            href="/admin"
            className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-[#ffe57f] whitespace-nowrap border ${
              isActive("/admin")
                ? "bg-black/45 border-[#f0c020]"
                : "bg-black/25 hover:bg-black/40 border-[#f0c020]/60"
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
            <span>{isAdmin ? "Admin" : "League Ops"}</span>
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

        {mobileMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 z-50 bg-[#14201a] border-2 border-[#c89b3c] rounded-lg shadow-2xl p-2 space-y-1 text-xs font-bold">
            <Link
              href="/create"
              onClick={() => setMobileMenuOpen(false)}
              className={mobileLinkClass("/create")}
            >
              <ListOrdered className="w-4 h-4 text-[#f0c020] shrink-0" />
              <span>Create</span>
            </Link>
            <Link
              href="/browse"
              onClick={() => setMobileMenuOpen(false)}
              className={mobileLinkClass("/browse")}
            >
              <Eye className="w-4 h-4 text-[#f0c020] shrink-0" />
              <span>Browse Content</span>
            </Link>
            <Link
              href="/consensus"
              onClick={() => setMobileMenuOpen(false)}
              className={mobileLinkClass("/consensus")}
            >
              <Trophy className="w-4 h-4 text-[#f0c020] shrink-0" />
              <span>Consensus</span>
            </Link>
            <Link
              href="/stats"
              onClick={() => setMobileMenuOpen(false)}
              className={mobileLinkClass("/stats")}
            >
              <BarChart3 className="w-4 h-4 text-[#f0c020] shrink-0" />
              <span>Stats</span>
            </Link>
            {isLoggedIn && (
              <Link
                href="/my-history"
                onClick={() => setMobileMenuOpen(false)}
                className={mobileLinkClass("/my-history")}
              >
                <History className="w-4 h-4 text-[#f0c020] shrink-0" />
                <span>My History</span>
              </Link>
            )}
            {(isAdmin || isOperator) && (
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded bg-black/35 hover:bg-black/50 text-[#ffe57f] border border-[#f0c020]/60"
              >
                <Shield className="w-4 h-4 text-[#f0c020] shrink-0" />
                <span>{isAdmin ? "Admin" : "League Ops"}</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
