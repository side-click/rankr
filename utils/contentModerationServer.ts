import {
  inspectMarkdownImages,
  type ModerationCategory,
  type ModerationFieldInput,
  type ModerationResult,
} from "@/utils/contentModeration";
import { getServiceRoleClient } from "@/utils/moderationServer";

interface DbModerationRule {
  term: string;
  rule_type: "allow" | "block" | "flag";
}

interface PatternRule {
  label: string;
  category: ModerationCategory;
  severity: "block" | "flag";
  regex: RegExp;
}

const BUILTIN_SAFE_WORDS = new Set([
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

// Lightweight deterministic fallback rules (no slurs stored in repo; AI moderation + DB rules handle broad speech)
const DETERMINISTIC_RULES: PatternRule[] = [
  {
    label: "kys",
    category: "self_harm",
    severity: "block",
    regex: /\bkys\b/i,
  },
  {
    label: "self-harm encouragement",
    category: "self_harm",
    severity: "block",
    regex:
      /\b(?:kill\s+(?:yo)?ur\s*self|neck\s+(?:yo)?ur\s*self|hang\s+(?:yo)?ur\s*self|drink\s+bleach|slit\s+(?:yo)?ur\s+wrists?)\b/i,
  },
  {
    label: "explicit adult site",
    category: "explicit_illegal",
    severity: "block",
    regex:
      /\b(?:pornhub\.com|xvideos\.com|xnxx\.com|redtube\.com|xhamster\.com|chaturbate\.com|onlyfans\.com)\b/i,
  },
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
];

function escapeRegex(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
  return text.replace(
    /\b([a-z0-9])(?:[\s._*-]+([a-z0-9])){2,10}\b/gi,
    (match) => match.replace(/[\s._*-]+/g, "")
  );
}

function applyAllowlist(text: string, allowTerms: string[]): string {
  let out = text.replace(/\b[a-z]+\b/gi, (word) =>
    BUILTIN_SAFE_WORDS.has(word.toLowerCase()) ? " " : word
  );
  for (const term of allowTerms) {
    const clean = term.trim();
    if (!clean) continue;
    const re = new RegExp(`\\b${escapeRegex(clean)}\\b`, "gi");
    out = out.replace(re, " ");
  }
  return out;
}

async function loadDbRules(): Promise<DbModerationRule[]> {
  const adminDb = getServiceRoleClient();
  if (!adminDb) return [];
  try {
    const { data, error } = await adminDb
      .from("moderation_rules")
      .select("term, rule_type");
    if (error || !Array.isArray(data)) return [];
    return data as DbModerationRule[];
  } catch {
    return [];
  }
}

interface OpenAiModerationItem {
  flagged: boolean;
  categories: Record<string, boolean>;
  category_scores: Record<string, number>;
}

const TIER1_BLOCK_CATEGORIES = [
  "hate/threatening",
  "harassment/threatening",
  "self-harm/intent",
  "self-harm/instructions",
  "sexual/minors",
  "violence/graphic",
];

async function runOpenAiModeration(
  inputs: { field: string; text: string }[]
): Promise<
  {
    field: string;
    severity: "block" | "flag";
    labels: string[];
  }[]
> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || inputs.length === 0) return [];

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: inputs.map((i) => i.text),
      }),
      signal: AbortSignal.timeout(3500),
    });

    if (!res.ok) return [];
    const json = (await res.json()) as { results?: OpenAiModerationItem[] };
    const results = Array.isArray(json?.results) ? json.results : [];
    const findings: {
      field: string;
      severity: "block" | "flag";
      labels: string[];
    }[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const r = results[i];
      if (!r) continue;
      const activeCats = Object.entries(r.categories ?? {})
        .filter(([, hit]) => Boolean(hit))
        .map(([cat]) => cat);

      const scores = r.category_scores ?? {};
      const isTier1 =
        TIER1_BLOCK_CATEGORIES.some((c) => Boolean(r.categories?.[c])) ||
        (scores["hate"] ?? 0) >= 0.72 ||
        (scores["self-harm"] ?? 0) >= 0.65 ||
        (scores["sexual/minors"] ?? 0) >= 0.35;

      if (isTier1) {
        findings.push({
          field: inputs[i].field,
          severity: "block",
          labels: activeCats.length > 0 ? activeCats : ["high_severity"],
        });
      } else if (r.flagged || activeCats.length > 0) {
        findings.push({
          field: inputs[i].field,
          severity: "flag",
          labels: activeCats,
        });
      }
    }
    return findings;
  } catch {
    return [];
  }
}

export async function evaluateContentModerationServer(
  fields: ModerationFieldInput[],
  opts?: { markdownContent?: string | null }
): Promise<ModerationResult> {
  const dbRules = await loadDbRules();
  const allowTerms = dbRules
    .filter((r) => r.rule_type === "allow")
    .map((r) => r.term);
  const customRules: PatternRule[] = dbRules
    .filter((r) => r.rule_type === "block" || r.rule_type === "flag")
    .map((r) => ({
      label: r.term,
      category: "custom_rule" as ModerationCategory,
      severity: r.rule_type as "block" | "flag",
      regex: new RegExp(`\\b${escapeRegex(r.term.trim())}\\b`, "i"),
    }));

  const allDeterministicRules = [...DETERMINISTIC_RULES, ...customRules];

  const blockedFieldSet = new Set<string>();
  const flaggedFieldSet = new Set<string>();
  const categorySet = new Set<ModerationCategory>();
  const matchedSet = new Set<string>();
  const aiInputs: { field: string; text: string }[] = [];

  for (const item of fields) {
    const raw = (item.value ?? "").trim();
    if (!raw) continue;

    const cleanRaw = applyAllowlist(
      stripInvisibleAndDiacritics(raw),
      allowTerms
    );
    const leet = applyAllowlist(normalizeLeetspeak(cleanRaw), allowTerms);
    const despaced = applyAllowlist(
      deobfuscateSpacedLetters(leet),
      allowTerms
    );

    if (cleanRaw.trim()) {
      aiInputs.push({ field: item.field, text: cleanRaw.slice(0, 8000) });
    }

    const variants = [cleanRaw, leet, despaced];
    for (const rule of allDeterministicRules) {
      if (!variants.some((v) => rule.regex.test(v))) continue;
      matchedSet.add(rule.label);
      categorySet.add(rule.category);
      if (rule.severity === "block") {
        blockedFieldSet.add(item.field);
      } else {
        flaggedFieldSet.add(item.field);
      }
    }
  }

  const aiFindings = await runOpenAiModeration(aiInputs);
  for (const f of aiFindings) {
    categorySet.add("ai_moderation");
    for (const label of f.labels) matchedSet.add(`ai:${label}`);
    if (f.severity === "block") {
      blockedFieldSet.add(f.field);
    } else {
      flaggedFieldSet.add(f.field);
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
