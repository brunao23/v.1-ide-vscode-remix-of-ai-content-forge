import { useCallback, useEffect, useMemo, useState } from "react";
import { loadMorePosts, searchMarket } from "@/services/marketResearchApi";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  Post,
  SavedSearch,
  SearchFilters,
  SearchResponse,
  SortBy,
  SortOrder,
} from "@/types/marketResearch";

const SAVED_POST_TTL_DAYS = 7;

function dbRowToPost(row: any): Post & { saved_at: string } {
  return {
    id: row.post_id,
    post_url: row.post_url,
    type: row.post_type || "image",
    thumbnail_url: row.thumbnail_url || "",
    media_url: row.media_url || undefined,
    caption: row.caption || "",
    published_at: row.published_at || new Date().toISOString(),
    metrics: row.metrics || { likes: 0, comments: 0, shares: 0, views: 0, engagement_rate: 0 },
    hashtags: row.hashtags || [],
    mentions: row.mentions || [],
    saved_at: row.created_at,
  };
}

export function useMarketResearch() {
  const { user, activeTenant } = useAuth();
  const tenantKey = activeTenant?.id || "default";
  const searchStorageKey = useMemo(() => `market-research-searches:${tenantKey}`, [tenantKey]);
  const scopedUserId = user?.id || "";

  const [posts, setPosts] = useState<Post[]>([]);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("engagement");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<(Post & { saved_at: string })[]>([]);
  const [savedPostsLoading, setSavedPostsLoading] = useState(false);
  const [lastFilters, setLastFilters] = useState<SearchFilters | null>(null);

  // Load saved searches from localStorage
  useEffect(() => {
    try {
      const searches = JSON.parse(localStorage.getItem(searchStorageKey) || "[]");
      setSavedSearches(Array.isArray(searches) ? searches : []);
    } catch {
      setSavedSearches([]);
    }
  }, [searchStorageKey]);

  // Load saved posts from Supabase + auto-delete expired (>7 days)
  const loadSavedPosts = useCallback(async () => {
    if (!scopedUserId || !tenantKey || tenantKey === "default") return;

    setSavedPostsLoading(true);
    try {
      // Delete expired posts (older than 7 days)
      const cutoff = new Date(Date.now() - SAVED_POST_TTL_DAYS * 86_400_000).toISOString();
      await supabase
        .from("market_research_saved_posts")
        .delete()
        .eq("user_id", scopedUserId)
        .eq("tenant_id", tenantKey)
        .lt("created_at", cutoff);

      // Load remaining
      const { data } = await supabase
        .from("market_research_saved_posts")
        .select("*")
        .eq("user_id", scopedUserId)
        .eq("tenant_id", tenantKey)
        .order("created_at", { ascending: false });

      if (data) {
        const posts = data.map(dbRowToPost);
        setSavedPosts(posts);
        setSavedPostIds(new Set(posts.map((p) => p.id)));
      }
    } catch (err) {
      console.error("Failed to load saved posts:", err);
    } finally {
      setSavedPostsLoading(false);
    }
  }, [scopedUserId, tenantKey]);

  useEffect(() => {
    void loadSavedPosts();
  }, [loadSavedPosts]);

  const search = useCallback(
    async (filters: SearchFilters) => {
      setLoading(true);
      setError(null);
      setPosts([]);
      setResponse(null);
      setLastFilters(filters);

      const newSearch: SavedSearch = {
        id: crypto.randomUUID(),
        filters,
        timestamp: new Date(),
      };

      setSavedSearches((prev) => {
        const updated = [newSearch, ...prev].slice(0, 10);
        localStorage.setItem(searchStorageKey, JSON.stringify(updated));
        return updated;
      });

      try {
        const res = await searchMarket({
          search_type: filters.searchType,
          platform: filters.platform,
          username: filters.searchType === "profile" ? filters.username : undefined,
          keyword: filters.searchType === "keyword" ? filters.keyword : undefined,
          post_type: filters.postType,
          period_days: filters.periodDays,
          results_limit: filters.resultsLimit,
          user_id: scopedUserId,
          tenant_id: activeTenant?.id,
          request_id: crypto.randomUUID(),
        });

        if (!res.success) {
          setError(res.error?.message || "Erro ao pesquisar");
        } else {
          setPosts(res.posts || []);
          setResponse(res);
        }
      } catch {
        setError("Nao foi possivel completar a pesquisa. Tente novamente.");
      } finally {
        setLoading(false);
      }
    },
    [scopedUserId, searchStorageKey, activeTenant?.id],
  );

  const loadMore = useCallback(async () => {
    if (!lastFilters || !response?.pagination?.has_more) return;
    setLoadingMore(true);

    try {
      const res = await loadMorePosts({
        search_type: lastFilters.searchType,
        platform: lastFilters.platform,
        username: lastFilters.username,
        keyword: lastFilters.keyword,
        post_type: lastFilters.postType,
        period_days: lastFilters.periodDays,
        results_limit: lastFilters.resultsLimit,
        user_id: scopedUserId,
        tenant_id: activeTenant?.id,
        request_id: crypto.randomUUID(),
        cursor: response.pagination?.next_cursor,
      });

      if (res.posts) {
        setPosts((prev) => [...prev, ...res.posts!]);
        setResponse((prev) => (prev ? { ...prev, pagination: res.pagination } : prev));
      }
    } finally {
      setLoadingMore(false);
    }
  }, [lastFilters, response, scopedUserId, activeTenant?.id]);

  const isPostSaved = useCallback(
    (postId: string) => savedPostIds.has(postId),
    [savedPostIds],
  );

  const savePost = useCallback(
    async (post: Post) => {
      if (!scopedUserId || !tenantKey || tenantKey === "default") {
        toast.error("Faca login para salvar posts");
        return;
      }

      // Already saved? Unsave it
      if (savedPostIds.has(post.id)) {
        const { error: delErr } = await supabase
          .from("market_research_saved_posts")
          .delete()
          .eq("user_id", scopedUserId)
          .eq("tenant_id", tenantKey)
          .eq("post_id", post.id);

        if (delErr) {
          toast.error("Erro ao remover dos salvos");
          return;
        }

        setSavedPostIds((prev) => {
          const next = new Set(prev);
          next.delete(post.id);
          return next;
        });
        setSavedPosts((prev) => prev.filter((p) => p.id !== post.id));
        toast.success("Removido dos salvos");
        return;
      }

      // Save
      const { error: insErr } = await supabase
        .from("market_research_saved_posts")
        .upsert(
          {
            user_id: scopedUserId,
            tenant_id: tenantKey,
            post_id: post.id,
            platform: post.post_url.includes("youtube") ? "youtube" : post.post_url.includes("tiktok") ? "tiktok" : "instagram",
            post_url: post.post_url,
            post_type: post.type,
            thumbnail_url: post.thumbnail_url || "",
            media_url: post.media_url || "",
            caption: post.caption || "",
            published_at: post.published_at || new Date().toISOString(),
            metrics: post.metrics as any,
            hashtags: post.hashtags || [],
            mentions: post.mentions || [],
          },
          { onConflict: "user_id,tenant_id,post_id" },
        );

      if (insErr) {
        console.error("Save post error:", insErr);
        toast.error("Erro ao salvar post");
        return;
      }

      setSavedPostIds((prev) => new Set(prev).add(post.id));
      setSavedPosts((prev) => [
        { ...post, saved_at: new Date().toISOString() },
        ...prev,
      ]);
      toast.success("Post salvo com sucesso!");
    },
    [scopedUserId, tenantKey, savedPostIds],
  );

  const sortedPosts = [...posts].sort((a, b) => {
    let valueA: number;
    let valueB: number;

    switch (sortBy) {
      case "likes":
        valueA = a.metrics.likes;
        valueB = b.metrics.likes;
        break;
      case "comments":
        valueA = a.metrics.comments;
        valueB = b.metrics.comments;
        break;
      case "shares":
        valueA = a.metrics.shares;
        valueB = b.metrics.shares;
        break;
      case "views":
        valueA = a.metrics.views;
        valueB = b.metrics.views;
        break;
      case "recent":
        valueA = new Date(a.published_at).getTime();
        valueB = new Date(b.published_at).getTime();
        break;
      default:
        valueA = a.metrics.likes + a.metrics.comments + a.metrics.shares;
        valueB = b.metrics.likes + b.metrics.comments + b.metrics.shares;
    }

    return sortOrder === "desc" ? valueB - valueA : valueA - valueB;
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
    savePost,
    isPostSaved,
    savedPosts,
    savedPostsLoading,
    hasMore: response?.pagination?.has_more ?? false,
  };
}
