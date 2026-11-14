import Link from "next/link";
import { RetroWindow } from "@/components/RetroWindow";

export default function TermsPage() {
  return (
    <RetroWindow title="Terms of Service" theme="scdl">
      <div className="space-y-4 text-xs sm:text-sm text-[#e3e0d3] leading-relaxed max-w-3xl">
        <p className="text-[11px] text-[#a6a89e]">
          Last updated: November 2026
        </p>

        <section className="space-y-1.5">
          <h2 className="font-bold text-[#f0c020] text-sm">
            1. Acceptance of Terms
          </h2>
          <p>
            By signing in with Discord, creating, or publishing content on Rankr,
            you agree to abide by these Terms of Service. If you do not agree,
            please do not use the platform.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-bold text-[#f0c020] text-sm">
            2. User-Generated Content &amp; Conduct
          </h2>
          <p>
            You are solely responsible for the power rankings, team commentary,
            author names, and notes you publish. You agree not to post content
            that includes hate speech, slurs, harassment, doxxing, spam,
            explicit material, or anything unlawful or abusive.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-bold text-[#f0c020] text-sm">
            3. Moderation Authority &amp; Account Bans
          </h2>
          <p>
            Rankr administrators reserve the absolute right, at our sole
            discretion and without prior notice, to:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[#c7c5b8] pl-1">
            <li>
              Remove or delete any published or draft power rankings, comments,
              or custom author names that violate these terms or disrupt the
              community.
            </li>
            <li>
              Temporarily or permanently suspend/ban any Discord account from
              creating, editing, or publishing content on Rankr.
            </li>
            <li>
              Temporarily take the platform offline for maintenance, safety
              updates, or moderation review.
            </li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-bold text-[#f0c020] text-sm">
            4. Disclaimer &amp; Trademarks
          </h2>
          <p>
            Rankr is provided &ldquo;as is&rdquo; without warranties of any
            kind. All league names, team logos, and Riot Games / League of
            Legends trademarks remain the property of their respective owners.
          </p>
        </section>

        <div className="pt-2">
          <Link href="/" className="xp-btn text-xs">
            ← Back to Home
          </Link>
        </div>
      </div>
    </RetroWindow>
  );
}
