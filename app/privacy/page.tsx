import Link from "next/link";
import { RetroWindow } from "@/components/RetroWindow";

export default function PrivacyPage() {
  return (
    <RetroWindow title="Privacy Policy" theme="scdl">
      <div className="space-y-4 text-xs sm:text-sm text-[#e3e0d3] leading-relaxed max-w-3xl">
        <p className="text-[11px] text-[#a6a89e]">
          Last updated: November 2026
        </p>

        <section className="space-y-1.5">
          <h2 className="font-bold text-[#f0c020] text-sm">
            1. Information We Collect
          </h2>
          <p>
            Rankr collects only the information needed to operate community
            power rankings, tier lists, and league statistics:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[#c7c5b8] pl-1">
            <li>
              <strong>Discord Account Information:</strong> When you sign in
              with Discord, we store your Discord user ID, username, and avatar
              URL to attribute rankings you choose to publish and enforce
              allowlist/moderation controls.
            </li>
            <li>
              <strong>User-Submitted Content:</strong> Rankings, tier lists,
              team/tier commentary, author notes, and optional image overlays
              that you create or publish on the platform.
            </li>
            <li>
              <strong>Public Game &amp; League Statistics:</strong> Publicly
              available League of Legends match and summoner statistics used for
              league leaderboards and visualizers.
            </li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-bold text-[#f0c020] text-sm">
            2. How We Use Information
          </h2>
          <p>
            Collected data is used strictly to display community rankings,
            consensus averages, and amateur league statistics on{" "}
            <strong>leaguerankr.com</strong>. We do not sell, rent, or share
            user data with third-party advertisers or data brokers.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-bold text-[#f0c020] text-sm">
            3. Cookies &amp; Authentication
          </h2>
          <p>
            Rankr uses essential session cookies solely to keep you signed in
            via Supabase / Discord OAuth. We do not use third-party tracking or
            advertising cookies.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-bold text-[#f0c020] text-sm">
            4. Data Retention &amp; Deletion
          </h2>
          <p>
            You may permanently delete any of your draft or published rankings
            at any time from the{" "}
            <Link href="/my-rankings" className="text-[#f0c020] underline">
              My History
            </Link>{" "}
            page. To request full removal of your account profile, contact a
            Rankr administrator via the league Discord or open an issue on{" "}
            <a
              href="https://github.com/side-click/rankr/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#f0c020] underline"
            >
              GitHub
            </a>
            .
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-bold text-[#f0c020] text-sm">
            5. Riot Games Disclaimer
          </h2>
          <p className="text-[#c7c5b8]">
            Rankr isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the
            views or opinions of Riot Games or anyone officially involved in
            producing or managing Riot Games properties. Riot Games, and all
            associated properties are trademarks or registered trademarks of
            Riot Games, Inc.
          </p>
        </section>

        <div className="pt-2 flex items-center gap-2">
          <Link href="/" className="xp-btn text-xs">
            ← Back to Home
          </Link>
          <Link href="/terms" className="xp-btn text-xs">
            Terms of Service
          </Link>
        </div>
      </div>
    </RetroWindow>
  );
}
