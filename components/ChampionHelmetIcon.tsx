import React from "react";

export function ChampionHelmetIcon({
  className = "w-5 h-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2.5C7 2.5 5.5 6.5 5.5 10.5C5.5 12.5 4.5 14 3.5 15L5 16C5.5 18.5 6.5 20.2 8 21L9.5 21C8.5 18.5 8.2 16 8.5 14C7.2 13.5 6.8 11.5 7 10.2C8.5 10 10.2 10.5 11 11.5L11 16L12 17.5L13 16L13 11.5C13.8 10.5 15.5 10 17 10.2C17.2 11.5 16.8 13.5 15.5 14C15.8 16 15.5 18.5 14.5 21L16 21C17.5 20.2 18.5 18.5 19 16L20.5 15C19.5 14 18.5 12.5 18.5 10.5C18.5 6.5 17 2.5 12 2.5Z" />
    </svg>
  );
}
