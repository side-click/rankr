import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";

export const metadata: Metadata = {
  title: "Blog | Rankr",
};

export default function BlogPlaceholderPage() {
  return (
    <RetroWindow title="Rankr Blog" theme="scdl">
      <div className="py-12 px-4 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded xp-inset flex items-center justify-center">
          <FileText className="w-6 h-6 text-[#f0c020]" />
        </div>
        <h1 className="text-lg font-bold text-[#f0ede0]">
          Blogs — Coming Soon
        </h1>
        <p className="text-xs sm:text-sm text-[#a6a89e] max-w-md mx-auto">
          Long-form league recaps, meta breakdowns, and community articles are
          on the way.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Link href="/" className="xp-btn text-xs">
            Back to Home
          </Link>
          <Link href="/browse" className="xp-btn xp-btn-primary text-xs">
            Browse Content
          </Link>
        </div>
      </div>
    </RetroWindow>
  );
}
