"use client";

import { useState } from "react";
import { Lock, LogOut, MessageSquare, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface AuthButtonProps {
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
  } | null;
  requireAllowlist?: boolean;
}

export function AuthButton({ user, requireAllowlist = false }: AuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const supabase = createClient();

  async function startDiscordOAuth() {
    setLoading(true);
    const next = window.location.pathname + window.location.search;
    window.location.href = `/api/auth/discord?next=${encodeURIComponent(next)}`;
  }

  function handleSignInClick() {
    if (requireAllowlist) {
      setConfirmOpen(true);
      return;
    }
    void startDiscordOAuth();
  }

  async function handleSignOut() {
    setLoading(true);
    await supabase.auth.signOut();
    window.location.reload();
  }

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={handleSignInClick}
          disabled={loading}
          className="xp-btn xp-btn-discord text-xs shrink-0"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="sm:hidden">{loading ? "..." : "Sign in"}</span>
          <span className="hidden sm:inline">
            {loading ? "Connecting..." : "Sign in with Discord"}
          </span>
        </button>

        {confirmOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
            onClick={() => !loading && setConfirmOpen(false)}
          >
            <div
              className="w-full max-w-sm xp-window overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="xp-titlebar px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Lock className="w-3.5 h-3.5 text-[#f0c020]" />
                  <span>Authorized Creators Only</span>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setConfirmOpen(false)}
                  className="text-white/80 hover:text-white"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-4 bg-[#1a1c23] text-xs text-[#d6d3c4]">
                <p className="leading-relaxed">
                  Sign-in and publishing rankings are currently for{" "}
                  <strong className="text-[#f0c020]">
                    authorized creators only
                  </strong>
                  . You can still browse and view all rankings without signing
                  in.
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setConfirmOpen(false)}
                    className="xp-btn text-xs"
                  >
                    Nevermind
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void startDiscordOAuth()}
                    className="xp-btn xp-btn-discord text-xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{loading ? "Connecting..." : "Proceed"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/25 border border-white/25 text-white text-xs font-bold">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.username}
            className="w-5 h-5 rounded-sm border border-white/60 object-cover"
          />
        ) : (
          <span className="w-5 h-5 rounded-sm bg-[#5865f2] inline-flex items-center justify-center text-[10px]">
            {user.username.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="max-w-[76px] lg:max-w-[96px] truncate hidden sm:inline">
          {user.username}
        </span>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        className="xp-btn text-xs px-2 py-1"
        title="Sign out"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">Sign Out</span>
      </button>
    </div>
  );
}
