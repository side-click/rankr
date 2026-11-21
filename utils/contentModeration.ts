export type ModerationCategory =
  | "hate_speech"
  | "self_harm"
  | "explicit_illegal"
  | "doxxing"
  | "harassment_flag"
  | "external_media";

export interface ModerationFieldInput {
  field: string;
  value: string | null | undefined;
}

export interface ModerationResult {
  action: "allow" | "flag" | "block";
  blockedFields: string[];
  flaggedFields: string[];
  categories: ModerationCategory[];
  matchedTerms: string[];
  externalImageCount: number;
  totalImageCount: number;
}

interface PatternRule {
  label: string;
  category: ModerationCategory;
  severity: "block" | "flag";
  regex: RegExp;
  /** Also check single-character-collapsed text (catches "niiiigger" -> "niger") */
  checkCollapsed?: boolean;
}

const BLOG_MEDIA_PUBLIC_MARKER = "/storage/v1/object/public/blog-media/";

// Words allowed through the collapsed/de-obfuscated pass to avoid Scunthorpe false positives.
const SAFE_ALLOWLIST = new Set([
  "assassin",
  "assassins",
  "class",
  "classic",
  "knight",
  "knights",
  "night",
  "scunthorpe",
  "cassiopeia",
  "fiddlesticks",
  "grape",
  "grapes",
  "cocktail",
  "cocktails",
  "shaco",
  "pass",
  "passing",
  "passed",
  "bass",
  "mass",
  "grass",
  "brass",
  "glass",
  "title",
  "subtitle",
  "analytics",
  "analysis",
  "banal",
  "canal",
  "therapist",
  "scrape",
  "scraping",
]);

const RULES: PatternRule[] = [
  // --- TIER 1: HARD BLOCK (Hate Speech / Slurs) ---
  {
    label: "nigger",
    category: "hate_speech",
    severity: "block",
    regex: /\bn[i1!|]+[gq]+(?:e?r|a|uh)[sz]?\b/i,
    checkCollapsed: true,
  },
  {
    label: "faggot",
    category: "hate_speech",
    severity: "block",
    regex: /\bf[a@4]+g+(?:[o0]t|g?[e3]t|s|z)?\b/i,
    checkCollapsed: true,
  },
  {
    label: "retard",
    category: "hate_speech",
    severity: "block",
    regex: /\br[e3]+t[a@4]rd(?:ed|s|z)?\b/i,
    checkCollapsed: true,
  },
  {
    label: "tranny",
    category: "hate_speech",
    severity: "block",
    regex: /\btr[a@4]nn(?:y|ies|ie)\b/i,
    checkCollapsed: true,
  },
  {
    label: "chink",
    category: "hate_speech",
    severity: "block",
    regex: /\bch[i1!|]nk[sz]?\b/i,
    checkCollapsed: true,
  },
  {
    label: "spic",
    category: "hate_speech",
    severity: "block",
    regex: /\bsp[i1!|]c[sz]?\b/i,
    checkCollapsed: true,
  },
  {
    label: "kike",
    category: "hate_speech",
    severity: "block",
    regex: /\bk[i1!|]k[e3][sz]?\b/i,
    checkCollapsed: true,
  },
  {
    label: "wetback",
    category: "hate_speech",
    severity: "block",
    regex: /\bw[e3]tb[a@4]ck[sz]?\b/i,
  },
  {
    label: "coon",
    category: "hate_speech",
    severity: "block",
    regex: /\bc[o0]{2,}n[sz]?\b/i,
  },

  // --- TIER 1: HARD BLOCK (Self-Harm / Suicide Encouragement) ---
  {
    label: "kys",
    category: "self_harm",
    severity: "block",
    regex: /\bkys\b/i,
    checkCollapsed: true,
  },
  {
    label: "kill yourself",
    category: "self_harm",
    severity: "block",
    regex: /\bkill\s+(?:yo)?ur\s*self\b/i,
  },
  {
    label: "neck yourself",
    category: "self_harm",
    severity: "block",
    regex: /\bneck\s+(?:yo)?ur\s*self\b/i,
  },
  {
    label: "hang yourself",
    category: "self_harm",
    severity: "block",
    regex: /\bhang\s+(?:yo)?ur\s*self\b/i,
  },
  {
    label: "drink bleach",
    category: "self_harm",
    severity: "block",
    regex: /\bdrink\s+bleach\b/i,
  },
  {
    label: "slit your wrists",
    category: "self_harm",
    severity: "block",
    regex: /\bslit\s+(?:yo)?ur\s+wrists?\b/i,
  },

  // --- TIER 1: HARD BLOCK (Explicit Sexual Violence / Illegal / CSAM / NSFW Sites) ---
  {
    label: "child sexual abuse material",
    category: "explicit_illegal",
    severity: "block",
    regex:
      /\b(?:child\s*porn(?:ography)?|csam|loli\s*porn|shota\s*porn|underage\s*nudes?)\b/i,
  },
  {
    label: "sexual violence",
    category: "explicit_illegal",
    severity: "block",
    regex: /\b(?:rape\s+(?:you|her|him|them)|get\s+raped|rapist)\b/i,
  },
  {
    label: "explicit adult site",
    category: "explicit_illegal",
    severity: "block",
    regex:
      /\b(?:pornhub\.com|xvideos\.com|xnxx\.com|redtube\.com|xhamster\.com|chaturbate\.com|onlyfans\.com)\b/i,
  },

  // --- TIER 1: HARD BLOCK (Doxxing / PII) ---
  {
    label: "ssn pattern",
    category: "doxxing",
    severity: "block",
    regex: /\b\d{3}-\d{2}-\d{4}\b/,
  },
  {
    label: "doxxing phrase",
    category: "doxxing",
    severity: "block",
    regex:
      /\b(?:home\s+address\s+is|leak\s+(?:his|her|their)\s+(?:ip|address|phone)|doxx(?:ing|ed)?\s+(?:him|her|them))\b/i,
  },

  // --- TIER 2: SOFT FLAG (Borderline Harassment / Profanity Alerts for Admin Review) ---
  {
    label: "cunt",
    category: "harassment_flag",
    severity: "flag",
    regex: /\bcunt[sz]?\b/i,
    checkCollapsed: true,
  },
  {
    label: "whore",
    category: "harassment_flag",
    severity: "flag",
    regex: /\bwh[o0]r[e3][sz]?\b/i,
    checkCollapsed: true,
  },
  {
    label: "slut",
    category: "harassment_flag",
    severity: "flag",
    regex: /\bslut(?:s|ty)?\b/i,
    checkCollapsed: true,
  },
  {
    label: "go die",
    category: "harassment_flag",
    severity: "flag",
    regex: /\b(?:go\s+die|hope\s+you\s+die)\b/i,
  },
  {
    label: "piece of shit",
    category: "harassment_flag",
    severity: "flag",
    regex: /\bpiece\s+of\s+shit\b/i,
  },
];

