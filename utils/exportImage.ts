import type { Options } from "html-to-image/lib/types";

/**
 * Lazily imports `html-to-image` only when the user exports a PNG,
 * keeping initial page JS bundles small.
 */
export async function exportElementToPng(
  node: HTMLElement,
  options?: Options
): Promise<string> {
  const { toPng } = await import("html-to-image");
  return toPng(node, options);
}
