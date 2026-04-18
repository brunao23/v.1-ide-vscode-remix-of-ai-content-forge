import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { GeminiAnalysis, Post } from "@/types/marketResearch";

function detectPlatform(url: string): string {
  if (url.includes("youtube") || url.includes("youtu.be")) return "youtube";
  if (url.includes("tiktok")) return "tiktok";
  return "instagram";
}

export function useGeminiAnalysis(postIds: string[]) {
  const { user, activeTenant } = useAuth();
  const tenantKey = activeTenant?.id || "default";
  const scopedUserId = user?.id || "";

  const [analyses, setAnalyses] = useState<Map<string, GeminiAnalysis>>(new Map());
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const loadedIdsRef = useRef<string>("");

  const postIdsKey = [...postIds].sort().join(",");

  useEffect(() => {
    if (!scopedUserId || !tenantKey || tenantKey === "default") return;
    if (postIds.length === 0) return;
    if (postIdsKey === loadedIdsRef.current) return;
    loadedIdsRef.current = postIdsKey;

    void (async () => {
      const { data } = await supabase
        .from("market_research_gemini_analyses")
        .select("*")
        .eq("user_id", scopedUserId)
        .eq("tenant_id", tenantKey)
        .in("post_id", postIds);

      if (data) {
        setAnalyses((prev) => {
          const next = new Map(prev);
          data.forEach((row) => next.set(row.post_id, row as unknown as GeminiAnalysis));
          return next;
        });
      }
    })();
  }, [postIdsKey, scopedUserId, tenantKey]);

  const analyzePost = useCallback(
    async (post: Post) => {
      if (!scopedUserId || !tenantKey || tenantKey === "default") {
        toast.error("Faça login para analisar posts");
        return;
      }

      const existing = analyses.get(post.id);
      if (existing?.status === "completed") return;
      if (analyzing.has(post.id)) return;

      setAnalyzing((prev) => new Set(prev).add(post.id));

      try {
        const { data, error } = await supabase.functions.invoke(
          "market-research-gemini-analyze",
          {
            body: {
              post_id: post.id,
              post_url: post.post_url,
              platform: detectPlatform(post.post_url),
              caption: post.caption,
              hashtags: post.hashtags,
              mentions: post.mentions,
              published_at: post.published_at,
              tenant_id: tenantKey,
            },
          },
        );

        if (error) throw error;

        if (data?.analysis) {
          setAnalyses((prev) => new Map(prev).set(post.id, data.analysis as GeminiAnalysis));
        }
      } catch (err) {
        console.error("Gemini analysis error:", err);
        toast.error("Erro ao analisar post com Gemini AI");
      } finally {
        setAnalyzing((prev) => {
          const next = new Set(prev);
          next.delete(post.id);
          return next;
        });
      }
    },
    [scopedUserId, tenantKey, analyses, analyzing],
  );

  return {
    analyses,
    analyzing,
    analyzePost,
    getAnalysis: (postId: string): GeminiAnalysis | null => analyses.get(postId) ?? null,
    isAnalyzing: (postId: string) => analyzing.has(postId),
    hasAnalysis: (postId: string) =>
      analyses.has(postId) && analyses.get(postId)?.status === "completed",
  };
}
