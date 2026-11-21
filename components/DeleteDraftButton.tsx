"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface DeleteDraftButtonProps {
  ballotId: string;
  title: string;
  status?: "draft" | "published";
  table?: "rankings" | "blogs";
  contentKind?: "ranking" | "tierlist" | "blog";
}

export function DeleteDraftButton({
  ballotId,
  title,
  status = "draft",
  table = "rankings",
  contentKind = "ranking",
}: DeleteDraftButtonProps) {
  const isPublished = status === "published";
  const noun =
    contentKind === "blog"
      ? "blog post"
      : contentKind === "tierlist"
      ? "tier list"
      : "ranking";
  const headingLabel = isPublished
    ? contentKind === "blog"
      ? "Delete Published Blog Post"
      : contentKind === "tierlist"
      ? "Delete Published Tier List"
      : "Delete Published Ranking"
    : "Delete Draft";
  const confirmLabel = isPublished
    ? contentKind === "blog"
      ? "Delete Blog Post"
      : contentKind === "tierlist"
      ? "Delete Tier List"
      : "Delete Ranking"
    : "Delete Draft";
  const publishedWarning =
    contentKind === "ranking"
      ? "This will permanently remove it from public rankings and consensus. This cannot be undone."
      : "This will permanently remove it from public content. This cannot be undone.";
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleConfirmDelete() {
    setDeleting(true);
    setError(null);
    const { error: delError } = await supabase
      .from(table)
      .delete()
      .eq("id", ballotId);

    if (delError) {
      setError(delError.message);
      setDeleting(false);
      return;
    }

    setConfirmOpen(false);
    setDeleting(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
        className="xp-btn xp-btn-danger text-xs"
        title={headingLabel}
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Delete</span>
      </button>

      {confirmOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
            onClick={() => !deleting && setConfirmOpen(false)}
          >
            <div
              className="w-full max-w-sm xp-window overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="xp-titlebar px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Trash2 className="w-3.5 h-3.5 text-[#ff857a]" />
                  <span>{headingLabel}</span>
                </div>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setConfirmOpen(false)}
                  className="text-white/80 hover:text-white"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-4 bg-[#1a1c23] text-xs text-[#d6d3c4]">
                <p className="leading-relaxed">
                  Are you sure you want to permanently delete{" "}
                  {isPublished ? `your published ${noun}` : "the draft"}{" "}
                  <strong className="text-[#f0ede0]">{title}</strong>?{" "}
                  {isPublished ? publishedWarning : "This cannot be undone."}
                </p>
                {error && (
                  <div className="p-2 bg-[#451717] border border-[#9e3535] text-[#ff857a] text-[11px] font-bold">
                    Failed to delete {isPublished ? noun : "draft"}: {error}
                  </div>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setConfirmOpen(false)}
                    className="xp-btn text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void handleConfirmDelete()}
                    className="xp-btn xp-btn-danger text-xs min-w-[82px] justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deleting ? "Deleting..." : confirmLabel}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
