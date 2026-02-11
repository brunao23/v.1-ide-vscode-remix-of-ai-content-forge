import { Post } from '@/types/marketResearch';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Heart, MessageCircle, Repeat2, Eye, ExternalLink, Bookmark } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

interface Props {
  post: Post | null;
  open: boolean;
  onClose: () => void;
  onSave: (post: Post) => void;
}

export default function PostDetailModal({ post, open, onClose, onSave }: Props) {
  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <div className="flex flex-col md:flex-row max-h-[85vh]">
          {/* Media */}
          <div className="md:w-1/2 bg-secondary flex items-center justify-center">
            <img
              src={post.media_url || post.thumbnail_url}
              alt="Post"
              className="w-full h-full object-cover max-h-[40vh] md:max-h-[85vh]"
            />
          </div>

          {/* Details */}
          <div className="md:w-1/2 p-6 overflow-y-auto flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                {post.mentions.length > 0 ? post.mentions[0] : '@perfil'}
              </p>
              <p className="text-xs text-muted-foreground">
                Publicado em {format(new Date(post.published_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>

            <div className="border-t border-border" />

            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{post.caption}</p>

            {post.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {post.hashtags.map(h => (
                  <span key={h} className="text-xs text-primary">{h}</span>
                ))}
              </div>
            )}

            <div className="border-t border-border" />

            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Métricas</h4>
              <div className="space-y-1.5 text-sm text-foreground">
                <div className="flex items-center gap-2"><Heart className="w-4 h-4 text-destructive" /> {formatNumber(post.metrics.likes)} curtidas</div>
                <div className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-primary" /> {formatNumber(post.metrics.comments)} comentários</div>
                <div className="flex items-center gap-2"><Repeat2 className="w-4 h-4 text-muted-foreground" /> {formatNumber(post.metrics.shares)} compartilhamentos</div>
                <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-muted-foreground" /> {formatNumber(post.metrics.views)} visualizações</div>
              </div>
            </div>

            <div className="border-t border-border" />

            <div className="flex flex-col gap-2 mt-auto">
              <a
                href={post.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-secondary transition-colors text-sm text-foreground"
              >
                <ExternalLink className="w-4 h-4" /> Abrir post original
              </a>
              <button
                onClick={() => onSave(post)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                <Bookmark className="w-4 h-4" /> Salvar para referência
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
