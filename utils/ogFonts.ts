import { readFile } from "node:fs/promises";
import path from "node:path";

type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700 | 900;
  style: "normal";
};

let cachedFonts: OgFont[] | null = null;

async function readLocalOrRemoteFont(
  filename: string,
  name: string,
  weight: 400 | 700 | 900
): Promise<OgFont | null> {
  try {
    const filePath = path.join(process.cwd(), "public/fonts", filename);
    const buffer = await readFile(filePath);
    const data = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
    return { name, data, weight, style: "normal" };
  } catch {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://league-rankr.vercel.app";
      const res = await fetch(`${baseUrl}/fonts/${filename}`);
      if (!res.ok) return null;
      const data = await res.arrayBuffer();
      return { name, data, weight, style: "normal" };
    } catch {
      return null;
    }
  }
}

export async function loadOgFonts(): Promise<OgFont[]> {
  if (cachedFonts && cachedFonts.length > 0) return cachedFonts;

  const results = await Promise.all([
    readLocalOrRemoteFont("PTSerif-Bold.ttf", "WowHeading", 700),
    readLocalOrRemoteFont("Inter-Regular.ttf", "SiteBody", 400),
    readLocalOrRemoteFont("Inter-Bold.ttf", "SiteBody", 700),
    readLocalOrRemoteFont("Inter-Black.ttf", "SiteBody", 900),
  ]);

  const fonts = results.filter((f): f is OgFont => f !== null);
  if (fonts.length > 0) {
    cachedFonts = fonts;
  }
  return fonts;
}
