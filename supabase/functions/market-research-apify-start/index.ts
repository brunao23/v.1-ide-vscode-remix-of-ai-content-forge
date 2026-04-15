import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { resolveRuntimeSecrets } from "../_shared/runtime-secrets.ts";
import { HttpError, resolveTenantForRequest } from "../_shared/auth-tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Platform = "instagram" | "tiktok" | "youtube";
type SearchType = "profile" | "keyword";
type PostType = "all" | "carousel" | "reels" | "image" | "video";

const DEFAULT_INSTAGRAM_ACTOR_ID = "apify/instagram-scraper";
const DEFAULT_TIKTOK_ACTOR_ID = "clockworks/tiktok-scraper";

function getActorIdByPlatform(
  platform: Platform,
  runtimeSecrets: Record<string, string>,
): string | null {
  if (platform === "instagram") {
    return runtimeSecrets.APIFY_ACTOR_ID_INSTAGRAM || DEFAULT_INSTAGRAM_ACTOR_ID;
  }
  if (platform === "tiktok") {
    return runtimeSecrets.APIFY_ACTOR_ID_TIKTOK || DEFAULT_TIKTOK_ACTOR_ID;
  }
  if (platform === "youtube") return null; // YouTube uses Data API v3 directly
  return null;
}

function buildDateISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(1, days || 30));
  return d.toISOString().split("T")[0];
}

function cleanUsername(value: string): string {
  return String(value || "").trim().replace(/^@/, "");
}

function isInstagramUrl(value: string): boolean {
  return /(?:https?:\/\/)?(?:www\.)?instagram\.com\//i.test(value);
}

function toInstagramProfileUrl(raw: string): string {
  const cleaned = cleanUsername(raw);
  if (!cleaned) {
    throw new Error("username is required for profile search");
  }

  if (isInstagramUrl(cleaned)) {
    return cleaned.endsWith("/") ? cleaned : `${cleaned}/`;
  }

  return `https://www.instagram.com/${cleaned}/`;
}

