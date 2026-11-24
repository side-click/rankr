"use client";

import type { PointerEvent } from "react";
import { ImagePlus, Save, Trash2, X } from "lucide-react";
import type { RankingOverlay } from "@/types/database";

export function OverlayTriggerButton({
  overlayCount,
  uploadingOverlay,
  onOpenEditor,
  onUploadFile,
}: {
  overlayCount: number;
  uploadingOverlay: boolean;
  onOpenEditor: () => void;
  onUploadFile: (file: File) => void;
}) {
  if (overlayCount > 0) {
    return (
      <button
        type="button"
        onClick={onOpenEditor}
        className="xp-btn text-xs"
      >
        <ImagePlus className="w-3.5 h-3.5" />
        <span>Edit Overlays</span>
      </button>
    );
  }

  return (
    <label className="xp-btn text-xs cursor-pointer">
      <ImagePlus className="w-3.5 h-3.5" />
      <span>{uploadingOverlay ? "Uploading..." : "Add Image / GIF"}</span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        disabled={uploadingOverlay}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUploadFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

export function OverlayEditorBanner({
  editingOverlays,
  overlayCount,
  uploadingOverlay,
  savingOverlays,
  overlayError,
  onUploadFile,
  onClearAll,
  onCancel,
  onSave,
}: {
  editingOverlays: boolean;
  overlayCount: number;
  uploadingOverlay: boolean;
  savingOverlays: boolean;
  overlayError: string | null;
  onUploadFile: (file: File) => void;
  onClearAll: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <>
      {overlayError && !editingOverlays && (
        <div className="mb-4 xp-panel p-2.5 text-xs text-[#ff857a] font-bold border border-[#9e3535]">
          {overlayError}
        </div>
      )}

      {editingOverlays && (
        <div className="mb-4 xp-panel p-3 flex flex-wrap items-center justify-between gap-2 border border-[#c89b3c]/50">
          <div className="text-xs text-[#e8e6b8]">
            <span className="font-bold text-[#f0c020]">Overlay Mode:</span>{" "}
            Upload PNG/JPG/WebP/GIF (max 5 MB), drag to position, and use the
            bottom-right corner to resize.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="xp-btn text-xs cursor-pointer">
              <ImagePlus className="w-3.5 h-3.5" />
              <span>
                {uploadingOverlay ? "Uploading..." : "Add Image / GIF"}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={uploadingOverlay}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            {overlayCount > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="xp-btn xp-btn-danger text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
            <button
              type="button"
              disabled={savingOverlays}
              onClick={onCancel}
              className="xp-btn text-xs"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              disabled={savingOverlays}
              onClick={onSave}
              className="xp-btn xp-btn-primary text-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingOverlays ? "Saving..." : "Save Overlays"}</span>
            </button>
          </div>
          {overlayError && (
            <div className="w-full text-xs text-[#ff857a] font-bold">
              {overlayError}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function OverlayCanvasLayer({
  overlays,
  editingOverlays,
  onStartDrag,
  onStartResize,
  onRemove,
}: {
  overlays: RankingOverlay[];
  editingOverlays: boolean;
  onStartDrag: (e: PointerEvent, id: string) => void;
  onStartResize: (e: PointerEvent, id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (overlays.length === 0) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none select-none">
      {overlays.map((ov) => (
        <div
          key={ov.id}
          onPointerDown={(e) => onStartDrag(e, ov.id)}
          style={{
            left: `${ov.x}%`,
            top: `${ov.y}%`,
            width: `${ov.width}%`,
          }}
          className={`absolute ${
            editingOverlays
              ? "pointer-events-auto cursor-grab active:cursor-grabbing ring-2 ring-[#f0c020] bg-black/15 rounded-sm"
              : "pointer-events-none"
          }`}
        >
          <img
            src={ov.url}
            alt="Overlay"
            crossOrigin="anonymous"
            draggable={false}
            className="w-full h-auto block"
          />
          {editingOverlays && (
            <>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onRemove(ov.id)}
                className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-[#b82525] hover:bg-[#d93636] text-white border border-white/60 flex items-center justify-center shadow cursor-pointer"
                title="Remove overlay"
              >
                <X className="w-3 h-3" />
              </button>
              <button
                type="button"
                onPointerDown={(e) => onStartResize(e, ov.id)}
                className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-xs bg-[#f0c020] border border-black/70 cursor-nwse-resize shadow"
                title="Drag to resize"
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
