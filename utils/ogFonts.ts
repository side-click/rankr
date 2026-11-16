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

const SUPPORTED_OG_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
]);

async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentTypeHeader = res.headers.get("content-type") || "";
    const mime = contentTypeHeader.split(";")[0].trim().toLowerCase();
    if (!SUPPORTED_OG_MIMES.has(mime)) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function resolveOgImageSrc(
  logoUrl: string | null | undefined
): Promise<string | null> {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("data:image/")) {
    return logoUrl;
  }
  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
    return fetchImageAsDataUri(logoUrl);
  }
  if (logoUrl.startsWith("/")) {
    try {
      const relative = decodeURIComponent(logoUrl).replace(/^\/+/, "");
      const filePath = path.join(process.cwd(), "public", relative);
      const buffer = await readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime =
        ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".gif"
          ? "image/gif"
          : ext === ".png"
          ? "image/png"
          : null;
      if (!mime) return null;
      return `data:${mime};base64,${buffer.toString("base64")}`;
    } catch {
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://league-rankr.vercel.app";
      const absoluteUrl = new URL(
        encodeURI(decodeURI(logoUrl)),
        baseUrl
      ).toString();
      return fetchImageAsDataUri(absoluteUrl);
    }
  }
  return null;
}
