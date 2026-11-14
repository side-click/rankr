import { readFile } from "node:fs/promises";
import path from "node:path";

type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
};

let cachedFonts: OgFont[] | null = null;

async function readLocalFont(
  filename: string,
  name: string,
  weight: 400 | 700
): Promise<OgFont | null> {
  try {
    const filePath = path.join(process.cwd(), "assets/fonts", filename);
    const buffer = await readFile(filePath);
    const data = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
    return { name, data, weight, style: "normal" };
  } catch {
    return null;
  }
}

export async function loadOgFonts(): Promise<OgFont[]> {
  if (cachedFonts && cachedFonts.length > 0) return cachedFonts;

  const results = await Promise.all([
    readLocalFont("PTSerif-Bold.ttf", "WowHeading", 700),
    readLocalFont("PTSans-Regular.ttf", "SiteBody", 400),
    readLocalFont("PTSans-Bold.ttf", "SiteBody", 700),
  ]);

  const fonts = results.filter((f): f is OgFont => f !== null);
  if (fonts.length > 0) {
    cachedFonts = fonts;
  }
  return fonts;
}
