import { useState } from 'react';
import { Post } from '@/types/marketResearch';
import { Heart, MessageCircle, Repeat2, Eye, Play, ImageIcon } from 'lucide-react';
import { proxyImageUrl } from '@/lib/utils';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

const typeBadge: Record<string, string> = {
  reel: 'REEL',
  carousel: 'CARROSSEL',
  image: 'IMAGEM',
  video: 'VIDEO',
};

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com\/watch|youtu\.be\//i.test(url || '');
}

interface PostCardProps {
  post: Post;
  onClick: () => void;
}

export default function PostCard({ post, onClick }: PostCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const isYT = isYouTubeUrl(post.post_url);

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl bg-card border border-border overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {/* Thumbnail */}
      <div className={`relative ${isYT ? 'aspect-video' : 'aspect-[4/5]'} bg-secondary overflow-hidden group`}>
        {!imgFailed && post.thumbnail_url ? (
          <img
            src={proxyImageUrl(post.thumbnail_url)}
            alt={post.caption.slice(0, 50)}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary/80">
            <ImageIcon className="w-8 h-8 text-muted-foreground/30" strokeWidth={1} />
          </div>
        )}

        {/* Play overlay for videos */}
        {(isYT || post.type === 'video' || post.type === 'reel') && !imgFailed && post.thumbnail_url && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all shadow-lg">
              <Play className="w-5 h-5 text-black ml-0.5" fill="black" />
            </div>
          </div>
        )}

        <span className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm text-foreground text-[10px] font-medium px-1.5 py-0.5 rounded">
          {typeBadge[post.type] || post.type}
        </span>
      </div>

      {/* Caption */}
      <div className="px-3 pt-2.5 pb-1">
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {post.caption || '—'}
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-1 px-3 py-2.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {formatNumber(post.metrics.likes)}</span>
        <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {formatNumber(post.metrics.comments)}</span>
        <span className="flex items-center gap-1"><Repeat2 className="w-3 h-3" /> {formatNumber(post.metrics.shares)}</span>
        <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {formatNumber(post.metrics.views)}</span>
      </div>
    </button>
  );
}
