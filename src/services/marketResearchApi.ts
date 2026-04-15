import { SearchRequest, SearchResponse, Post } from '@/types/marketResearch';
import { supabase } from '@/integrations/supabase/client';

const MAX_POLL_MS = 300_000; // 5 minutes (Apify actors can take time)
const POLL_INTERVAL_MS = 5_000; // 5s between polls (avoids race with waitForFinish)

const DIRECT_APIFY_TOKEN = String(import.meta.env.VITE_APIFY_API_TOKEN || '').trim();
const DIRECT_INSTAGRAM_ACTOR = String(
  import.meta.env.VITE_APIFY_ACTOR_ID_INSTAGRAM || 'apify/instagram-scraper',
).trim();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function looksLikeDnsOrEdgeNetworkError(message: string): boolean {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('err_name_not_resolved') ||
    text.includes('failed to send a request to the edge function') ||
    text.includes('failed to fetch') ||
    text.includes('networkerror') ||
    text.includes('fetch failed')
  );
}

function shouldFallbackToDirectApify(
  request: SearchRequest,
  errorMessage: string,
): boolean {
  return (
    request.platform === 'instagram' &&
    Boolean(DIRECT_APIFY_TOKEN) &&
    looksLikeDnsOrEdgeNetworkError(errorMessage)
  );
}

function buildDateISO(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.max(1, days || 30));
  return date.toISOString().split('T')[0];
}

function cleanUsername(value: string): string {
  return String(value || '')
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, '')
    .replace(/\/+$/, '')
    .split('/')[0];
}

function toInstagramProfileUrl(value: string): string {
  const user = cleanUsername(value);
  if (!user) throw new Error('Informe um usuario para pesquisar perfil');
  return `https://www.instagram.com/${user}/`;
}

