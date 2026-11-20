import fs from "node:fs";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL && fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const force = process.argv.includes("--force");
const BUCKET = "champion-splashes";
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 1. Ensure public bucket exists
const { data: buckets } = await supabase.storage.listBuckets();
if (!buckets?.some((b) => b.name === BUCKET)) {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 1024 * 1024,
  });
  if (error) {
    console.error("Failed to create bucket:", error.message);
    process.exit(1);
  }
  console.log(`Created public bucket "${BUCKET}"`);
}

// 2. List existing files so we can skip already-cached champions
const existing = new Set();
if (!force) {
  let offset = 0;
  while (true) {
    const { data } = await supabase.storage.from(BUCKET).list("", { limit: 1000, offset });
    if (!data || data.length === 0) break;
    for (const f of data) existing.add(f.name);
    if (data.length < 1000) break;
    offset += 1000;
  }
}

// 3. Fetch latest Data Dragon champion list
const versions = await (
  await fetch("https://ddragon.leagueoflegends.com/api/versions.json")
).json();
const ddVersion = versions[0];
const ddJson = await (
  await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/data/en_US/champion.json`
  )
).json();
const champIds = Object.keys(ddJson.data ?? {});
console.log(`DDragon ${ddVersion}: ${champIds.length} champions (${existing.size} already cached)`);

let uploaded = 0;
let skipped = 0;
let failed = 0;
let totalBytes = 0;

const CONCURRENCY = 8;
let idx = 0;

async function worker() {
  while (idx < champIds.length) {
    const id = champIds[idx++];
    const normalized = id === "FiddleSticks" ? "Fiddlesticks" : id;
    const filename = `${normalized}.webp`;

    if (existing.has(filename)) {
      skipped++;
      continue;
    }

    try {
      const url = `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${encodeURIComponent(
        normalized
      )}_0.jpg`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const inputBuf = Buffer.from(await res.arrayBuffer());

      const webpBuf = await sharp(inputBuf)
        .resize({ width: 600, withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(filename, webpBuf, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: true,
        });
      if (error) throw new Error(error.message);

      uploaded++;
      totalBytes += webpBuf.length;
    } catch (err) {
      failed++;
      console.warn(`[warn] ${id}: ${err.message}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
console.log(
  `Done! uploaded=${uploaded} (${(totalBytes / 1024 / 1024).toFixed(
    2
  )} MB), skipped=${skipped}, failed=${failed}`
);
