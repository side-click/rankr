import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { AuthButton } from "@/components/AuthButton";

interface AllowlistBlockedWindowProps {
  title: string;
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
    discordId: string | null;
  };
}

export function AllowlistBlockedWindow({
  title,
  user,
}: AllowlistBlockedWindowProps) {
  return (
    <RetroWindow title={title} theme="scdl">
      <div className="py-8 px-4 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded xp-inset flex items-center justify-center">
          <ShieldAlert className="w-6 h-6 text-[#f0c020]" />
        </div>
        <h1 className="text-lg font-bold text-[#f0ede0]">
          Invite-Only Authoring
        </h1>
        <p className="text-xs sm:text-sm text-[#c7c5b8] max-w-md mx-auto">
          Creating and editing publishable content is currently invite-only. You
          can still browse all published content, or contact a league organizer
          with your Discord ID
          {user.discordId ? (
            <>
              :{" "}
              <code className="xp-inset px-1.5 py-0.5 font-mono text-[#f0c020]">
                {user.discordId}
              </code>
            </>
          ) : (
            "."
          )}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <Link href="/browse" className="xp-btn xp-btn-primary text-xs">
            Browse Rankings
          </Link>
          <AuthButton
            user={{
              id: user.id,
              username: user.username,
              avatarUrl: user.avatarUrl,
            }}
          />
        </div>
      </div>
    </RetroWindow>
  );
}