function toHashtagKeyword(value: string): string {
  const keyword = String(value || '').trim().replace(/^#/, '');
  if (!keyword) throw new Error('Informe uma palavra-chave para pesquisa');
  return keyword;
}

function mapResultsType(postType: SearchRequest['post_type']): 'posts' | 'reels' {
  return postType === 'reels' ? 'reels' : 'posts';
}

function buildInstagramInput(request: SearchRequest) {
  const limit = Math.min(20, Math.max(1, Number(request.results_limit || 20)));
  const onlyPostsNewerThan = buildDateISO(Number(request.period_days || 30));
  const resultsType = mapResultsType(request.post_type);

  if (request.search_type === 'profile') {
    return {
      addParentData: true,
      directUrls: [toInstagramProfileUrl(String(request.username || ''))],
      onlyPostsNewerThan,
      resultsLimit: limit,
      resultsType,
    };
  }

  return {
    addParentData: true,
    search: toHashtagKeyword(String(request.keyword || '')),
    searchType: 'hashtag',
    searchLimit: 1,
    onlyPostsNewerThan,
    resultsLimit: limit,
    resultsType,
  };
}

function safeNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseTags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_-]+/gu) || [];
  return Array.from(new Set(matches.map((v) => v.replace(/^#/, ''))));
}

function parseMentions(text: string): string[] {
  const matches = text.match(/@[\p{L}\p{N}._-]+/gu) || [];
  return Array.from(new Set(matches.map((v) => v.replace(/^@/, ''))));
}

function isLikelyApifyPostItem(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  if (String(item.error || '').toLowerCase() === 'no_items') return false;

  const url = String(item.url || item.post_url || item.webVideoUrl || '').toLowerCase();
  if (url.includes('/p/') || url.includes('/reel/') || url.includes('/tv/')) return true;
  if (item.shortCode) return true;

  // TikTok indicators
  if (url.includes('tiktok.com') || item.webVideoUrl || item.diggCount != null || item.playCount != null) return true;
  if (item.authorMeta && typeof item.authorMeta === 'object') return true;

  const hasMetrics =
    item.likesCount != null ||
    item.commentsCount != null ||
    item.videoViewCount != null ||
    item.viewsCount != null ||
    item.diggCount != null ||
    item.playCount != null;
  const hasMedia = Boolean(item.displayUrl || item.videoUrl || item.thumbnailUrl || item.coverUrl || item.dynamicCover);

  return Boolean(hasMetrics || hasMedia);
}

function normalizePostType(
  rawType: string,
  postUrl: string,
  hasChildren: boolean,
  hasVideo: boolean,
): Post['type'] {
  const t = rawType.toLowerCase();
  const u = postUrl.toLowerCase();
  if (hasChildren || t.includes('sidecar') || t.includes('carousel')) return 'carousel';
  if (t.includes('reel') || u.includes('/reel/')) return 'reel';
  if (hasVideo || t.includes('video')) return 'video';
  return 'image';
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
  direct.forEach((url) => {
    if (typeof url === 'string' && url.trim()) urls.add(url);
  });

  if (Array.isArray(item.images)) {
    item.images.forEach((url: unknown) => {
      if (typeof url === 'string' && url.trim()) urls.add(url);
    });
  }
  if (Array.isArray(item.mediaUrls)) {
    item.mediaUrls.forEach((url: unknown) => {
      if (typeof url === 'string' && url.trim()) urls.add(url);
    });
  }
  if (Array.isArray(item.childPosts)) {
    item.childPosts.forEach((child: any) => {
      [child?.videoUrl, child?.displayUrl, child?.imageUrl, child?.url].forEach((url) => {
        if (typeof url === 'string' && url.trim()) urls.add(url);
      });
    });
  }

  return Array.from(urls);
}

function toIsoDate(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ts = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(ts).toISOString();
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function detectPlatformFromItem(item: any): 'instagram' | 'tiktok' {
  const url = String(item.url || item.post_url || item.webVideoUrl || '').toLowerCase();
  if (url.includes('tiktok.com') || item.authorMeta || item.diggCount != null || item.playCount != null) return 'tiktok';
  return 'instagram';
}

function mapApifyItemToPost(item: any, index: number): Post {
  const platform = detectPlatformFromItem(item);
  const isTikTok = platform === 'tiktok';

  const caption = String(item.caption || item.text || item.description || item.title || '');
  const postUrl = String(item.url || item.post_url || item.webVideoUrl || '');
  const mediaUrls = extractMediaUrls(item);

  // Carousel detection: check childPosts, items, children arrays
  const hasChildren =
    (Array.isArray(item.childPosts) && item.childPosts.length > 0) ||
    (Array.isArray(item.items) && item.items.length > 1) ||
    (Array.isArray(item.children) && item.children.length > 1);
  const hasVideo = Boolean(item.videoUrl || item.webVideoUrl || item.isVideo);
  const normalizedType = normalizePostType(
    String(item.type || item.mediaType || item.__typename || ''),
    postUrl,
    hasChildren,
    hasVideo,
  );

  // TikTok uses diggCount for likes, playCount for views
  const likes = isTikTok
    ? safeNumber(item.diggCount ?? item.likesCount ?? item.likes ?? item.likeCount)
    : safeNumber(item.likesCount ?? item.likes ?? item.likeCount);
  const comments = safeNumber(item.commentsCount ?? item.commentCount ?? item.comments);
  const shares = safeNumber(item.shareCount ?? item.sharesCount ?? item.shares);
  const views = isTikTok
    ? safeNumber(item.playCount ?? item.videoPlayCount ?? item.videoViewCount ?? item.viewsCount ?? item.views)
    : safeNumber(item.videoViewCount ?? item.videoPlayCount ?? item.viewsCount ?? item.viewCount ?? item.views);

  const interactions = likes + comments + shares;

  // Engagement rate: for posts without views (Instagram images), use followers if available, otherwise interactions
  let engagementBase: number;
  if (views > 0) {
    engagementBase = views;
  } else if (interactions > 0) {
    // For images: engagement = interactions / interactions = 100% is misleading
    // Better to show raw interactions and set rate to 0 when we can't calculate properly
    engagementBase = 0;
  } else {
    engagementBase = 0;
  }
  const engagementRate = engagementBase > 0
    ? Number(((interactions / engagementBase) * 100).toFixed(2))
    : 0;

  const thumbnail = String(
    item.displayUrl ||
      item.thumbnailUrl ||
      item.thumbnail_url ||
      item.coverUrl ||
      item.dynamicCover ||
      mediaUrls[0] ||
      '',
  );

  // Handle hashtags as objects or strings
  const hashtags = Array.isArray(item.hashtags)
    ? item.hashtags.map((v: unknown) => {
        if (typeof v === 'object' && v !== null && 'name' in (v as any)) return String((v as any).name).replace(/^#/, '');
        return String(v).replace(/^#/, '');
      }).filter(Boolean)
    : parseTags(caption);
  const mentions = Array.isArray(item.mentions)
    ? item.mentions.map((v: unknown) => {
        if (typeof v === 'object' && v !== null && 'name' in (v as any)) return String((v as any).name).replace(/^@/, '');
        return String(v).replace(/^@/, '');
      }).filter(Boolean)
    : parseMentions(caption);

  return {
    id: String(item.id || item.shortCode || `${platform}_${Date.now()}_${index}`),
    post_url: postUrl,
    type: normalizedType,
    thumbnail_url: thumbnail,
    media_url: mediaUrls[0] || undefined,
    media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
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

function matchesPostType(postType: Post['type'], requested: SearchRequest['post_type']): boolean {
  if (requested === 'all') return true;
  if (requested === 'reels') return postType === 'reel';
  if (requested === 'carousel') return postType === 'carousel';
  if (requested === 'image') return postType === 'image';
  if (requested === 'video') return postType === 'video';
  return true;
}

function extractMetadata(items: any[], request: SearchRequest): SearchResponse['metadata'] {
  if (!items.length) return undefined;
  const first = items[0] || {};

  // TikTok: extract from authorMeta
  if (request.platform === 'tiktok') {
    const author = first.authorMeta;
    if (!author || typeof author !== 'object') {
      // Fallback: return minimal metadata with username
      if (request.username) {
        return {
          platform: 'tiktok',
          username: request.username.replace(/^@/, ''),
          profile_picture: '',
          followers: 0,
          following: 0,
          total_posts: 0,
          scraped_at: new Date().toISOString(),
        };
      }
      return undefined;
    }
    return {
      platform: 'tiktok',
      username: author.name || author.nickName || (request.username || '').replace(/^@/, '') || 'perfil',
      profile_picture: String(author.avatar || ''),
      followers: safeNumber(author.fans),
      following: safeNumber(author.following),
      total_posts: safeNumber(author.video),
      scraped_at: new Date().toISOString(),
    };
  }

  // Instagram
  const parent = (first && typeof first.parentData === 'object' && first.parentData) || first;
  const username = cleanUsername(
    String(request.username || parent.username || parent.ownerUsername || first.ownerUsername || ''),
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
  const profilePic = String(
    parent.profilePicUrlHD ||
      parent.profilePicUrl ||
      parent.ownerProfilePicUrl ||
      first.ownerProfilePicUrl ||
      '',
  );

  const hasMeaningfulProfileData = Boolean(profilePic) || followers > 0 || totalPosts > 0;
  if (!hasMeaningfulProfileData) return undefined;

  return {
    platform: 'instagram',
    username: username || 'perfil',
    profile_picture: profilePic,
    followers,
    following,
    total_posts: totalPosts,
    scraped_at: new Date().toISOString(),
  };
}

async function runDirectInstagramApify(request: SearchRequest): Promise<SearchResponse> {
  if (!DIRECT_APIFY_TOKEN) {
    return {
      success: false,
      request_id: request.request_id,
      posts: [],
      error: {
        code: 'APIFY_TOKEN_MISSING',
        message: 'VITE_APIFY_API_TOKEN nao configurado no .env local',
      },
    };
  }

  const startResponse = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(DIRECT_INSTAGRAM_ACTOR)}/runs?token=${encodeURIComponent(DIRECT_APIFY_TOKEN)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildInstagramInput(request)),
    },
  );

  if (!startResponse.ok) {
    const errText = await startResponse.text();
    return {
      success: false,
      request_id: request.request_id,
      posts: [],
      error: {
        code: 'APIFY_DIRECT_START_FAILED',
        message: `Falha ao iniciar actor Instagram (${startResponse.status})`,
        details: errText,
      },
    };
  }

  const startData = await startResponse.json();
  const runId = String(startData?.data?.id || '');
  if (!runId) {
    return {
      success: false,
      request_id: request.request_id,
      posts: [],
      error: {
        code: 'APIFY_DIRECT_RUNID_MISSING',
        message: 'Apify nao retornou runId',
        details: startData,
      },
    };
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < MAX_POLL_MS) {
    // Use waitForFinish so Apify holds the connection — no need for tight polling
    const runResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?token=${encodeURIComponent(DIRECT_APIFY_TOKEN)}&waitForFinish=30`,
    );

    if (!runResponse.ok) {
      const errText = await runResponse.text();
      return {
        success: false,
        request_id: request.request_id,
        posts: [],
        error: {
          code: 'APIFY_DIRECT_STATUS_FAILED',
          message: `Falha ao consultar run (${runResponse.status})`,
          details: errText,
        },
      };
    }

    const runData = await runResponse.json();
    const status = String(runData?.data?.status || '').toUpperCase();
    if (status === 'RUNNING' || status === 'READY') {
      // Small delay before next long-poll to avoid overlap
      await delay(POLL_INTERVAL_MS);
      continue;
    }

    if (status !== 'SUCCEEDED') {
      return {
        success: false,
        request_id: request.request_id,
        posts: [],
        error: {
          code: 'APIFY_DIRECT_RUN_FAILED',
          message: `Run finalizou com status ${status}`,
          details: runData,
        },
      };
    }

    const datasetId = String(runData?.data?.defaultDatasetId || '');
    if (!datasetId) {
      return {
        success: false,
        request_id: request.request_id,
        posts: [],
        error: {
          code: 'APIFY_DIRECT_DATASET_MISSING',
          message: 'Run finalizou sem dataset',
          details: runData,
        },
      };
    }

    const itemsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(DIRECT_APIFY_TOKEN)}&format=json&clean=1`,
    );

    if (!itemsResponse.ok) {
      const errText = await itemsResponse.text();
      return {
        success: false,
        request_id: request.request_id,
        posts: [],
        error: {
          code: 'APIFY_DIRECT_ITEMS_FAILED',
          message: `Falha ao obter itens (${itemsResponse.status})`,
          details: errText,
        },
      };
    }

    const rawItems = await itemsResponse.json();
    const items = Array.isArray(rawItems) ? rawItems : [];
    const limit = Math.min(20, Math.max(1, Number(request.results_limit || 20)));
    const candidateItems = items.filter((item) => isLikelyApifyPostItem(item));
    const posts = Array.from(
      new Map(
        candidateItems
          .map((item, index) => mapApifyItemToPost(item, index))
          .filter((post) => matchesPostType(post.type, request.post_type))
          .slice(0, limit)
          .map((post) => [post.post_url || post.id, post]),
      ).values(),
    );

    return {
      success: true,
      request_id: request.request_id,
      metadata: extractMetadata(items, request),
      posts,
      pagination: {
        total: posts.length,
        returned: posts.length,
        has_more: false,
      },
    };
  }

  return {
    success: false,
    request_id: request.request_id,
    posts: [],
    error: {
      code: 'APIFY_DIRECT_TIMEOUT',
      message: 'Tempo limite excedido ao aguardar o actor do Instagram',
    },
  };
}

async function pollApifyStatus(payload: {
  runId: string;
  request_id: string;
  search_type: SearchRequest['search_type'];
  platform: SearchRequest['platform'];
  post_type: SearchRequest['post_type'];
  username?: SearchRequest['username'];
  keyword?: SearchRequest['keyword'];
  results_limit?: SearchRequest['results_limit'];
}): Promise<SearchResponse> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < MAX_POLL_MS) {
    let data: any;
    let error: any;
    try {
      const response = await supabase.functions.invoke('market-research-apify-status', {
        body: {
          runId: payload.runId,
          request_id: payload.request_id,
          search_type: payload.search_type,
          platform: payload.platform,
          post_type: payload.post_type,
          username: payload.username,
          keyword: payload.keyword,
          results_limit: payload.results_limit,
          waitForFinish: 30, // reduced from 60 to avoid edge function timeout
        },
      });
      data = response.data;
      error = response.error;
    } catch (invokeError: any) {
      error = { message: invokeError?.message || String(invokeError) };
    }

    if (error) {
      // Network error: retry instead of failing immediately
      if (looksLikeDnsOrEdgeNetworkError(error.message || '')) {
        await delay(POLL_INTERVAL_MS);
        continue;
      }

      return {
        success: false,
        request_id: payload.request_id,
        posts: [],
        error: {
          code: 'APIFY_STATUS_ERROR',
          message: error.message || 'Erro ao consultar status da raspagem',
        },
      };
    }

    if (!data?.success && data?.status === 'failed') {
      return {
        success: false,
        request_id: payload.request_id,
        posts: [],
        error: {
          code: 'APIFY_RUN_FAILED',
          message: data?.error || 'A execucao da raspagem falhou',
          details: data,
        },
      };
    }

    if (data?.status === 'succeeded') {
      return {
        success: true,
        request_id: payload.request_id,
        metadata: data?.metadata,
        posts: data?.posts || [],
        pagination: data?.pagination || {
          total: data?.posts?.length || 0,
          returned: data?.posts?.length || 0,
          has_more: false,
        },
      };
    }

    // Still running — wait before next long-poll
    await delay(POLL_INTERVAL_MS);
  }

  return {
    success: false,
    request_id: payload.request_id,
    posts: [],
    error: {
      code: 'APIFY_TIMEOUT',
      message: 'Tempo limite excedido ao aguardar os resultados da raspagem',
    },
  };
}

export async function searchMarket(request: SearchRequest): Promise<SearchResponse> {
  const forceDirectInDev =
    import.meta.env.DEV &&
    request.platform === 'instagram' &&
    Boolean(DIRECT_APIFY_TOKEN);

  if (forceDirectInDev) {
    return runDirectInstagramApify(request);
  }

  let data: any;
  let error: any;
  try {
    const response = await supabase.functions.invoke('market-research-apify-start', {
      body: request,
    });
    data = response.data;
    error = response.error;
  } catch (invokeError: any) {
    error = { message: invokeError?.message || String(invokeError) };
  }

  if (error) {
    const message = error.message || 'Erro ao iniciar raspagem no Apify';
    if (shouldFallbackToDirectApify(request, message)) {
      return runDirectInstagramApify(request);
    }

    return {
      success: false,
      request_id: request.request_id,
      posts: [],
      error: {
        code: 'APIFY_START_ERROR',
        message,
      },
    };
  }

  // YouTube: results returned directly via YouTube Data API v3 (no polling)
  if (data?.directResults) {
    return {
      success: true,
      request_id: request.request_id,
      metadata: data.metadata,
      posts: data.posts || [],
      pagination: data.pagination || { total: 0, returned: 0, has_more: false },
    };
  }

  if (!data?.success || !data?.runId) {
    return {
      success: false,
      request_id: request.request_id,
      posts: [],
      error: {
        code: 'APIFY_START_INVALID',
        message: data?.error || 'Resposta invalida ao iniciar raspagem no Apify',
        details: data,
      },
    };
  }

  return pollApifyStatus({
    runId: String(data.runId),
    request_id: request.request_id,
    search_type: request.search_type,
    platform: request.platform,
    post_type: request.post_type,
    username: request.username,
    keyword: request.keyword,
    results_limit: request.results_limit,
  });
}

export async function loadMorePosts(_request: SearchRequest): Promise<SearchResponse> {
  return {
    success: true,
    request_id: _request.request_id,
    posts: [],
    pagination: { total: 0, returned: 0, has_more: false },
  };
}
