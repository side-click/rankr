"use client";

import { Lock } from "lucide-react";
import { AuthButton } from "@/components/AuthButton";
import { RetroWindow } from "@/components/RetroWindow";

interface SignInRequiredWindowProps {
  requireAllowlist?: boolean;
  title?: string;
  message?: string;
}

export function SignInRequiredWindow({
  requireAllowlist = false,
  title = "Authorized Users Only",
  message = "Sign in with Discord is required to create publishable content.",
}: SignInRequiredWindowProps) {
  return (
    <RetroWindow title={title} theme="scdl">
      <div className="py-8 px-4 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded xp-inset flex items-center justify-center">
          <Lock className="w-6 h-6 text-[#f0c020]" />
        </div>
        <h1 className="text-lg font-bold text-[#f0ede0]">{message}</h1>
        <div className="flex justify-center">
          <AuthButton user={null} requireAllowlist={requireAllowlist} />
        </div>
      </div>
    </RetroWindow>
  );
}
