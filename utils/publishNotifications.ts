import type { ModerationResult } from "@/utils/contentModeration";
import {
  logModerationEvent,
  sendModerationWebhook,
} from "@/utils/moderationServer";

export async function dispatchPublishedBlogNotification(params: {
  origin: string;
  userId: string;
  blogId: string;
  title: string;
  authorDisplay: string;
  discordId: string | null;
  leagueNameSnapshot: string | null;
  seasonNameSnapshot: string | null;
  hasBanner: boolean;
  mod: ModerationResult;
}): Promise<{ flagged: boolean }> {
  const {
    origin,
    userId,
    blogId,
    title,
    authorDisplay,
    discordId,
    leagueNameSnapshot,
    seasonNameSnapshot,
    hasBanner,
    mod,
  } = params;

  const hasMedia = hasBanner || mod.totalImageCount > 0;
  const blogUrl = `${origin}/blog/${blogId}`;
  const isFlagged = mod.action === "flag";
  const shouldLogModeration = isFlagged || hasMedia;

  await Promise.all([
    ...(shouldLogModeration
      ? [
          logModerationEvent({
            userId,
            contentType: "blog",
            contentId: blogId,
            action: isFlagged ? "flagged" : "media_review",
            categories:
              mod.categories.length > 0 ? mod.categories : ["media_review"],
            fieldNames: mod.flaggedFields,
            matchedTerms: mod.matchedTerms,
            titleSnapshot: title,
          }),
        ]
      : []),
    sendModerationWebhook({
      title: isFlagged ? "⚠️ Flagged Blog Published" : "📢 Blog Published",
      url: blogUrl,
      color: isFlagged ? 0xe84a1b : 0x2d5a3f,
      description: `**${title}**\n${
        seasonNameSnapshot
          ? `${leagueNameSnapshot ? `${leagueNameSnapshot} — ` : ""}${seasonNameSnapshot}`
          : "General"
      }`,
      pingModerator: isFlagged,
      fields: [
        {
          name: "Author",
          value: `${authorDisplay} (${discordId ?? "N/A"})`,
          inline: true,
        },
        {
          name: "Moderation Check",
          value:
            mod.matchedTerms.length > 0
              ? `Matched terms: \`${mod.matchedTerms.join("`, `")}\``
              : "No flagged text detected",
          inline: true,
        },
        ...(hasMedia
          ? [
              {
                name: "Images",
                value: `${hasBanner ? "Banner attached" : "No banner"}${
                  mod.totalImageCount > 0
                    ? ` • ${mod.totalImageCount} inline image${
                        mod.totalImageCount === 1 ? "" : "s"
                      }${
                        mod.externalImageCount > 0
                          ? ` (${mod.externalImageCount} external URL)`
                          : ""
                      }`
                    : ""
                }`,
                inline: true,
              },
            ]
          : []),
        {
          name: "Link",
          value: `[Open Blog](${blogUrl})`,
          inline: false,
        },
      ],
    }),
  ]);

  return { flagged: isFlagged };
}

export async function dispatchPublishedRankingNotification(params: {
  origin: string;
  userId: string;
  rankingId: string;
  isPlayer: boolean;
  title: string;
  username: string;
  discordId: string | null;
  leagueNameSnapshot: string | null;
  seasonNameSnapshot: string | null;
  overlayCount: number;
  mod: ModerationResult;
}): Promise<{ flagged: boolean }> {
  const {
    origin,
    userId,
    rankingId,
    isPlayer,
    title,
    username,
    discordId,
    leagueNameSnapshot,
    seasonNameSnapshot,
    overlayCount,
    mod,
  } = params;

  const contentType = isPlayer ? "tierlist" : "ranking";
  const rankingUrl = isPlayer
    ? `${origin}/tierlist/${rankingId}`
    : `${origin}/rankings/${rankingId}`;
  const isFlagged = mod.action === "flag";
  const shouldLogModeration = isFlagged || overlayCount > 0;

  await Promise.all([
    ...(shouldLogModeration
      ? [
          logModerationEvent({
            userId,
            contentType,
            contentId: rankingId,
            action: isFlagged ? "flagged" : "media_review",
            categories:
              mod.categories.length > 0 ? mod.categories : ["media_review"],
            fieldNames: mod.flaggedFields,
            matchedTerms: mod.matchedTerms,
            titleSnapshot: title,
          }),
        ]
      : []),
    sendModerationWebhook({
      title: isFlagged ? "⚠️ Flagged Ranking Published" : "📢 Ranking Published",
      url: rankingUrl,
      color: isFlagged ? 0xe84a1b : 0x2d5a3f,
      description: `**${title}**\n${
        leagueNameSnapshot ? `${leagueNameSnapshot} — ` : ""
      }${seasonNameSnapshot ?? ""}`,
      pingModerator: isFlagged,
      fields: [
        {
          name: "Author",
          value: `${username} (${discordId ?? "N/A"})`,
          inline: true,
        },
        {
          name: "Moderation Check",
          value:
            mod.matchedTerms.length > 0
              ? `Matched terms: \`${mod.matchedTerms.join("`, `")}\``
              : "No flagged text detected",
          inline: true,
        },
        ...(overlayCount > 0
          ? [
              {
                name: "Image Overlays",
                value: `${overlayCount} custom image overlay${
                  overlayCount === 1 ? "" : "s"
                } attached`,
                inline: true,
              },
            ]
          : []),
        {
          name: "Link",
          value: `[Open Published Ranking](${rankingUrl})`,
          inline: false,
        },
      ],
    }),
  ]);

  return { flagged: isFlagged };
}