function toInstagramKeyword(raw: string): string {
  const keyword = String(raw || "").trim().replace(/^#/, "");
  if (!keyword) {
    throw new Error("keyword is required for keyword search");
  }
  return keyword;
}

function mapPostTypeToResultsType(postType: PostType): "posts" | "reels" {
  return postType === "reels" ? "reels" : "posts";
}

function buildInstagramInput(params: {
  searchType: SearchType;
  username?: string;
  keyword?: string;
  postType?: PostType;
  periodDays?: number;
  resultsLimit?: number;
}) {
  // Request extra results so that client-side date filtering still leaves enough posts.
  // Avoid onlyPostsNewerThan here: infrequent posters return 0 results when the date
  // window is too narrow. Date filtering is applied after fetching in the status function.
  const limit = Math.min(50, Math.max(5, Number(params.resultsLimit || 20) * 2));
  const postType = (params.postType || "all") as PostType;
  const resultsType = mapPostTypeToResultsType(postType);

  if (params.searchType === "profile") {
    const profileUrl = toInstagramProfileUrl(String(params.username || ""));

    return {
      addParentData: true,
      directUrls: [profileUrl],
      resultsLimit: limit,
      resultsType,
    };
  }

  const cleanKeyword = toInstagramKeyword(String(params.keyword || ""));
  return {
    addParentData: true,
    search: cleanKeyword,
    searchType: "hashtag",
    searchLimit: 5,
    resultsLimit: limit,
    resultsType,
  };
}

function buildTikTokInput(params: {
  searchType: SearchType;
  username?: string;
  keyword?: string;
  periodDays?: number;
  resultsLimit?: number;
}) {
  const limit = Math.min(100, Math.max(1, Number(params.resultsLimit || 20)));
  const oldestDate = buildDateISO(params.periodDays || 30);

  const common = {
    resultsPerPage: limit,
    excludePinnedPosts: false,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSlideshowImages: false,
    shouldDownloadAvatars: false,
    shouldDownloadMusicCovers: false,
    downloadSubtitlesOptions: "NEVER_DOWNLOAD_SUBTITLES",
    commentsPerPost: 0,
    topLevelCommentsPerPost: 0,
    maxRepliesPerComment: 0,
    scrapeRelatedVideos: false,
    proxyCountryCode: "None",
    oldestPostDateUnified: oldestDate,
  };

  if (params.searchType === "profile") {
    const username = cleanUsername(String(params.username || ""));
    if (!username) throw new Error("username is required for TikTok profile search");
    return {
      ...common,
      profiles: [username],
      profileScrapeSections: ["videos"],
      profileSorting: "latest",
    };
  }

  const keyword = String(params.keyword || "").trim().replace(/^#/, "");
  if (!keyword) throw new Error("keyword is required for TikTok keyword search");

  const isSimpleHashtag = /^[\p{L}\p{N}_]+$/u.test(keyword);
  if (isSimpleHashtag) {
    return { ...common, hashtags: [keyword] };
  }

  return {
    ...common,
    searchQueries: [keyword],
    searchSection: "",
    maxProfilesPerQuery: 10,
    searchSorting: "0",
    searchDatePosted: "0",
  };
}

function parseIsoDuration(iso: string): number {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

async function ytApiFetch(url: string): Promise<any> {
  const res = await fetch(url);
  const body = await res.json();

  // YouTube API returns errors inside the response body
  if (body?.error) {
    const ytErr = body.error;
    const code = ytErr.code || res.status;
    const msg = ytErr.message || "YouTube API error";
    const reason = ytErr.errors?.[0]?.reason || "";
    console.error(`[YouTube API Error] ${code}: ${msg} (reason: ${reason})`);
    throw new Error(`YouTube API ${code}: ${msg}`);
  }

  if (!res.ok) {
    console.error(`[YouTube API HTTP Error] ${res.status}: ${res.statusText}`);
    throw new Error(`YouTube API HTTP ${res.status}: ${res.statusText}`);
  }

  return body;
}

async function handleYouTubeDirect(params: {
  searchType: SearchType;
  username: string;
  keyword: string;
  resultsLimit: number;
  periodDays: number;
  apiKey: string;
}): Promise<{ metadata?: Record<string, unknown>; posts: Record<string, unknown>[]; pagination: Record<string, unknown> }> {
  // Request extra results so that Shorts filtering still leaves enough posts
  const limit = Math.min(50, Math.max(1, params.resultsLimit));
  const fetchLimit = Math.min(50, limit + 15);
  const apiKey = params.apiKey;
  const publishedAfter = new Date(Date.now() - (params.periodDays || 30) * 86_400_000).toISOString();

  let videoIds: string[] = [];
  let channelMeta: Record<string, unknown> | undefined;

  if (params.searchType === "profile") {
    const handle = params.username.replace(/^@/, "").trim();
    if (!handle) throw new Error("username is required for YouTube profile search");

    console.log(`[YouTube] Resolving channel for handle: "${handle}"`);

    // Strategy 1: Try forHandle (requires @prefix)
    let channelId = "";
    let channel: any = null;

    try {
      const byHandleData = await ytApiFetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${encodeURIComponent("@" + handle)}&key=${apiKey}`,
      );
      channel = byHandleData?.items?.[0];
      console.log(`[YouTube] forHandle result: ${channel ? "found" : "not found"} (items: ${byHandleData?.items?.length || 0})`);
    } catch (err: any) {
      console.error(`[YouTube] forHandle failed: ${err.message}`);
    }

    // Strategy 2: Try forUsername (legacy usernames)
    if (!channel) {
      try {
        const byUsernameData = await ytApiFetch(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forUsername=${encodeURIComponent(handle)}&key=${apiKey}`,
        );
        channel = byUsernameData?.items?.[0];
        console.log(`[YouTube] forUsername result: ${channel ? "found" : "not found"}`);
      } catch (err: any) {
        console.error(`[YouTube] forUsername failed: ${err.message}`);
      }
    }

    // Strategy 3: Search for channel by name
    if (!channel) {
      try {
        const chSearchData = await ytApiFetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(handle)}&type=channel&maxResults=1&key=${apiKey}`,
        );
        channelId = chSearchData?.items?.[0]?.id?.channelId || "";
        console.log(`[YouTube] channel search result: channelId=${channelId || "none"}`);

        if (channelId) {
          const chDetailData = await ytApiFetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`,
          );
          channel = chDetailData?.items?.[0];
        }
      } catch (err: any) {
        console.error(`[YouTube] channel search failed: ${err.message}`);
      }
    }

    if (channel) {
      channelId = channel.id;
      console.log(`[YouTube] Resolved channel: ${channelId} (${channel.snippet?.title})`);

      channelMeta = {
        platform: "youtube",
        username: channel.snippet?.customUrl || channel.snippet?.title || handle,
        profile_picture: channel.snippet?.thumbnails?.high?.url || "",
        followers: Number(channel.statistics?.subscriberCount || 0),
        following: 0,
        total_posts: Number(channel.statistics?.videoCount || 0),
        scraped_at: new Date().toISOString(),
      };

      // First try with publishedAfter filter (exclude Shorts via videoDuration=medium/long is not precise,
      // so we fetch extra and filter by duration after getting details)
      const videosData = await ytApiFetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&maxResults=${fetchLimit}&order=date&publishedAfter=${publishedAfter}&key=${apiKey}`,
      );
      videoIds = (videosData?.items || []).map((v: any) => v.id?.videoId).filter(Boolean);
      console.log(`[YouTube] Videos with date filter: ${videoIds.length}`);

      // If no results with date filter, retry without it (get latest videos regardless)
      if (videoIds.length === 0) {
        console.log(`[YouTube] No videos in last ${params.periodDays} days, fetching latest without date filter`);
        const fallbackData = await ytApiFetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&maxResults=${fetchLimit}&order=date&key=${apiKey}`,
        );
        videoIds = (fallbackData?.items || []).map((v: any) => v.id?.videoId).filter(Boolean);
        console.log(`[YouTube] Videos without date filter: ${videoIds.length}`);
      }
    } else {
      console.error(`[YouTube] Could not resolve channel for handle: "${handle}"`);
    }
  } else {
    const query = params.keyword.trim();
    if (!query) throw new Error("keyword is required for YouTube search");

    console.log(`[YouTube] Keyword search: "${query}"`);

    const searchData = await ytApiFetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${fetchLimit}&order=relevance&publishedAfter=${publishedAfter}&key=${apiKey}`,
    );
    videoIds = (searchData?.items || []).map((v: any) => v.id?.videoId).filter(Boolean);
    console.log(`[YouTube] Keyword search results: ${videoIds.length}`);

    // If no results with date filter, retry without it
    if (videoIds.length === 0) {
      console.log(`[YouTube] No results with date filter, retrying without`);
      const fallbackData = await ytApiFetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${fetchLimit}&order=relevance&key=${apiKey}`,
      );
      videoIds = (fallbackData?.items || []).map((v: any) => v.id?.videoId).filter(Boolean);
      console.log(`[YouTube] Keyword search (no date filter): ${videoIds.length}`);
    }
  }

  if (videoIds.length === 0) {
    console.log(`[YouTube] No video IDs found, returning empty`);
    return { metadata: channelMeta, posts: [], pagination: { total: 0, returned: 0, has_more: false } };
  }

  // Batch get video details + statistics (max 50 per call)
  const detailsData = await ytApiFetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}&key=${apiKey}`,
  );
  const videos = detailsData?.items || [];
  console.log(`[YouTube] Video details fetched: ${videos.length}`);

  // Filter out Shorts: videos <= 60 seconds are YouTube Shorts
  const regularVideos = videos.filter((video: any) => {
    const duration = parseIsoDuration(video.contentDetails?.duration || "");
    const isShort = duration <= 60;
    if (isShort) console.log(`[YouTube] Filtered out Short: ${video.id} (${duration}s)`);
    return !isShort;
  });
  console.log(`[YouTube] After Shorts filter: ${regularVideos.length} regular videos`);

  const posts = regularVideos.slice(0, limit).map((video: any, idx: number) => {
    const stats = video.statistics || {};
    const snippet = video.snippet || {};
    const likes = Number(stats.likeCount || 0);
    const comments = Number(stats.commentCount || 0);
    const views = Number(stats.viewCount || 0);
    const interactions = likes + comments;
    const engagementBase = views > 0 ? views : Math.max(interactions, 1);

    return {
      id: video.id || `yt_${Date.now()}_${idx}`,
      post_url: `https://www.youtube.com/watch?v=${video.id}`,
      type: "video",
      thumbnail_url: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || "",
      media_url: `https://www.youtube.com/watch?v=${video.id}`,
      caption: snippet.title || "",
      published_at: snippet.publishedAt || new Date().toISOString(),
      metrics: {
        likes,
        comments,
        shares: 0,
        views,
        engagement_rate: Number(((interactions / engagementBase) * 100).toFixed(2)),
      },
      hashtags: (snippet.tags || []).slice(0, 30),
      mentions: [],
    };
  });

  return {
    metadata: channelMeta,
    posts,
    pagination: { total: posts.length, returned: posts.length, has_more: false },
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

    const runtimeSecrets = await resolveRuntimeSecrets([
      "APIFY_API_TOKEN",
      "APIFY_ACTOR_ID_INSTAGRAM",
      "APIFY_ACTOR_ID_TIKTOK",
      "YOUTUBE_API_KEY",
    ]);
    const platform = String(body?.platform || "").trim() as Platform;
    const searchType = String(body?.search_type || "profile") as SearchType;
    const requestId = String(body?.request_id || crypto.randomUUID());
    const postType = String(body?.post_type || "all") as PostType;
    const username = String(body?.username || "").trim();
    const keyword = String(body?.keyword || "").trim();

    if (!platform || !["instagram", "tiktok", "youtube"].includes(platform)) {
      throw new Error("Invalid platform. Expected instagram, tiktok, or youtube");
    }
    if (!["profile", "keyword"].includes(searchType)) {
      throw new Error("Invalid search_type. Expected profile or keyword");
    }
    if (!["all", "carousel", "reels", "image", "video"].includes(postType)) {
      throw new Error("Invalid post_type");
    }
    if (searchType === "profile" && !username) {
      throw new Error("username is required for profile search");
    }
    if (searchType === "keyword" && !keyword) {
      throw new Error("keyword is required for keyword search");
    }

    const periodDays = Number(body?.period_days || 30);
    const resultsLimit = Number(body?.results_limit || 20);

    // YouTube: use Data API v3 directly (free, instant results)
    if (platform === "youtube") {
      const youtubeApiKey = runtimeSecrets.YOUTUBE_API_KEY || null;
      if (!youtubeApiKey) {
        throw new Error("YOUTUBE_API_KEY not configured. Create one at console.cloud.google.com");
      }

      const ytResult = await handleYouTubeDirect({
        searchType,
        username,
        keyword,
        resultsLimit,
        periodDays,
        apiKey: youtubeApiKey,
      });

      return new Response(
        JSON.stringify({
          success: true,
          request_id: requestId,
          directResults: true,
          tenantId,
          userId: user.id,
          metadata: ytResult.metadata,
          posts: ytResult.posts,
          pagination: ytResult.pagination,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Instagram / TikTok: use Apify actors
    const apifyToken = runtimeSecrets.APIFY_API_TOKEN || null;
    if (!apifyToken) {
      throw new Error("APIFY_API_TOKEN not configured");
    }

    const actorId = getActorIdByPlatform(platform, runtimeSecrets);
    if (!actorId) {
      throw new Error(`APIFY actor not configured for platform: ${platform}`);
    }

    const commonParams = {
      searchType,
      username,
      keyword,
      postType,
      periodDays,
      resultsLimit,
    };

    const actorInput = platform === "instagram"
      ? buildInstagramInput(commonParams)
      : buildTikTokInput(commonParams);

    const apifyResponse = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${encodeURIComponent(apifyToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actorInput),
      },
    );

    if (!apifyResponse.ok) {
      const errText = await apifyResponse.text();
      throw new Error(`Apify start run failed (${apifyResponse.status}): ${errText}`);
    }

    const apifyData = await apifyResponse.json();
    const runId = apifyData?.data?.id;
    const status = apifyData?.data?.status || "READY";
    const datasetId = apifyData?.data?.defaultDatasetId || null;

    if (!runId) {
      throw new Error("Apify did not return runId");
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestId,
        runId,
        status,
        datasetId,
        actorId,
        tenantId,
        userId: user.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to start Apify run",
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
