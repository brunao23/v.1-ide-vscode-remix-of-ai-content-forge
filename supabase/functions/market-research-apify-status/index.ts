import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { resolveRuntimeSecrets } from "../_shared/runtime-secrets.ts";
import { HttpError, resolveTenantForRequest } from "../_shared/auth-tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Platform = "instagram" | "tiktok" | "youtube";
type PostType = "all" | "carousel" | "reels" | "image" | "video";
type NormalizedPostType = "reel" | "carousel" | "image" | "video";

function safeNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function parseTags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_-]+/gu) || [];
  return Array.from(new Set(matches.map((t) => t.replace(/^#/, ""))));
}

function parseMentions(text: string): string[] {
  const matches = text.match(/@[\p{L}\p{N}._-]+/gu) || [];
  return Array.from(new Set(matches.map((t) => t.replace(/^@/, ""))));
}

function isLikelyApifyPostItem(item: any): boolean {
  if (!item || typeof item !== "object") return false;
  if (String(item.error || "").toLowerCase() === "no_items") return false;

  // Instagram indicators
  const url = String(item.url || item.post_url || item.webVideoUrl || "").toLowerCase();
  if (url.includes("/p/") || url.includes("/reel/") || url.includes("/tv/")) return true;
  if (item.shortCode) return true;

  // TikTok indicators (clockworks/tiktok-scraper)
  if (url.includes("tiktok.com") || item.webVideoUrl || item.diggCount != null || item.playCount != null) return true;
  if (item.authorMeta && typeof item.authorMeta === "object") return true;

  const hasMetrics = item.likesCount != null ||
    item.commentsCount != null ||
    item.videoViewCount != null ||
    item.viewsCount != null ||
    item.diggCount != null ||
    item.playCount != null ||
    item.shareCount != null;
  const hasMedia = Boolean(item.displayUrl || item.videoUrl || item.thumbnailUrl || item.coverUrl || item.dynamicCover);

  return Boolean(hasMetrics || hasMedia);
}

function toIsoDate(value: unknown): string {
  if (!value) return new Date().toISOString();

  if (typeof value === "number" && Number.isFinite(value)) {
    const timestamp = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(timestamp).toISOString();
  }

  const parsed = new Date(String(value));
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return new Date().toISOString();
}

function normalizePostType(
  rawType: string,
  postUrl: string,
  hasChildren: boolean,
  hasVideo: boolean,
): NormalizedPostType {
  const t = rawType.toLowerCase();
  const u = postUrl.toLowerCase();

  if (hasChildren || t.includes("sidecar") || t.includes("carousel")) return "carousel";
  if (t.includes("reel") || u.includes("/reel/")) return "reel";
  if (hasVideo || t.includes("video")) return "video";
  if (t.includes("image") || t.includes("photo")) return "image";
  return "image";
}

function extractMediaUrls(item: any): string[] {
  const urls = new Set<string>();

  const direct = [
    item.videoUrl,
    item.displayUrl,
    item.thumbnailUrl,
    item.thumbnail_url,
    item.image,
    item.media_url,
    item.coverUrl,
    item.dynamicCover,
    item.originCover,
  ];
  for (const url of direct) {
    if (typeof url === "string" && url.trim()) urls.add(url);
  }

  if (Array.isArray(item.images)) {
    item.images.forEach((url: unknown) => {
      if (typeof url === "string" && url.trim()) urls.add(url);
    });
  }

  if (Array.isArray(item.mediaUrls)) {
    item.mediaUrls.forEach((url: unknown) => {
      if (typeof url === "string" && url.trim()) urls.add(url);
    });
  }

  if (Array.isArray(item.childPosts)) {
    item.childPosts.forEach((child: any) => {
      const childCandidates = [child?.videoUrl, child?.displayUrl, child?.imageUrl, child?.url];
      childCandidates.forEach((url) => {
        if (typeof url === "string" && url.trim()) urls.add(url);
      });
    });
  }

  return Array.from(urls);
}

function isTikTokItem(item: any): boolean {
  const url = String(item.url || item.post_url || item.webVideoUrl || "").toLowerCase();
  return url.includes("tiktok.com") || Boolean(item.authorMeta) || item.diggCount != null || item.playCount != null;
}

function mapApifyItemToPost(item: any, platform: Platform, index: number) {
  const isTT = platform === "tiktok" || isTikTokItem(item);

  const caption = String(
    item.caption ||
      item.text ||
      item.description ||
      item.title ||
      "",
  );

  const postUrl = String(
    item.url ||
      item.post_url ||
      item.webVideoUrl ||
      "",
  );

  const mediaUrls = extractMediaUrls(item);
  const thumbnail = String(
    item.displayUrl ||
      item.thumbnailUrl ||
      item.thumbnail_url ||
      item.coverUrl ||
      item.dynamicCover ||
      mediaUrls[0] ||
      "",
  );

  // Carousel detection: check childPosts, items, children arrays
  const hasChildren =
    (Array.isArray(item.childPosts) && item.childPosts.length > 0) ||
    (Array.isArray(item.items) && item.items.length > 1) ||
    (Array.isArray(item.children) && item.children.length > 1);
  const hasVideo = Boolean(item.videoUrl || item.webVideoUrl || item.isVideo);
  const rawType = String(item.type || item.mediaType || item.__typename || platform);
  const normalizedType = normalizePostType(rawType, postUrl, hasChildren, hasVideo);

  // TikTok: prioritize diggCount for likes, playCount for views
  const likes = isTT
    ? safeNumber(item.diggCount ?? item.likesCount ?? item.likes ?? item.likeCount)
    : safeNumber(item.likesCount ?? item.diggCount ?? item.likes ?? item.likeCount);
  const comments = safeNumber(
    item.commentsCount ??
      item.commentCount ??
      item.comments,
  );
  const shares = safeNumber(
    item.shareCount ??
      item.sharesCount ??
      item.shares,
  );
  const views = isTT
    ? safeNumber(item.playCount ?? item.videoPlayCount ?? item.videoViewCount ?? item.viewsCount ?? item.views)
    : safeNumber(item.videoViewCount ?? item.videoPlayCount ?? item.playCount ?? item.viewsCount ?? item.viewCount ?? item.views);

  const interactions = likes + comments + shares;
  // Engagement: only calculate when we have a meaningful base (views > 0)
  const engagementRate = views > 0
    ? Number(((interactions / views) * 100).toFixed(2))
    : 0;

  const hashtags = Array.isArray(item.hashtags)
    ? item.hashtags.map((v: unknown) => {
        if (typeof v === "object" && v !== null && "name" in (v as any)) return String((v as any).name).replace(/^#/, "");
        return String(v).replace(/^#/, "");
      }).filter(Boolean)
    : parseTags(caption);
  const mentions = Array.isArray(item.mentions)
    ? item.mentions.map((v: unknown) => {
        if (typeof v === "object" && v !== null && "name" in (v as any)) return String((v as any).name).replace(/^@/, "");
        return String(v).replace(/^@/, "");
      }).filter(Boolean)
    : parseMentions(caption);

  const videoUrl = String(item.videoUrl || item.webVideoUrl || "") || undefined;

  return {
    id: String(item.id || item.shortCode || `${platform}_${Date.now()}_${index}`),
    post_url: postUrl,
    type: normalizedType,
    thumbnail_url: thumbnail,
    media_url: mediaUrls[0] || undefined,
    media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
    video_url: videoUrl,
    caption,
    published_at: toIsoDate(
      item.timestamp ||
        item.published_at ||
        item.createTimeISO ||
        item.takenAtTimestamp ||
        item.date,
    ),
    metrics: {
      likes,
      comments,
      shares,
      views,
      engagement_rate: engagementRate,
    },
    hashtags,
    mentions,
  };
}

function matchesRequestedPostType(postType: NormalizedPostType, requested: PostType): boolean {
  if (requested === "all") return true;
  if (requested === "reels") return postType === "reel";
  if (requested === "carousel") return postType === "carousel";
  if (requested === "image") return postType === "image";
  if (requested === "video") return postType === "video";
  return true;
}

function cleanUsername(value: string): string {
  return String(value || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "")
    .replace(/\/+$/, "")
    .split("/")[0];
}

function extractProfileMetadata(params: {
  items: any[];
  platform: Platform;
  requestedUsername?: string;
}) {
  if (params.items.length === 0) return undefined;

  const first = params.items[0] || {};

  // TikTok: extract from authorMeta
  if (params.platform === "tiktok") {
    const author = first.authorMeta;
    if (!author || typeof author !== "object") {
      // Fallback: return minimal metadata with requested username
      if (params.requestedUsername) {
        return {
          platform: "tiktok",
          username: String(params.requestedUsername).replace(/^@/, "") || "perfil",
          profile_picture: "",
          followers: 0,
          following: 0,
          total_posts: 0,
          scraped_at: new Date().toISOString(),
        };
      }
      return undefined;
    }

    return {
      platform: "tiktok",
      username: author.name || author.nickName || String(params.requestedUsername || "").replace(/^@/, "") || "perfil",
      profile_picture: String(author.avatar || ""),
      bio: String(author.signature || author.bio || author.description || "") || undefined,
      followers: safeNumber(author.fans),
      following: safeNumber(author.following),
      total_posts: safeNumber(author.video),
      scraped_at: new Date().toISOString(),
    };
  }

  // YouTube: not handled here (uses Data API v3 directly)
  if (params.platform === "youtube") return undefined;

  // Instagram
  const parent = (first && typeof first.parentData === "object" && first.parentData) || first;

  const username = cleanUsername(
    params.requestedUsername ||
      parent.username ||
      parent.ownerUsername ||
      first.ownerUsername ||
      "",
  );

  const followers = safeNumber(
    parent.followersCount ??
      parent.followedByCount ??
      parent.ownerFollowersCount ??
      parent.edgeFollowedBy?.count,
  );
  const following = safeNumber(
    parent.followsCount ??
      parent.followingCount ??
      parent.ownerFollowingCount ??
      parent.edgeFollow?.count,
  );
  const totalPosts = safeNumber(
    parent.postsCount ??
      parent.ownerPostsCount ??
      parent.posts ??
      parent.edgeOwnerToTimelineMedia?.count,
  );

  const profilePicture = String(
    parent.profilePicUrlHD ||
      parent.profilePicUrl ||
      parent.ownerProfilePicUrl ||
      first.ownerProfilePicUrl ||
      "",
  );

  const bio = String(
    parent.biography ||
      parent.bio ||
      parent.description ||
      first.biography ||
      first.bio ||
      "",
  ) || undefined;

  const hasMeaningfulProfileData = Boolean(profilePicture) || followers > 0 || totalPosts > 0;
  if (!hasMeaningfulProfileData) return undefined;

  return {
    platform: "instagram",
    username: username || "perfil",
    profile_picture: profilePicture,
    bio,
    followers,
    following,
    total_posts: totalPosts,
    scraped_at: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user, tenantId } = await resolveTenantForRequest({
      req,
      body,
      allowImplicitDefault: true,
    });

    const runtimeSecrets = await resolveRuntimeSecrets(["APIFY_API_TOKEN"]);
    const apifyToken = runtimeSecrets.APIFY_API_TOKEN || null;
    if (!apifyToken) {
      throw new Error("APIFY_API_TOKEN not configured");
    }
    const runId = String(body?.runId || "").trim();
    const requestId = String(body?.request_id || body?.requestId || crypto.randomUUID());
    const platform = String(body?.platform || "instagram") as Platform;
    const postType = String(body?.post_type || "all") as PostType;
    const requestedLimit = Math.min(100, Math.max(1, Number(body?.results_limit || 20)));
    const periodDays = Math.max(0, Number(body?.period_days || 0));
    const waitForFinish = Math.min(120, Math.max(1, Number(body?.waitForFinish || 60)));
    const requestedUsername = String(body?.username || "");

    if (!runId) {
      throw new Error("runId is required");
    }
    if (!["instagram", "tiktok", "youtube"].includes(platform)) {
      throw new Error("Invalid platform");
    }
    if (!["all", "carousel", "reels", "image", "video"].includes(postType)) {
      throw new Error("Invalid post_type");
    }

    const runResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?token=${encodeURIComponent(apifyToken)}&waitForFinish=${waitForFinish}`,
    );

    if (!runResponse.ok) {
      const errText = await runResponse.text();
      throw new Error(`Apify run status failed (${runResponse.status}): ${errText}`);
    }

    const runData = await runResponse.json();
    const status = String(runData?.data?.status || "").toUpperCase();
    const datasetId = String(runData?.data?.defaultDatasetId || "");

    if (status === "RUNNING" || status === "READY") {
      return new Response(
        JSON.stringify({
          success: true,
          request_id: requestId,
          status: "running",
          runId,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (status !== "SUCCEEDED") {
      return new Response(
        JSON.stringify({
          success: false,
          request_id: requestId,
          status: "failed",
          error: `Apify run finished with status: ${status}`,
          runId,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!datasetId) {
      throw new Error("Apify run succeeded but did not return dataset id");
    }

    const itemsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(apifyToken)}&format=json&clean=1`,
    );

    if (!itemsResponse.ok) {
      const errText = await itemsResponse.text();
      throw new Error(`Apify dataset fetch failed (${itemsResponse.status}): ${errText}`);
    }

    const rawItems = await itemsResponse.json();
    const items = Array.isArray(rawItems) ? rawItems : [];

    const candidateItems = items.filter((item) => isLikelyApifyPostItem(item));
    const mappedPosts = candidateItems.map((item, idx) => mapApifyItemToPost(item, platform, idx));

    // Apply post-type filter
    const typeFiltered = mappedPosts.filter((post) => matchesRequestedPostType(post.type, postType));

    // Apply date filter with automatic fallback: if the window would return 0 posts,
    // return all posts instead (handles infrequent posters / wide period_days selections).
    let dateFiltered = typeFiltered;
    if (periodDays > 0) {
      const cutoff = new Date(Date.now() - periodDays * 86_400_000).toISOString();
      const withinPeriod = typeFiltered.filter((post) => post.published_at >= cutoff);
      dateFiltered = withinPeriod.length > 0 ? withinPeriod : typeFiltered;
    }

    const filteredPosts = dateFiltered.slice(0, requestedLimit);

    const dedupedPosts = Array.from(
      new Map(
        filteredPosts.map((post) => [post.post_url || post.id, post]),
      ).values(),
    );

    const metadata = extractProfileMetadata({
      items,
      platform,
      requestedUsername,
    });

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestId,
        status: "succeeded",
        tenantId,
        userId: user.id,
        metadata,
        posts: dedupedPosts,
        pagination: {
          total: dedupedPosts.length,
          returned: dedupedPosts.length,
          has_more: false,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to check Apify run",
      }),
      {
        status: error instanceof HttpError
          ? error.status
          : (typeof error?.status === "number" ? error.status : 500),
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
