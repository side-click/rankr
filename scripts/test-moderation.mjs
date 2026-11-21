import assert from "node:assert/strict";
import {
  evaluateContentModeration,
  formatBlockedMessage,
} from "../utils/contentModeration.ts";

// 1. Direct + obfuscated Tier 1 blocks
const blockCases = [
  ["Title", "check out n1gg3r in this title"],
  ["Subtitle", "f@ggot tier list"],
  ["Commentary", "k.y.s right now"],
  ["Tier Notes", "k y s loser"],
  ["General Notes", "go dr\u200bink ble\u200bach"],
  ["Blog Body", "visit pornhub.com/video"],
  ["Tier Name", "r3t4rded"],
  ["Commentary", "his SSN is 123-45-6789"],
  ["Blog Body", "h\u0040ng yo\u0075rself"],
];

for (const [field, value] of blockCases) {
  const res = evaluateContentModeration([{ field, value }]);
  assert.equal(
    res.action,
    "block",
    `Expected BLOCK for [${field}] = "${value}", got ${res.action}`
  );
  assert.ok(
    res.blockedFields.includes(field),
    `Expected blockedFields to include "${field}"`
  );
}

// 2. Tier 2 soft flags (allow publish, alert admin)
const flagCases = [
  [{ field: "Commentary", value: "what a wh0re pick" }, null],
  [{ field: "Blog Body", value: "piece of shit draft" }, null],
  [
    { field: "Blog Body", value: "![meme](https://i.imgur.com/example.png)" },
    "![meme](https://i.imgur.com/example.png)",
  ],
];

for (const [fieldInput, md] of flagCases) {
  const res = evaluateContentModeration([fieldInput], {
    markdownContent: md,
  });
  assert.equal(
    res.action,
    "flag",
    `Expected FLAG for "${fieldInput.value}", got ${res.action}`
  );
}

// 3. Clean League of Legends & everyday prose (must NOT false-positive)
const cleanCases = [
  ["Title", "Midseason Top Lane Class & Assassin Tier List"],
  ["Subtitle", "Knight vs Cassiopeia & Fiddlesticks CP Analysis"],
  ["Blog Body", "That draft was criminal, getting gapped top by a Shaco passing through river with grapes and cocktails. Wait until playoffs!"],
  [
    "Blog Body",
    "![banner](https://xyz.supabase.co/storage/v1/object/public/blog-media/u1/img.webp)",
  ],
];

for (const [field, value] of cleanCases) {
  const res = evaluateContentModeration(
    [{ field, value }],
    field === "Blog Body" ? { markdownContent: value } : undefined
  );
  assert.equal(
    res.action,
    "allow",
    `False positive on "${value}": got ${res.action} (${res.matchedTerms.join(", ")})`
  );
}

assert.match(
  formatBlockedMessage(["Title", "Blog Body"]),
  /Unable to publish: prohibited content detected in Title, Blog Body\./
);

console.log(
  `PASSED moderation suite (${blockCases.length} blocks, ${flagCases.length} flags, ${cleanCases.length} clean cases)`
);
