import assert from "node:assert/strict";
import {
  formatBlockedMessage,
  inspectMarkdownImages,
} from "../utils/contentModeration.ts";

const imgs = inspectMarkdownImages(
  "Hello ![local](https://xyz.supabase.co/storage/v1/object/public/blog-media/u1/a.webp) and ![ext](https://i.imgur.com/x.png)"
);
assert.equal(imgs.totalImages, 2);
assert.equal(imgs.uploadedImages, 1);
assert.equal(imgs.externalImages, 1);

assert.match(
  formatBlockedMessage(["Title", "Blog Body"]),
  /Unable to publish: prohibited content detected in Title, Blog Body\./
);

console.log("PASSED client moderation helper checks");
