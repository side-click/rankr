import React from "react";

export function TeamGroupIcon({
  className = "w-4 h-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Back left person */}
      <circle cx="4.8" cy="6.5" r="2" />
      <path d="M1.5 16v-1a3.2 3.2 0 0 1 3.8-3.1" />
      {/* Back right person */}
      <circle cx="19.2" cy="6.5" r="2" />
      <path d="M22.5 16v-1a3.2 3.2 0 0 0-3.8-3.1" />
      {/* Center foreground person */}
      <circle cx="12" cy="11.2" r="2.6" />
      <path d="M7.2 21.5v-1.5a4.8 4.8 0 0 1 9.6 0v1.5" />
    </svg>
  );
}
