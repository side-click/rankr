"use client";

import { useId } from "react";

export function RankrLogoIcon({
  className = "w-6 h-5",
}: {
  className?: string;
}) {
  const maskId = useId();
  return (
    <svg
      viewBox="0 0 28 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.45}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <mask id={maskId}>
          <rect width="28" height="24" fill="white" />
          {/* Cut out behind the two overlapping blocky arrows */}
          <polygon
            points="5,5.6 1.4,10.5 3.3,10.5 3.3,18 6.7,18 6.7,10.5 8.6,10.5"
            fill="black"
            stroke="black"
            strokeWidth={1.5}
          />
          <polygon
            points="21.3,6 24.7,6 24.7,13.5 26.6,13.5 23,18.4 19.4,13.5 21.3,13.5"
            fill="black"
            stroke="black"
            strokeWidth={1.5}
          />
        </mask>
      </defs>
      {/* 5 wide stacked bars */}
      <g mask={`url(#${maskId})`}>
        <rect x="5.5" y="3" width="17" height="18" rx="1.4" />
        <line x1="5.5" y1="6.6" x2="22.5" y2="6.6" />
        <line x1="5.5" y1="10.2" x2="22.5" y2="10.2" />
        <line x1="5.5" y1="13.8" x2="22.5" y2="13.8" />
        <line x1="5.5" y1="17.4" x2="22.5" y2="17.4" />
      </g>
      {/* Left blocky up-arrow */}
      <polygon points="5,6 1.8,10.2 3.7,10.2 3.7,17.5 6.3,17.5 6.3,10.2 8.2,10.2" />
      {/* Right blocky down-arrow */}
      <polygon points="21.7,6.5 24.3,6.5 24.3,13.8 26.2,13.8 23,18 19.8,13.8 21.7,13.8" />
    </svg>
  );
}
