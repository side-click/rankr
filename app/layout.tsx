import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/utils/supabase/server";
import { RetroWindow } from "@/components/RetroWindow";
import { ShieldAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "Rankr — Team Power Rankings",
  description: "Create, publish, and share Team Power Rankings.",
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

  let isAdmin = false;
  if (authData.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", authData.user.id)
      .maybeSingle();
    isAdmin = Boolean(profile?.is_admin);
  }

  const maintenanceMode = Boolean(settings?.maintenance_mode);

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col antialiased">
        <Navbar />
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
          <div className="flex items-center justify-center gap-4 text-xs">
            <Link
              href="/terms"
              className="text-[#c7c5b8] hover:text-[#f0c020] underline"
            >
              Terms of Service
            </Link>
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
