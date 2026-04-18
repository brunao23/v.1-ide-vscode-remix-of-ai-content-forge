import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Post } from "@/types/marketResearch";

function dbRowToPost(row: any): Post & { marked_at: string } {
  return {
    id: row.post_id,
    post_url: row.post_url,
    type: row.post_type || "image",
    thumbnail_url: row.thumbnail_url || "",
    media_url: row.media_url || undefined,
    video_url: row.video_url || undefined,
    caption: row.caption || "",
    published_at: row.published_at || new Date().toISOString(),
    metrics: row.metrics || { likes: 0, comments: 0, shares: 0, views: 0, engagement_rate: 0 },
    hashtags: row.hashtags || [],
    mentions: row.mentions || [],
    marked_at: row.created_at,
  };
}

function detectPlatform(url: string): string {
  if (url.includes("youtube") || url.includes("youtu.be")) return "youtube";
  if (url.includes("tiktok")) return "tiktok";
  return "instagram";
}

export function useCompetitors() {
  const { user, activeTenant } = useAuth();
  const tenantKey = activeTenant?.id || "default";
  const scopedUserId = user?.id || "";

  const [competitors, setCompetitors] = useState<(Post & { marked_at: string })[]>([]);
  const [competitorIds, setCompetitorIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!scopedUserId || !tenantKey || tenantKey === "default") return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("market_research_competitors")
        .select("*")
        .eq("user_id", scopedUserId)
        .eq("tenant_id", tenantKey)
        .order("created_at", { ascending: false });

      if (data) {
        const posts = data.map(dbRowToPost);
        setCompetitors(posts);
        setCompetitorIds(new Set(posts.map((p) => p.id)));
      }
    } catch (err) {
      console.error("Failed to load competitors:", err);
    } finally {
      setLoading(false);
    }
  }, [scopedUserId, tenantKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const isCompetitor = useCallback(
    (postId: string) => competitorIds.has(postId),
    [competitorIds],
  );

  const markAsCompetitor = useCallback(
    async (post: Post) => {
      if (!scopedUserId || !tenantKey || tenantKey === "default") {
        toast.error("Faça login para marcar concorrentes");
        return;
      }

      if (competitorIds.has(post.id)) {
        const { error } = await supabase
          .from("market_research_competitors")
          .delete()
          .eq("user_id", scopedUserId)
          .eq("tenant_id", tenantKey)
          .eq("post_id", post.id);

        if (error) {
          toast.error("Erro ao remover concorrente");
          return;
        }

        setCompetitorIds((prev) => {
          const next = new Set(prev);
          next.delete(post.id);
          return next;
        });
        setCompetitors((prev) => prev.filter((p) => p.id !== post.id));
        toast.success("Removido dos concorrentes");
        return;
      }

      const { error } = await supabase.from("market_research_competitors").upsert(
        {
          user_id: scopedUserId,
          tenant_id: tenantKey,
          post_id: post.id,
          platform: detectPlatform(post.post_url),
          post_url: post.post_url,
          post_type: post.type,
          thumbnail_url: post.thumbnail_url || "",
          media_url: post.media_url || null,
          video_url: post.video_url || null,
          caption: post.caption || "",
          published_at: post.published_at || new Date().toISOString(),
          metrics: post.metrics as any,
          hashtags: post.hashtags || [],
          mentions: post.mentions || [],
        },
        { onConflict: "user_id,tenant_id,post_id" },
      );

      if (error) {
        console.error("Mark competitor error:", error);
        toast.error("Erro ao marcar como concorrente");
        return;
      }

      setCompetitorIds((prev) => new Set(prev).add(post.id));
      setCompetitors((prev) => [{ ...post, marked_at: new Date().toISOString() }, ...prev]);
      toast.success("Marcado como concorrente!");
    },
    [scopedUserId, tenantKey, competitorIds],
  );

  return { competitors, competitorIds, loading, isCompetitor, markAsCompetitor };
}
