import React from "react";
import type { DivisionTheme } from "@/types/database";
import { getThemeGradients } from "@/utils/themes";

type WindowTheme = "xp" | "scdl" | "baron" | "dragon";

interface RetroWindowProps {
  title: string;
  theme?: WindowTheme;
  customTheme?: DivisionTheme | null;
  iconSrc?: string;
  rightSlot?: React.ReactNode;
  statusText?: string;
  children: React.ReactNode;
  className?: string;
}

const windowThemeClass: Record<WindowTheme, string> = {
  xp: "",
  scdl: "xp-window-scdl",
  baron: "xp-window-baron",
  dragon: "xp-window-dragon",
};

const titlebarThemeClass: Record<WindowTheme, string> = {
  xp: "",
  scdl: "xp-titlebar-scdl",
  baron: "xp-titlebar-baron",
  dragon: "xp-titlebar-dragon",
};

export function RetroWindow({
  title,
  theme = "scdl",
  customTheme,
  iconSrc,
  rightSlot,
  statusText,
  children,
  className = "",
}: RetroWindowProps) {
  const windowStyle = customTheme
    ? { borderColor: customTheme.primary_color }
    : undefined;
  const titlebarStyle = customTheme
    ? {
        background: getThemeGradients(customTheme).titlebarGradient,
        borderBottomColor: customTheme.secondary_color,
      }
    : undefined;

  return (
    <section
      style={windowStyle}
      className={`xp-window ${windowThemeClass[theme]} ${className}`}
    >
      <div
        style={titlebarStyle}
        className={`xp-titlebar ${titlebarThemeClass[theme]}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {iconSrc ? (
            <img
              src={iconSrc}
              alt=""
              className="w-5 h-5 object-contain shrink-0 drop-shadow"
            />
          ) : (
            <span className="inline-block w-3 h-3 rounded-xs bg-[#f0c020] border border-white/50 shrink-0" />
          )}
          <span className="truncate">{title}</span>
        </div>
        {rightSlot && (
          <div className="flex items-center gap-1.5 shrink-0">{rightSlot}</div>
        )}
      </div>

      <div className="p-3 sm:p-4">{children}</div>

      {statusText && (
        <div className="xp-statusbar flex items-center justify-between gap-2">
          <span>{statusText}</span>
        </div>
      )}
    </section>
  );
}
