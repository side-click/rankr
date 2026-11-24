"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { RankingOverlay } from "@/types/database";

const OVERLAY_BUCKET = "ranking-overlays";
const MAX_OVERLAY_BYTES = 5 * 1024 * 1024;
const MAX_OVERLAY_COUNT = 12;
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getFileExtension(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  const match = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "png";
}

export interface UseOverlayEditorParams {
  rankingId: string;
  userId: string | null | undefined;
  canEditOverlays: boolean;
  initialOverlays: unknown;
  cardRef: RefObject<HTMLDivElement | null>;
}

/**
 * Shared overlay upload, drag, resize, and server-save state hook for
 * team ranking and player tier list share views.
 */
export function useOverlayEditor({
  rankingId,
  userId,
  canEditOverlays,
  initialOverlays,
  cardRef,
}: UseOverlayEditorParams) {
  const router = useRouter();
  const parsedInitial: RankingOverlay[] = Array.isArray(initialOverlays)
    ? (initialOverlays as RankingOverlay[])
    : [];

  const [overlays, setOverlays] = useState<RankingOverlay[]>(parsedInitial);
  const [savedOverlays, setSavedOverlays] =
    useState<RankingOverlay[]>(parsedInitial);
  const [editingOverlays, setEditingOverlays] = useState(false);
  const [uploadingOverlay, setUploadingOverlay] = useState(false);
  const [savingOverlays, setSavingOverlays] = useState(false);
  const [overlayError, setOverlayError] = useState<string | null>(null);

  const activeCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      activeCleanupRef.current?.();
      activeCleanupRef.current = null;
    };
  }, []);

  const openOverlayEditor = useCallback(() => {
    setOverlayError(null);
    setEditingOverlays(true);
  }, []);

  const cancelEditingOverlays = useCallback(() => {
    setOverlays(savedOverlays);
    setEditingOverlays(false);
    setOverlayError(null);
  }, [savedOverlays]);

  const removeOverlay = useCallback((id: string) => {
    setOverlays((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearOverlays = useCallback(() => {
    setOverlays([]);
  }, []);

  const handleUploadOverlay = useCallback(
    async (file: File) => {
      if (!canEditOverlays || !userId) return;
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        setOverlayError("Please upload a PNG, JPG, WebP, or GIF image.");
        return;
      }
      if (file.size > MAX_OVERLAY_BYTES) {
        setOverlayError("Overlay image must be 5 MB or smaller.");
        return;
      }
      if (overlays.length >= MAX_OVERLAY_COUNT) {
        setOverlayError(`Maximum of ${MAX_OVERLAY_COUNT} overlays per graphic.`);
        return;
      }

      setOverlayError(null);
      setUploadingOverlay(true);
      try {
        const supabase = createClient();
        const ext = getFileExtension(file);
        const unique =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2, 10);
        const path = `${userId}/${rankingId}-${Date.now()}-${unique}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from(OVERLAY_BUCKET)
          .upload(path, file, {
            cacheControl: "31536000",
            contentType: file.type,
            upsert: false,
          });

        if (uploadErr) {
          setOverlayError(uploadErr.message || "Failed to upload overlay.");
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from(OVERLAY_BUCKET).getPublicUrl(path);

        const nextOverlay: RankingOverlay = {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          url: publicUrl,
          x: 38,
          y: 25,
          width: 18,
        };
        setOverlays((prev) => [...prev, nextOverlay]);
        setEditingOverlays(true);
      } catch (err) {
        setOverlayError(
          err instanceof Error ? err.message : "Failed to upload overlay."
        );
      } finally {
        setUploadingOverlay(false);
      }
    },
    [canEditOverlays, overlays.length, rankingId, userId]
  );

  const handleSaveOverlays = useCallback(async () => {
    if (!canEditOverlays) return;
    setOverlayError(null);
    setSavingOverlays(true);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "overlays",
          rankingId,
          overlays,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        overlays?: RankingOverlay[];
      };

      if (!res.ok) {
        setOverlayError(json.error || "Failed to save overlays.");
        return;
      }

      const persisted = Array.isArray(json.overlays) ? json.overlays : overlays;
      setOverlays(persisted);
      setSavedOverlays(persisted);
      setEditingOverlays(false);
      router.refresh();
    } catch (err) {
      setOverlayError(
        err instanceof Error ? err.message : "Failed to save overlays."
      );
    } finally {
      setSavingOverlays(false);
    }
  }, [canEditOverlays, overlays, rankingId, router]);

  const startPointerInteraction = useCallback(
    (e: PointerEvent, id: string, mode: "drag" | "resize") => {
      if (!editingOverlays || !cardRef.current) return;
      const target = overlays.find((item) => item.id === id);
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();

      const rect = cardRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      activeCleanupRef.current?.();

      const startX = e.clientX;
      const startY = e.clientY;
      const origX = target.x;
      const origY = target.y;
      const origWidth = target.width;

      const onPointerMove = (ev: globalThis.PointerEvent) => {
        const dxPct = ((ev.clientX - startX) / rect.width) * 100;
        const dyPct = ((ev.clientY - startY) / rect.height) * 100;

        setOverlays((prev) =>
          prev.map((item) => {
            if (item.id !== id) return item;
            if (mode === "drag") {
              return {
                ...item,
                x: Number(clamp(origX + dxPct, -10, 100).toFixed(2)),
                y: Number(clamp(origY + dyPct, -10, 100).toFixed(2)),
              };
            }
            return {
              ...item,
              width: Number(clamp(origWidth + dxPct, 4, 80).toFixed(2)),
            };
          })
        );
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", cleanup);
        window.removeEventListener("pointercancel", cleanup);
        if (activeCleanupRef.current === cleanup) {
          activeCleanupRef.current = null;
        }
      };

      activeCleanupRef.current = cleanup;
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", cleanup);
      window.addEventListener("pointercancel", cleanup);
    },
    [cardRef, editingOverlays, overlays]
  );

  const startDragOverlay = useCallback(
    (e: PointerEvent, id: string) => startPointerInteraction(e, id, "drag"),
    [startPointerInteraction]
  );

  const startResizeOverlay = useCallback(
    (e: PointerEvent, id: string) => startPointerInteraction(e, id, "resize"),
    [startPointerInteraction]
  );

  return {
    overlays,
    editingOverlays,
    uploadingOverlay,
    savingOverlays,
    overlayError,
    setOverlayError,
    openOverlayEditor,
    cancelEditingOverlays,
    removeOverlay,
    clearOverlays,
    handleUploadOverlay,
    handleSaveOverlays,
    startDragOverlay,
    startResizeOverlay,
  };
}
