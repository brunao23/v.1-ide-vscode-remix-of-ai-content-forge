import { Post } from '@/types/marketResearch';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Heart, MessageCircle, Repeat2, Eye, ExternalLink, Bookmark, BookmarkCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { proxyImageUrl } from '@/lib/utils';

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] || null;
}

function proxyVideoUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const { hostname } = new URL(url);
    const CDN_DOMAINS = ['cdninstagram.com', 'fbcdn.net', 'tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokv.com', 'muscdn.com'];
    if (CDN_DOMAINS.some((d) => hostname.endsWith(d))) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  } catch {
    return url;
  }
}

interface Props {
  post: Post | null;
  open: boolean;
  onClose: () => void;
  onSave: (post: Post) => void;
  isSaved?: boolean;
}

export default function PostDetailModal({ post, open, onClose, onSave, isSaved }: Props) {
  if (!post) return null;

  const ytId = extractYouTubeId(post.post_url);
  const isYT = Boolean(ytId);
  const isVideo = post.type === 'reel' || post.type === 'video';
  const videoSrc = proxyVideoUrl(post.video_url);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${isYT || (isVideo && videoSrc) ? 'max-w-4xl' : 'max-w-3xl'} p-0 gap-0 overflow-hidden`}>
        <VisuallyHidden><DialogTitle>{post.caption?.slice(0, 60) || 'Post'}</DialogTitle></VisuallyHidden>
        <div className={`flex flex-col ${isYT || (isVideo && videoSrc) ? '' : 'md:flex-row'} max-h-[90vh]`}>
          {/* Media */}
          {isYT ? (
            <div className="w-full bg-black">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}?autoplay=0&rel=0`}
                  title={post.caption || 'YouTube Video'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                  style={{ border: 'none' }}
                />
              </div>
            </div>
          ) : isVideo && videoSrc ? (
            <div className="w-full bg-black">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <video
                  src={videoSrc}
                  poster={proxyImageUrl(post.thumbnail_url)}
                  controls
                  playsInline
                  className="absolute inset-0 w-full h-full object-contain"
                  style={{ background: '#000' }}
                >
                  Seu navegador não suporta reprodução de vídeo.
                </video>
              </div>
            </div>
          ) : (
            <div className="md:w-1/2 bg-secondary flex items-center justify-center">
              <img
                src={proxyImageUrl(post.media_url || post.thumbnail_url)}
                alt="Post"
                className="w-full h-full object-cover max-h-[40vh] md:max-h-[85vh]"
              />
            </div>
          )}

          {/* Details */}
          <div className={`${isYT || (isVideo && videoSrc) ? 'w-full' : 'md:w-1/2'} p-6 overflow-y-auto flex flex-col gap-4`}>
            <div>
              <p className="text-sm font-medium text-foreground line-clamp-2">
                {post.caption || (post.mentions.length > 0 ? post.mentions[0] : '@perfil')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Publicado em {format(new Date(post.published_at), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
              </p>
            </div>

            <div className="border-t border-border" />

            {!isYT && !(isVideo && videoSrc) && post.caption && (
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap line-clamp-6">{post.caption}</p>
            )}

            {isVideo && videoSrc && post.caption && (
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap line-clamp-4">{post.caption}</p>
            )}

            {post.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {post.hashtags.slice(0, 20).map(h => (
                  <span key={h} className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">{h}</span>
                ))}
              </div>
            )}

            <div className="border-t border-border" />

            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Metricas</h4>
              <div className={`grid ${isYT || (isVideo && videoSrc) ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1'} gap-2 text-sm text-foreground`}>
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-destructive" /> {formatNumber(post.metrics.likes)} curtidas
                </div>
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-primary" /> {formatNumber(post.metrics.comments)} comentarios
                </div>
                <div className="flex items-center gap-2">
                  <Repeat2 className="w-4 h-4 text-muted-foreground" /> {formatNumber(post.metrics.shares)} compartilhamentos
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground" /> {formatNumber(post.metrics.views)} visualizacoes
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            <div className={`flex ${isYT || (isVideo && videoSrc) ? 'flex-row' : 'flex-col'} gap-2 mt-auto`}>
              <a
                href={post.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-secondary transition-colors text-sm text-foreground ${isYT || (isVideo && videoSrc) ? 'flex-1' : ''}`}
              >
                <ExternalLink className="w-4 h-4" />
                {isYT ? 'Abrir no YouTube' : 'Abrir post original'}
              </a>
              <button
                onClick={() => onSave(post)}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium ${isYT || (isVideo && videoSrc) ? 'flex-1' : ''} ${
                  isSaved
                    ? 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {isSaved ? (
                  <><BookmarkCheck className="w-4 h-4" /> Salvo</>
                ) : (
                  <><Bookmark className="w-4 h-4" /> Salvar para referencia</>
                )}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
