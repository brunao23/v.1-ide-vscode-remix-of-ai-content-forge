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
  const isNonYTVideo = isVideo && videoSrc && !isYT;

  // Layout:
  // YouTube  → max-w-6xl, horizontal side-by-side (video 60% | details 40%), sem max-h no outer
  // Non-YT video → max-w-4xl, vertical (video full width, details below)
  // Image    → max-w-3xl, horizontal side-by-side (image 50% | details 50%)
  const dialogMaxWidth = isYT ? 'max-w-6xl' : (isNonYTVideo ? 'max-w-4xl' : 'max-w-3xl');
  const outerFlex = isNonYTVideo ? 'flex-col' : 'flex-col md:flex-row';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${dialogMaxWidth} p-0 gap-0 overflow-hidden`}>
        <VisuallyHidden><DialogTitle>{post.caption?.slice(0, 60) || 'Post'}</DialogTitle></VisuallyHidden>
        {/* Para YouTube: sem max-h no outer para o vídeo não ser cortado */}
        <div className={`flex ${outerFlex} ${isNonYTVideo || !isYT ? 'max-h-[90vh]' : ''}`}>
          {/* Media */}
          {isYT ? (
            /* YouTube: painel esquerdo ocupa 60%, iframe preenche 100% da altura disponível */
            <div className="w-full md:w-3/5 bg-black flex-shrink-0 flex items-center justify-center self-stretch">
              <div className="w-full aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}?autoplay=0&rel=0`}
                  title={post.caption || 'YouTube Video'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full"
                  style={{ border: 'none', display: 'block' }}
                />
              </div>
            </div>
          ) : isNonYTVideo ? (
            /* Vídeo não-YouTube: layout vertical, ocupa largura total */
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
            /* Imagem: ocupa 50% da largura no layout horizontal */
            <div className="md:w-1/2 bg-secondary flex items-center justify-center">
              <img
                src={proxyImageUrl(post.media_url || post.thumbnail_url)}
                alt="Post"
                className="w-full h-full object-cover max-h-[40vh] md:max-h-[85vh]"
              />
            </div>
          )}

          {/* Details */}
          <div className={`${isYT ? 'md:w-2/5' : isNonYTVideo ? 'w-full' : 'md:w-1/2'} p-6 overflow-y-auto flex flex-col gap-4 max-h-[90vh]`}>
            <div>
              <p className="text-sm font-medium text-foreground line-clamp-2">
                {post.caption || (post.mentions.length > 0 ? post.mentions[0] : '@perfil')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Publicado em {format(new Date(post.published_at), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
              </p>
            </div>

            <div className="border-t border-border" />

            {post.caption && (
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{post.caption}</p>
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
              <div className={`grid ${isNonYTVideo ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'} gap-2 text-sm text-foreground`}>
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

            <div className="flex flex-col gap-2 mt-auto">
              <button
                onClick={() => onSave(post)}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium ${
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
              <a
                href={post.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-secondary transition-colors text-sm text-foreground"
              >
                <ExternalLink className="w-4 h-4" />
                {isYT ? 'Abrir no YouTube' : 'Abrir post original'}
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
