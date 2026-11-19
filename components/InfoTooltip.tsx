"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

export function InfoTooltip({
  text,
  label = "More info",
}: {
  text: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        title={text}
        aria-label={label}
        aria-expanded={open}
        className="inline-flex items-center justify-center text-[#a6a89e]/80 hover:text-[#f0c020] focus:text-[#f0c020] transition-colors cursor-pointer p-0.5 -m-0.5"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-30 w-56 rounded border border-[#c89b3c]/60 bg-[#121615] px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-[#e8e5d8] shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
