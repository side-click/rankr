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
      fillRule="evenodd"
      clipRule="evenodd"
      className={className}
      aria-hidden="true"
    >
      {/* League random-champion Spartan helmet silhouette */}
      <path d="M12 2.5C7.8 2.5 5 5.4 5 9.6c0 2.5-.8 4.4-2 5.6l1.7 1.3c.6 2.5 1.8 4.2 3.8 5l.9-1.2c-.8-1.4-1.3-3.1-1.4-4.9l1.8-1.1V17l1.2 1.4 1.2-1.4v-2.7l1.8 1.1c-.1 1.8-.6 3.5-1.4 4.9l.9 1.2c2-.8 3.2-2.5 3.8-5l1.7-1.3c-1.2-1.2-2-3.1-2-5.6 0-4.2-2.8-7.1-7-7.1ZM6.8 10.6c1.5-.3 3 .2 4.1 1.1-.4 1.4-1.5 2.4-3 2.7-.8-.9-1.2-2.2-1.1-3.8Zm10.4 0c.1 1.6-.3 2.9-1.1 3.8-1.5-.3-2.6-1.3-3-2.7 1.1-.9 2.6-1.4 4.1-1.1Z" />
    </svg>
  );
}