function stripInvisibleAndDiacritics(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "");
}

function normalizeLeetspeak(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[8]/g, "b")
    .replace(/(.)\1{2,}/g, "$1$1");
}

function deobfuscateSpacedLetters(text: string): string {
  // Collapse short isolated single-letter runs like "k.y.s" or "f a g" -> "kys", "fag"
  return text.replace(
    /\b([a-z0-9])(?:[\s._*-]+([a-z0-9])){2,10}\b/gi,
    (match) => match.replace(/[\s._*-]+/g, "")
  );
}

function collapseAllRepeats(text: string): string {
  return text.replace(/(.)\1+/g, "$1");
}

function stripSafeAllowlistedWords(text: string): string {
  return text.replace(/\b[a-z]+\b/gi, (word) =>
    SAFE_ALLOWLIST.has(word.toLowerCase()) ? " " : word
  );
}

export function inspectMarkdownImages(markdown: string | null | undefined): {
  totalImages: number;
  externalImages: number;
  uploadedImages: number;
} {
  if (!markdown) {
    return { totalImages: 0, externalImages: 0, uploadedImages: 0 };
  }
  const matches = Array.from(markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g));
  let externalImages = 0;
  let uploadedImages = 0;
  for (const m of matches) {
    const url = (m[1] ?? "").trim();
    if (!url) continue;
    if (url.includes(BLOG_MEDIA_PUBLIC_MARKER)) {
      uploadedImages += 1;
    } else {
      externalImages += 1;
    }
  }
  return {
    totalImages: matches.length,
    externalImages,
    uploadedImages,
  };
}

export function evaluateContentModeration(
  fields: ModerationFieldInput[],
  opts?: { markdownContent?: string | null }
): ModerationResult {
  const blockedFieldSet = new Set<string>();
  const flaggedFieldSet = new Set<string>();
  const categorySet = new Set<ModerationCategory>();
  const matchedSet = new Set<string>();

  for (const item of fields) {
    const raw = (item.value ?? "").trim();
    if (!raw) continue;

    const cleanRaw = stripSafeAllowlistedWords(
      stripInvisibleAndDiacritics(raw)
    );
    const leet = stripSafeAllowlistedWords(normalizeLeetspeak(cleanRaw));
    const despaced = stripSafeAllowlistedWords(
      deobfuscateSpacedLetters(leet)
    );
    const collapsed = stripSafeAllowlistedWords(collapseAllRepeats(despaced));

    const variants = [cleanRaw, leet, despaced];

    for (const rule of RULES) {
      let matched = variants.some((v) => rule.regex.test(v));
      if (!matched && rule.checkCollapsed) {
        matched = rule.regex.test(collapsed);
      }
      if (!matched) continue;

      matchedSet.add(rule.label);
      categorySet.add(rule.category);
      if (rule.severity === "block") {
        blockedFieldSet.add(item.field);
      } else {
        flaggedFieldSet.add(item.field);
      }
    }
  }

  const imageStats = inspectMarkdownImages(opts?.markdownContent);
  if (imageStats.externalImages > 0) {
    categorySet.add("external_media");
    flaggedFieldSet.add("Blog Body (External Image)");
  }

  const blockedFields = Array.from(blockedFieldSet);
  const flaggedFields = Array.from(flaggedFieldSet);
  const action: ModerationResult["action"] =
    blockedFields.length > 0
      ? "block"
      : flaggedFields.length > 0
      ? "flag"
      : "allow";

  return {
    action,
    blockedFields,
    flaggedFields,
    categories: Array.from(categorySet),
    matchedTerms: Array.from(matchedSet),
    externalImageCount: imageStats.externalImages,
    totalImageCount: imageStats.totalImages,
  };
}

export function formatBlockedMessage(blockedFields: string[]): string {
  const list =
    blockedFields.length > 0 ? blockedFields.join(", ") : "one or more fields";
  return `Unable to publish: prohibited content detected in ${list}. Please edit those fields and try again.`;
}
