"use client";

import { useEffect } from "react";

const DEFAULT_MESSAGE =
  "You have unsaved changes. Leave this page and discard your unsaved work?";

/**
 * Guards against both hard browser navigation (beforeunload) and soft Next.js
 * <Link> clicks (capture-phase document click listener) when unsaved changes exist.
 */
export function useUnsavedChangesGuard(
  hasUnsavedChanges: boolean,
  message: string = DEFAULT_MESSAGE
) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const handleDocumentClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank") return;

      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasUnsavedChanges, message]);
}
