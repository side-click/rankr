"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ShieldAlert, Copy, Check, X } from "lucide-react";

export function AuthNoticeBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const authError = searchParams.get("auth_error");
  const discordId = searchParams.get("discord_id");

  if (authError !== "not_authorized" && authError !== "discord_callback_failed") {
    return null;
  }

  function dismiss() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("auth_error");
    params.delete("discord_id");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }

  async function copyId() {
    if (!discordId) return;
    await navigator.clipboard.writeText(discordId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-[#5a1414] border-b border-[#ff857a] text-white px-4 py-2.5 text-xs">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#f0c020] shrink-0" />
          {authError === "not_authorized" ? (
            <span>
              <strong>Invite-Only Sign In:</strong> Your Discord account is not
              on the allowlist yet. You can still browse all rankings, or ask an
              admin to approve your Discord ID
              {discordId ? (
                <>
                  :{" "}
                  <code className="bg-black/40 px-1.5 py-0.5 rounded font-mono text-[#f0c020]">
                    {discordId}
                  </code>
                </>
              ) : (
                "."
              )}
            </span>
          ) : (
            <span>
              <strong>Sign In Failed:</strong> Discord login did not complete.
              Please try again.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {authError === "not_authorized" && discordId && (
            <button
              type="button"
              onClick={copyId}
              className="xp-btn text-[11px] px-2 py-0.5"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-[#7cd438]" />
                  <span>Copied ID</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy ID</span>
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="text-white/80 hover:text-white p-0.5"
            aria-label="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
