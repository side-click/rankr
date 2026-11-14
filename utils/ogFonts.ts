type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700 | 800;
  style: "normal";
};

let cachedFonts: OgFont[] | null = null;

async function fetchGoogleFontTtf(
  familyQuery: string,
  name: string,
  weight: 400 | 700 | 800
): Promise<OgFont | null> {
  try {
    const cssRes = await fetch(
      `https://fonts.googleapis.com/css2?family=${familyQuery}`,
      {
        headers: {
          // Older UA causes Google Fonts to return .ttf instead of .woff2 (required by Satori/next/og)
          "User-Agent": "Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)",
        },
        next: { revalidate: 86400 },
      }
    );
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const match = css.match(/src:\s*url\(([^)]+\.ttf)\)/i);
    if (!match?.[1]) return null;

    const fontRes = await fetch(match[1], { next: { revalidate: 86400 } });
    if (!fontRes.ok) return null;
    const data = await fontRes.arrayBuffer();
    return { name, data, weight, style: "normal" };
  } catch {
    return null;
  }
}

export async function loadOgFonts(): Promise<OgFont[]> {
  if (cachedFonts && cachedFonts.length > 0) return cachedFonts;

  const results = await Promise.all([
    fetchGoogleFontTtf("PT+Serif:wght@700", "WowHeading", 700),
    fetchGoogleFontTtf("Open+Sans:wght@400", "SiteBody", 400),
    fetchGoogleFontTtf("Open+Sans:wght@700", "SiteBody", 700),
  ]);

  const fonts = results.filter((f): f is OgFont => f !== null);
  if (fonts.length > 0) {
    cachedFonts = fonts;
  }
  return fonts;
}
