import { SearchRequest, SearchResponse } from '@/types/marketResearch';

const WEBHOOK_URL = 'https://hook.us2.make.com/foo6ybotx2fqfrunlah4lu75y46dvm01';

function buildPeriodFilter(periodDays: number): string {
  if (periodDays <= 7) return '1 week';
  if (periodDays <= 30) return '1 month';
  if (periodDays <= 90) return '3 months';
  if (periodDays <= 180) return '6 months';
  return '1 year';
}

function mapResultsType(postType?: string): string {
  if (!postType || postType === 'all') return 'posts';
  if (postType === 'reels' || postType === 'video') return 'reels';
  return 'posts';
}

function buildDirectUrl(platform: string, username?: string, keyword?: string, searchType?: string): string[] {
  const clean = (username || '').replace(/^@/, '').trim();
  if (searchType === 'profile' && clean) {
    if (platform === 'tiktok') return [`https://www.tiktok.com/@${clean}`];
    return [`https://www.instagram.com/${clean}/`];
  }
  // For keyword search, use explore/tags on Instagram
  const kw = (keyword || '').trim().replace(/^#/, '');
  if (platform === 'tiktok') return [`https://www.tiktok.com/tag/${kw}`];
  return [`https://www.instagram.com/explore/tags/${kw}/`];
}

export async function searchMarket(request: SearchRequest): Promise<SearchResponse> {
  const payload = {
    addParentData: false,
    directUrls: buildDirectUrl(request.platform, request.username, request.keyword, request.search_type),
    onlyPostsNewerThan: buildPeriodFilter(request.period_days || 30),
    resultsLimit: 20,
    resultsType: mapResultsType(request.post_type),
    searchLimit: 1,
    searchType: 'hashtag',
    platform: request.platform,
  };

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return {
      success: false,
      request_id: request.request_id,
      posts: [],
      error: { code: 'WEBHOOK_ERROR', message: `Erro do webhook: ${res.status}` },
    };
  }

  const data = await res.json();

  // Normalize response — the webhook may return an array or an object
  const rawPosts = Array.isArray(data) ? data : data.posts || [];

  const posts = rawPosts.map((item: any, i: number) => ({
    id: item.id || `post_${Date.now()}_${i}`,
    post_url: item.url || item.post_url || '',
    type: item.type || request.post_type || 'image',
    thumbnail_url: item.displayUrl || item.thumbnail_url || item.thumbnailUrl || '',
    media_url: item.videoUrl || item.displayUrl || item.media_url || '',
    caption: item.caption || '',
    published_at: item.timestamp || item.published_at || new Date().toISOString(),
    metrics: {
      likes: item.likesCount ?? item.likes ?? 0,
      comments: item.commentsCount ?? item.comments ?? 0,
      shares: item.sharesCount ?? item.shares ?? 0,
      views: item.videoViewCount ?? item.viewsCount ?? item.views ?? 0,
      engagement_rate: item.engagement_rate ?? 0,
    },
    hashtags: item.hashtags || [],
    mentions: item.mentions || [],
  }));

  return {
    success: true,
    request_id: request.request_id,
    posts,
    pagination: {
      total: posts.length,
      returned: posts.length,
      has_more: false,
    },
  };
}

export async function loadMorePosts(request: SearchRequest): Promise<SearchResponse> {
  // Load more not supported with this webhook
  return {
    success: true,
    request_id: request.request_id,
    posts: [],
    pagination: { total: 0, returned: 0, has_more: false },
  };
}
