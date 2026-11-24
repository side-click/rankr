import { readFile } from "node:fs/promises";
import path from "node:path";

type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700 | 900;
  style: "normal";
};

let cachedFonts: OgFont[] | null = null;

export const OG_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

export function safeDecodeParam(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

function getAllowedImageHosts(): Set<string> {
  const hosts = new Set<string>([
    "ddragon.leagueoflegends.com",
    "raw.communitydragon.org",
    "cdn.discordapp.com",
    "leaguerankr.com",
    "league-rankr.vercel.app",
  ]);
  for (const envUrl of [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ]) {
    if (!envUrl) continue;
    try {
      hosts.add(new URL(envUrl).hostname.toLowerCase());
    } catch {
      // Ignore malformed env URL
    }
  }
  return hosts;
}

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
      const res = await fetch(`${baseUrl}/fonts/${filename}`, {
        signal: AbortSignal.timeout(4000),
      });
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
const MAX_OG_IMAGE_BYTES = 4 * 1024 * 1024;

async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    const allowedHosts = getAllowedImageHosts();
    if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
      return null;
    }

    const res = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;

    const declaredLen = Number(res.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLen) && declaredLen > MAX_OG_IMAGE_BYTES) {
      return null;
    }

    const contentTypeHeader = res.headers.get("content-type") || "";
    const mime = contentTypeHeader.split(";")[0].trim().toLowerCase();
    if (!SUPPORTED_OG_MIMES.has(mime)) return null;

    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength > MAX_OG_IMAGE_BYTES) return null;

    const buffer = Buffer.from(arrayBuf);
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
    return logoUrl.length <= MAX_OG_IMAGE_BYTES ? logoUrl : null;
  }
  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
    return fetchImageAsDataUri(logoUrl);
  }
  if (logoUrl.startsWith("/") && !logoUrl.startsWith("//")) {
    try {
      const publicDir = path.resolve(process.cwd(), "public");
      const relative = decodeURIComponent(logoUrl).replace(/^\/+/, "");
      const resolvedPath = path.resolve(publicDir, relative);
      if (
        !resolvedPath.startsWith(publicDir + path.sep) &&
        resolvedPath !== publicDir
      ) {
        return null;
      }
      const buffer = await readFile(resolvedPath);
      if (buffer.byteLength > MAX_OG_IMAGE_BYTES) return null;
      const ext = path.extname(resolvedPath).toLowerCase();
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
      try {
        const absoluteUrl = new URL(
          encodeURI(decodeURI(logoUrl)),
          baseUrl
        ).toString();
        return fetchImageAsDataUri(absoluteUrl);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function getOgChampionCenteredSplashJpg(championName: string): string {
  const clean = championName.trim();
  const ddKey = clean.toLowerCase() === "fiddlesticks" ? "FiddleSticks" : clean;
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${encodeURIComponent(
    ddKey
  )}_0.jpg`;
}
