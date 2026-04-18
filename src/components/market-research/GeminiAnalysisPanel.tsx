import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import {
  Sparkles,
  TrendingUp,
  Lightbulb,
  Heart,
  MessageSquare,
  Target,
  Hash,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import type { GeminiAnalysis } from '@/types/marketResearch';

interface Props {
  open: boolean;
  onClose: () => void;
  analysis: GeminiAnalysis | null;
}

export default function GeminiAnalysisPanel({ open, onClose, analysis }: Props) {
  const a = analysis?.analysis;
  const isLoading = !analysis || analysis.status === 'processing';
  const isError = analysis?.status === 'error';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        <VisuallyHidden>
          <DialogTitle>Análise Gemini AI</DialogTitle>
        </VisuallyHidden>

        {/* Header */}
        <div className="px-6 py-4 border-b border-border shrink-0 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Análise Gemini AI</span>
          {analysis?.model_used && (
            <span className="ml-auto text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {analysis.model_used}
            </span>
          )}
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analisando conteúdo com IA...</p>
              <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <AlertTriangle className="w-6 h-6 text-destructive" />
              <p className="text-sm text-foreground">Erro ao analisar o conteúdo</p>
              <p className="text-xs text-muted-foreground">
                {analysis?.error_message || 'Tente novamente mais tarde'}
              </p>
            </div>
          )}

          {!isLoading && !isError && a && (
            <>
              {/* Virality score */}
              {a.virality_score !== undefined && (
                <div className="flex items-center gap-3 py-1">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Potencial viral
                    </span>
                  </div>
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, ((a.virality_score ?? 0) / 10) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-foreground shrink-0">
                    {a.virality_score}/10
                  </span>
                </div>
              )}

              <div className="border-t border-border" />

              {a.summary && (
                <Section title="Resumo" icon={<Lightbulb className="w-3.5 h-3.5" />}>
                  <p className="text-sm text-foreground leading-relaxed">{a.summary}</p>
                </Section>
              )}

              {a.hook && (
                <Section title="Hook / Abertura" icon={<ChevronRight className="w-3.5 h-3.5" />}>
                  <p className="text-sm text-foreground leading-relaxed">{a.hook}</p>
                </Section>
              )}

              {a.content_strategy && (
                <Section title="Estratégia de Conteúdo" icon={<Target className="w-3.5 h-3.5" />}>
                  <p className="text-sm text-foreground leading-relaxed">{a.content_strategy}</p>
                </Section>
              )}

              {a.content_structure && (
                <Section title="Estrutura" icon={<MessageSquare className="w-3.5 h-3.5" />}>
                  <p className="text-sm text-foreground leading-relaxed">{a.content_structure}</p>
                </Section>
              )}

              {a.tone && (
                <Section title="Tom e Linguagem" icon={<MessageSquare className="w-3.5 h-3.5" />}>
                  <p className="text-sm text-foreground">{a.tone}</p>
                </Section>
              )}

              {(a.emotional_triggers?.length ?? 0) > 0 && (
                <Section title="Gatilhos Emocionais" icon={<Heart className="w-3.5 h-3.5" />}>
                  <div className="flex flex-wrap gap-1.5">
                    {a.emotional_triggers!.map((t, i) => (
                      <span
                        key={i}
                        className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {(a.keywords?.length ?? 0) > 0 && (
                <Section title="Palavras-chave" icon={<Hash className="w-3.5 h-3.5" />}>
                  <div className="flex flex-wrap gap-1.5">
                    {a.keywords!.map((k, i) => (
                      <span
                        key={i}
                        className="text-xs bg-secondary text-foreground px-2 py-0.5 rounded-full"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {a.cta && (
                <Section title="Call to Action" icon={<Target className="w-3.5 h-3.5" />}>
                  <p className="text-sm text-foreground">{a.cta}</p>
                </Section>
              )}

              {(a.recommendations?.length ?? 0) > 0 && (
                <Section title="Recomendações" icon={<Lightbulb className="w-3.5 h-3.5" />}>
                  <ul className="space-y-2">
                    {a.recommendations!.map((r, i) => (
                      <li key={i} className="text-sm text-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5 shrink-0">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <h3 className="text-xs font-medium uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}
