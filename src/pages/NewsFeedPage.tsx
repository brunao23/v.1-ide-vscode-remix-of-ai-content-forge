import { useState, useEffect } from 'react';
import { Loader2, Newspaper, Flame, MessageCircle, Rocket, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TrendsResult {
  fatos_chocantes: string[];
  noticias_historias: string[];
  fofocas: string[];
  pautas_virais: string[];
}

export default function NewsFeedPage() {
  const [mercado, setMercado] = useState(() => localStorage.getItem('newsfeed-mercado') || '');
  const [nicho, setNicho] = useState(() => localStorage.getItem('newsfeed-nicho') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TrendsResult | null>(null);

  useEffect(() => {
    localStorage.setItem('newsfeed-mercado', mercado);
  }, [mercado]);

  useEffect(() => {
    localStorage.setItem('newsfeed-nicho', nicho);
  }, [nicho]);

  const searchTrends = async () => {
    if (!mercado.trim() || !nicho.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('search-trends', {
        body: { mercado: mercado.trim(), nicho: nicho.trim() },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setResults(data as TrendsResult);
    } catch (e: any) {
      console.error('Trends search error:', e);
      setError('Erro ao buscar tendências. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">News Feed</h1>
          <p className="text-muted-foreground mt-1">Tendências e pautas quentes do seu mercado</p>
        </div>

        {/* Search Card */}
        <div className="rounded-xl border border-border bg-card p-6 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Mercado</label>
              <input
                type="text"
                value={mercado}
                onChange={(e) => setMercado(e.target.value)}
                placeholder="Ex: Marketing Digital"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Nicho</label>
              <input
                type="text"
                value={nicho}
                onChange={(e) => setNicho(e.target.value)}
                placeholder="Ex: Criadores de conteúdo"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <button
            onClick={searchTrends}
            disabled={loading || !mercado.trim() || !nicho.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>🔍</span>}
            {loading ? 'Buscando tendências...' : 'Buscar Tendências'}
          </button>
        </div>

        {/* States */}
        {!results && !loading && !error && (
          <div className="text-center py-16 text-muted-foreground">
            <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Preencha mercado e nicho para descobrir tendências</p>
          </div>
        )}

        {error && (
          <div className="text-center py-16">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-primary" />
            <p className="text-muted-foreground">Buscando tendências... isso pode levar 10-30 segundos</p>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ResultCard
              icon={<Zap className="w-5 h-5" />}
              title="💥 Fatos Chocantes"
              items={results.fatos_chocantes}
            />
            <ResultCard
              icon={<Newspaper className="w-5 h-5" />}
              title="📰 Notícias & Histórias"
              items={results.noticias_historias}
            />
            <ResultCard
              icon={<MessageCircle className="w-5 h-5" />}
              title="🗣️ Fofocas Quentes"
              items={results.fofocas}
            />
            <ResultCard
              icon={<Rocket className="w-5 h-5" />}
              title="🚀 Pautas Virais 2026"
              items={results.pautas_virais}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
        {title}
      </h3>
      <ol className="space-y-2.5">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex gap-3 text-sm text-foreground/90 rounded-lg px-2 py-1.5 hover:bg-secondary/50 transition-colors"
          >
            <span className="text-primary font-bold shrink-0 w-5 text-right">{i + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
