import { useCallback, useEffect, useMemo, useState } from "react";
import { searchMarket } from "@/services/marketResearchApi";
import { useAuth } from "@/contexts/AuthContext";
import type { MyFeedConfig, Platform, Post, ProfileMetadata, SearchResponse } from "@/types/marketResearch";

const DEFAULT_CONFIG: MyFeedConfig = {
  platform: "instagram",
  username: "",
  periodDays: 30,
};

export function useMyFeedSearch() {
  const { user, activeTenant } = useAuth();
  const tenantKey = activeTenant?.id || "default";
  const storageKey = useMemo(() => `my-feed-config:${tenantKey}`, [tenantKey]);
  const scopedUserId = user?.id || "";

  const [posts, setPosts] = useState<Post[]>([]);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<MyFeedConfig>(DEFAULT_CONFIG);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) });
    } catch {
      // ignore
    }
  }, [storageKey]);

  const saveConfig = useCallback(
    (newConfig: MyFeedConfig) => {
      setConfig(newConfig);
      try {
        localStorage.setItem(storageKey, JSON.stringify(newConfig));
      } catch {
        // ignore
      }
    },
    [storageKey],
  );

  const search = useCallback(async () => {
    if (!config.username.trim()) return;
    setLoading(true);
    setError(null);
    setPosts([]);
    setResponse(null);
    setHasSearched(true);

    try {
      const res = await searchMarket({
        search_type: "profile",
        platform: config.platform,
        username: config.username,
        post_type: "all",
        period_days: config.periodDays,
        results_limit: 20,
        user_id: scopedUserId,
        tenant_id: activeTenant?.id,
        request_id: crypto.randomUUID(),
      });

      if (!res.success) {
        setError(res.error?.message || "Erro ao carregar feed");
      } else {
        setPosts(res.posts || []);
        setResponse(res);
      }
    } catch {
      setError("Não foi possível carregar o feed. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [config, scopedUserId, activeTenant?.id]);

  const metadata: ProfileMetadata | null = response?.metadata || null;

  return {
    posts,
    response,
    loading,
    error,
    hasSearched,
    config,
    saveConfig,
    search,
    metadata,
  };
}
