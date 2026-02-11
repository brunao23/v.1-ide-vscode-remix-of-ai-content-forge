import { Post } from '@/types/marketResearch';
import { Heart, MessageCircle, Repeat2, Eye } from 'lucide-react';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

const typeBadge: Record<string, string> = {
  reel: '▶️ REEL',
  carousel: '📷 CARROSSEL',
  image: '📷',
  video: '▶️ VÍDEO',
};

interface PostCardProps {
  post: Post;
  onClick: () => void;
}

export default function PostCard({ post, onClick }: PostCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl bg-card border border-border overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/20 focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {/* Thumbnail */}
      <div className="relative aspect-square bg-secondary overflow-hidden">
        <img
          src={post.thumbnail_url}
          alt={post.caption.slice(0, 50)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <span className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm text-foreground text-[10px] font-medium px-1.5 py-0.5 rounded">
          {typeBadge[post.type] || post.type}
        </span>
      </div>

      {/* Caption */}
      <div className="p-3">
        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
          {post.caption}
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-1 px-3 pb-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {formatNumber(post.metrics.likes)}</span>
        <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {formatNumber(post.metrics.comments)}</span>
        <span className="flex items-center gap-1"><Repeat2 className="w-3 h-3" /> {formatNumber(post.metrics.shares)}</span>
        <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {formatNumber(post.metrics.views)}</span>
      </div>
    </button>
  );
}
