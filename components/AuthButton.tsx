"use client";

import { useState } from "react";
import { LogOut, MessageSquare } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface AuthButtonProps {
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
  } | null;
}

export function AuthButton({ user }: AuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSignIn() {
    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      window.location.pathname + window.location.search
    )}`;

    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo },
    });
  }

  async function handleSignOut() {
    setLoading(true);
    await supabase.auth.signOut();
    window.location.reload();
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={handleSignIn}
        disabled={loading}
        className="xp-btn xp-btn-discord text-xs shrink-0"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span className="sm:hidden">{loading ? "..." : "Sign in"}</span>
        <span className="hidden sm:inline">
          {loading ? "Connecting..." : "Sign in with Discord"}
        </span>
      </button>
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
        <span className="max-w-[96px] truncate hidden sm:inline">
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
        <span className="hidden md:inline">Sign Out</span>
      </button>
    </div>
  );
}
