import { useState } from 'react';
import { Loader2, Target } from 'lucide-react';
import { useCompetitors } from '@/hooks/useCompetitors';
import PostCard from '@/components/market-research/PostCard';
import PostDetailModal from '@/components/market-research/PostDetailModal';
import type { Post } from '@/types/marketResearch';

export default function AnaliseConcorrentesPage() {
  const { competitors, loading, isCompetitor, markAsCompetitor } = useCompetitors();
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-6 py-8 space-y-8">
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <h2 className="text-2xl text-foreground" style={{ fontFamily: "'ITC Garamond Std Lt Cond', serif" }}>
            Análise de Concorrentes
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Perfis e publicações que você marcou como concorrentes na pesquisa. Clique em qualquer card para ver detalhes.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && competitors.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-secondary/60 flex items-center justify-center">
              <Target className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-muted-foreground">
              Nenhum concorrente marcado ainda. Use a Pesquisa para encontrar perfis e marcá-los.
            </p>
          </div>
        )}

        {!loading && competitors.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {competitors.map((post) => (
              <div key={post.id} className="relative group">
                <PostCard post={post} onClick={() => setSelectedPost(post)} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void markAsCompetitor(post);
                  }}
                  className={`absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium backdrop-blur-sm transition-colors ${
                    isCompetitor(post.id)
                      ? 'bg-primary text-primary-foreground opacity-0 group-hover:opacity-100'
                      : 'bg-background/80 text-muted-foreground hover:bg-destructive/20 hover:text-destructive opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Target className="w-3 h-3" />
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onSave={() => {}}
        />
      )}
    </div>
  );
}
