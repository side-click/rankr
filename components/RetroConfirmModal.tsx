"use client";

import React from "react";
import { RetroWindow } from "@/components/RetroWindow";

interface RetroConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RetroConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  loading = false,
  error = null,
  onConfirm,
  onCancel,
}: RetroConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <RetroWindow title={title} theme="scdl">
          <div className="space-y-4">
            <p className="text-xs text-[#f0ede0] leading-relaxed">{message}</p>

            {error && (
              <div className="p-2 rounded bg-[#2e1414] border border-[#ff857a]/40 text-xs text-[#ff857a]">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={onCancel}
                className="xp-btn text-xs"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={onConfirm}
                className={`xp-btn text-xs ${
                  danger ? "xp-btn-danger" : "xp-btn-primary"
                }`}
              >
                {loading ? "Working..." : confirmLabel}
              </button>
            </div>
          </div>
        </RetroWindow>
      </div>
    </div>
  );
}
