import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});
import "./globals.css";
import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { AuthNoticeBanner } from "@/components/AuthNoticeBanner";
import { createClient } from "@/utils/supabase/server";
import { RetroWindow } from "@/components/RetroWindow";
import { ShieldAlert } from "lucide-react";

const siteTitle = "Rankr — League Rankings & Tier Lists";
const siteDescription =
  "Rank teams or players, drop your hot takes, and share them with the world.";

export const viewport: Viewport = {
  themeColor: "#c89b3c",
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://league-rankr.vercel.app"
  ),
  title: siteTitle,
  description: siteDescription,
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: "website",
    siteName: "Rankr",
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const [{ data: settings }, { data: authData }] = await Promise.all([
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  let profile: {
    username: string;
    avatar_url: string | null;
    is_admin: boolean;
  } | null = null;
  if (authData.user) {
    const { data } = await supabase
      .from("profiles")
      .select("username, avatar_url, is_admin")
      .eq("id", authData.user.id)
      .maybeSingle();
    profile = data;
  }
  const isAdmin = Boolean(profile?.is_admin);

  const maintenanceMode = Boolean(settings?.maintenance_mode);
  const requireAllowlist = Boolean(settings?.require_allowlist);
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const shortSha = commitSha?.slice(0, 7) ?? "local";
  const buildTimeIso = process.env.NEXT_PUBLIC_BUILD_TIME;
  const buildTimeLabel = buildTimeIso
    ? new Date(buildTimeIso).toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen flex flex-col antialiased">
        <Navbar
          requireAllowlist={requireAllowlist}
          isAdmin={isAdmin}
          user={
            authData.user
              ? {
                  id: authData.user.id,
                  username:
                    profile?.username ??
                    authData.user.user_metadata?.full_name ??
                    authData.user.user_metadata?.name ??
                    "Discord User",
                  avatarUrl:
                    profile?.avatar_url ??
                    authData.user.user_metadata?.avatar_url ??
                    null,
                }
              : null
          }
        />
        <Suspense fallback={null}>
          <AuthNoticeBanner />
        </Suspense>
        {maintenanceMode && isAdmin && (
          <div className="bg-[#7a1616] border-b border-[#ff857a] text-white text-xs font-bold px-4 py-2 text-center">
            KILL SWITCH ACTIVE — Rankr is currently offline for non-admin users.{" "}
            <Link href="/admin" className="underline text-[#f0c020] ml-1">
              Manage in Admin Console
            </Link>
          </div>
        )}
        <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-5 py-5">
          {maintenanceMode && !isAdmin ? (
            <RetroWindow title="Rankr Temporarily Offline" theme="scdl">
              <div className="py-10 px-4 text-center space-y-3">
                <ShieldAlert className="w-10 h-10 mx-auto text-[#f0c020]" />
                <h1 className="text-lg font-bold text-[#f0ede0]">
                  Maintenance Mode
                </h1>
                <p className="text-xs sm:text-sm text-[#c7c5b8] max-w-md mx-auto">
                  {settings?.maintenance_message ||
                    "Rankr is temporarily offline for maintenance. Please check back shortly."}
                </p>
              </div>
            </RetroWindow>
          ) : (
            children
          )}
        </main>
        <footer className="text-center text-[11px] text-[#9aa39d] px-4 py-4 border-t border-white/10 bg-black/35 space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
            <Link
              href="/terms"
              className="text-[#c7c5b8] hover:text-[#f0c020] underline"
            >
              Terms of Service
            </Link>
            <span className="text-white/20">•</span>
            <a
              href="https://github.com/side-click/rankr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 hover:border-[#c89b3c]/60 text-[#d6d3c4] hover:text-[#f0c020] transition"
            >
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-3.5 h-3.5 shrink-0"
                aria-hidden="true"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              <span>GitHub</span>
            </a>
            <a
              href={
                commitSha
                  ? `https://github.com/side-click/rankr/commit/${commitSha}`
                  : "https://github.com/side-click/rankr"
              }
              target="_blank"
              rel="noopener noreferrer"
              title="Deployed commit & build time"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/30 border border-white/10 text-[11px] font-mono text-[#9aa39d] hover:text-[#f0c020] hover:border-[#c89b3c]/50 transition"
            >
              <span className="text-[#f0c020] font-semibold">{shortSha}</span>
              {buildTimeLabel && (
                <>
                  <span className="text-white/25">•</span>
                  <span>{buildTimeLabel}</span>
                </>
              )}
            </a>
          </div>
          <div className="max-w-3xl mx-auto text-[10px] text-[#7e8781] leading-relaxed">
            Rankr is an independent platform and is not affiliated with or
            representing Scuttle Crab Draft League (SCDL). All SCDL names,
            logos, and league content remain the property of SCDL. Rankr is not
            endorsed by Riot Games and does not reflect the views or opinions of
            Riot Games or anyone officially involved in producing or managing
            League of Legends. League of Legends and Riot Games are trademarks
            or registered trademarks of Riot Games, Inc.
          </div>
        </footer>
      </body>
    </html>
  );
}
