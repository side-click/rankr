"use client";

import { useEffect, useState } from "react";

function formatInZone(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    ...(timeZone ? { timeZone } : {}),
  });
}

function formatUtcTooltip(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export function LocalTimestamp({
  iso,
  fallback = "—",
}: {
  iso: string | null | undefined;
  fallback?: string;
}) {
  const [label, setLabel] = useState<string>(() =>
    iso ? formatInZone(iso, "America/New_York") : fallback
  );

  useEffect(() => {
    if (!iso) {
      setLabel(fallback);
      return;
    }
    setLabel(formatInZone(iso));
  }, [iso, fallback]);

  if (!iso) return <span>{fallback}</span>;

  return (
    <time
      dateTime={iso}
      title={formatUtcTooltip(iso)}
      suppressHydrationWarning
      className="cursor-help"
    >
      {label}
    </time>
  );
}
