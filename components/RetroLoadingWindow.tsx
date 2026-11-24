"use client";

import { useEffect, useState } from "react";
import { RetroWindow } from "@/components/RetroWindow";

const RETRO_LOADING_MESSAGES = [
  "Reticulating splines...",
  "Inserting Floppy Disk 2...",
  "Downloading more RAM...",
  "Calibrating 56k modem...",
  "Defragging the hot takes...",
  "Polishing CRT pixels...",
  "Warming up the dial-up...",
  "Untangling Baron pit wards...",
  "Bribing the scuttle crab...",
  "Rewinding the VHS...",
];

export function RetroLoadingWindow({
  title = "Loading...",
  theme = "scdl",
}: {
  title?: string;
  theme?: "scdl" | "baron" | "dragon";
}) {
  const [message, setMessage] = useState(RETRO_LOADING_MESSAGES[0]);

  useEffect(() => {
    const idx = Math.floor(Math.random() * RETRO_LOADING_MESSAGES.length);
    setMessage(RETRO_LOADING_MESSAGES[idx]);
  }, []);

  return (
    <div className="min-h-screen">
      <div className="max-w-md mx-auto pt-8">
        <RetroWindow title={title} theme={theme}>
          <div className="p-5 space-y-3">
            <div className="text-xs font-semibold text-[#e8e5d8] tracking-wide">
              {message}
            </div>
            <div
              className="xp-progress-track"
              role="progressbar"
              aria-label={message}
            >
              <div className="xp-progress-blocks" />
            </div>
          </div>
        </RetroWindow>
      </div>
    </div>
  );
}
