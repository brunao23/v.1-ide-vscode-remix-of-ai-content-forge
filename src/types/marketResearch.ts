export type Platform = 'instagram' | 'tiktok' | 'youtube';
export type PostType = 'all' | 'carousel' | 'reels' | 'image' | 'video';
export type SearchType = 'profile' | 'keyword';
export type SortBy = 'engagement' | 'likes' | 'comments' | 'shares' | 'views' | 'recent';
export type SortOrder = 'asc' | 'desc';

export interface PostMetrics {
  likes: number;
  comments: number;
  shares: number;
  views: number;
  engagement_rate: number;
}

export interface Post {
  id: string;
  post_url: string;
  type: 'reel' | 'carousel' | 'image' | 'video';
  thumbnail_url: string;
  media_url?: string;
  media_urls?: string[];
  caption: string;
  published_at: string;
  metrics: PostMetrics;
  hashtags: string[];
  mentions: string[];
}

export interface ProfileMetadata {
  platform: Platform;
  username: string;
  profile_picture: string;
  followers: number;
  following: number;
  total_posts: number;
  scraped_at: string;
}

export interface SearchRequest {
  search_type: SearchType;
  platform: Platform;
  username?: string;
  keyword?: string;
  post_type: PostType;
  period_days: number;
  results_limit?: number;
  user_id: string;
  request_id: string;
  cursor?: string;
}

export interface SearchResponse {
  success: boolean;
  request_id: string;
  metadata?: ProfileMetadata;
  posts?: Post[];
  pagination?: {
    total: number;
    returned: number;
    has_more: boolean;
    next_cursor?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface SearchFilters {
  searchType: SearchType;
  platform: Platform;
  username: string;
  keyword: string;
  postType: PostType;
  periodDays: number;
  resultsLimit?: number;
}

export interface SavedSearch {
  id: string;
  filters: SearchFilters;
  timestamp: Date;
}
