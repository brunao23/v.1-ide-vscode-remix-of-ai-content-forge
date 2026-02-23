import { useState, useCallback } from 'react';
import { Post, SearchFilters, SearchResponse, SortBy, SortOrder, SavedSearch } from '@/types/marketResearch';
import { searchMarket, loadMorePosts } from '@/services/marketResearchApi';

export function useMarketResearch() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('engagement');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('market-research-searches') || '[]');
    } catch { return []; }
  });
  const [savedPosts, setSavedPosts] = useState<Post[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('market-research-saved-posts') || '[]');
    } catch { return []; }
  });
  const [lastFilters, setLastFilters] = useState<SearchFilters | null>(null);

  const search = useCallback(async (filters: SearchFilters) => {
    setLoading(true);
    setError(null);
    setPosts([]);
    setResponse(null);
    setLastFilters(filters);

    // Save to recent searches
    const newSearch: SavedSearch = { id: crypto.randomUUID(), filters, timestamp: new Date() };
    setSavedSearches(prev => {
      const updated = [newSearch, ...prev].slice(0, 10);
      localStorage.setItem('market-research-searches', JSON.stringify(updated));
      return updated;
    });

    try {
      const res = await searchMarket({
        search_type: filters.searchType,
        platform: filters.platform,
        username: filters.searchType === 'profile' ? filters.username : undefined,
        keyword: filters.searchType === 'keyword' ? filters.keyword : undefined,
        post_type: filters.postType,
        period_days: filters.periodDays,
        results_limit: filters.resultsLimit,
        user_id: 'user_demo',
        request_id: crypto.randomUUID(),
      });

      if (!res.success) {
        setError(res.error?.message || 'Erro ao pesquisar');
      } else {
        setPosts(res.posts || []);
        setResponse(res);
      }
    } catch (e) {
      setError('Não foi possível completar a pesquisa. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!lastFilters || !response?.pagination?.next_cursor) return;
    setLoadingMore(true);
    try {
      const res = await loadMorePosts({
        search_type: lastFilters.searchType,
        platform: lastFilters.platform,
        username: lastFilters.username,
        keyword: lastFilters.keyword,
        post_type: lastFilters.postType,
        period_days: lastFilters.periodDays,
        user_id: 'user_demo',
        request_id: crypto.randomUUID(),
        cursor: response.pagination.next_cursor,
      });
      if (res.posts) {
        setPosts(prev => [...prev, ...res.posts!]);
        setResponse(prev => prev ? { ...prev, pagination: res.pagination } : prev);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [lastFilters, response]);

  const savePost = useCallback((post: Post) => {
    setSavedPosts(prev => {
      if (prev.find(p => p.id === post.id)) return prev;
      const updated = [post, ...prev];
      localStorage.setItem('market-research-saved-posts', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const sortedPosts = [...posts].sort((a, b) => {
    let valA: number, valB: number;
    switch (sortBy) {
      case 'likes': valA = a.metrics.likes; valB = b.metrics.likes; break;
      case 'comments': valA = a.metrics.comments; valB = b.metrics.comments; break;
      case 'shares': valA = a.metrics.shares; valB = b.metrics.shares; break;
      case 'views': valA = a.metrics.views; valB = b.metrics.views; break;
      case 'recent': valA = new Date(a.published_at).getTime(); valB = new Date(b.published_at).getTime(); break;
      default: // engagement
        valA = a.metrics.likes + a.metrics.comments + a.metrics.shares;
        valB = b.metrics.likes + b.metrics.comments + b.metrics.shares;
    }
    return sortOrder === 'desc' ? valB - valA : valA - valB;
  });

  return {
    posts: sortedPosts,
    response,
    loading,
    loadingMore,
    error,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    search,
    loadMore,
    savedSearches,
    savedPosts,
    savePost,
    hasMore: response?.pagination?.has_more ?? false,
  };
}
