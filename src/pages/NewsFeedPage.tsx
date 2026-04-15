import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ExternalLink,
  Loader2,
  Newspaper,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Clock3,
  History,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { invokeSupabaseFunctionWithRetry } from '@/services/supabaseFunctionClient';
import { supabase } from '@/integrations/supabase/client';

type Story = {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  source_domain?: string;
  source_favicon?: string;
  published_at: string | null;
  image_url: string | null;
  query_tag: string;
};

type TopSource = { name: string; count: number };
type TopTopic = { term: string; count: number };

type FeedResponse = {
  generated_at: string;
  query_context: { mercado: string; nicho: string };
  total_stories: number;
  stories: Story[];
  top_sources: TopSource[];
  top_topics: TopTopic[];
};

type StoryBlock = {
  feature: Story;
  minis: Story[];
};

type SavedRange = 'week' | 'fortnight' | 'month';
type StoryRange = 'all' | SavedRange;

type SavedSearch = {
  id: string;
  name: string;
  mercado: string;
  nicho: string;
  created_at: string;
};

const INITIAL_VISIBLE_BLOCKS = 5;
const LOAD_MORE_STEP = 4;
const FEED_CACHE_KEY = 'newsfeed-last-feed';

function formatDate(value: string | null): string {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Strip markdown syntax from text so it renders as plain text. */
function stripMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')   // images ![alt](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')     // links [text](url)
    .replace(/#{1,6}\s+/g, '')                    // headers
    .replace(/\*\*(.+?)\*\*/g, '$1')             // bold **text**
    .replace(/__(.+?)__/g, '$1')                  // bold __text__
    .replace(/\*(.+?)\*/g, '$1')                  // italic *text*
    .replace(/_(.+?)_/g, '$1')                    // italic _text_
    .replace(/~~(.+?)~~/g, '$1')                  // strikethrough
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')       // inline code
    .replace(/^[-*+]\s+/gm, '')                   // unordered lists
    .replace(/^\d+\.\s+/gm, '')                   // ordered lists
    .replace(/^>\s+/gm, '')                       // blockquotes
    .replace(/---+/g, '')                         // horizontal rules
    .replace(/\n{3,}/g, '\n\n')                   // excessive newlines
    .trim();
}

function fallbackImage(url: string): string {
  return `https://image.thum.io/get/width/1200/crop/640/noanimate/${encodeURIComponent(url)}`;
}

function fallbackImageMshots(url: string): string {
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1200`;
}

function imageCandidates(story: Story): string[] {
  const list = [story.image_url || '', fallbackImageMshots(story.url), fallbackImage(story.url)].filter(Boolean);
  return Array.from(new Set(list));
}

/** Filter out stories with invalid URLs, error pages, or insufficient content. */
function isValidStory(story: Story): boolean {
  // Must have a valid http(s) URL
  if (!story.url || !/^https?:\/\/.{4,}/i.test(story.url)) return false;

  // Must have a meaningful title
  const title = (story.title || '').trim();
  if (title.length < 10) return false;

  // Detect error pages / 404s / broken content in title or summary
  const errorPattern =
    /\b(404|403|401|500|502|503|not\s*found|page\s*not\s*found|pagina\s*nao\s*encontrada|access\s*denied|forbidden|unauthorized|unavailable|indisponivel|err[oo]r|removed|deleted|login\s*required|sign\s*in\s*required|subscription\s*required|content\s*unavailable|article\s*not\s*found|no\s*longer\s*available|has\s*been\s*removed)\b/i;

  if (errorPattern.test(title)) return false;
  if (story.summary && errorPattern.test(story.summary)) return false;

  // Detect error-like URL paths
  const urlLower = story.url.toLowerCase();
  if (/\/(404|error|not[-_]?found|login|signin|signup|auth)\b/.test(urlLower)) return false;

  // Must have enough substance (either a decent title or some summary)
  const summary = (story.summary || '').trim();
  if (title.length < 15 && summary.length < 20) return false;

  return true;
}

/** Remove duplicate stories by URL and by similar title. */
function deduplicateStories(stories: Story[]): Story[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const result: Story[] = [];

  for (const story of stories) {
    const urlKey = story.url.replace(/^https?:\/\/(www\.)?/, '').replace(/[#?].*$/, '').replace(/\/+$/, '').toLowerCase();
    if (seenUrls.has(urlKey)) continue;

    const titleKey = story.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 80);
    if (titleKey && seenTitles.has(titleKey)) continue;

    seenUrls.add(urlKey);
    if (titleKey) seenTitles.add(titleKey);
    result.push(story);
  }

  return result;
}

/** Null out duplicate image_url so each original image only appears once. */
function deduplicateImages(stories: Story[]): Story[] {
  const seen = new Set<string>();
  return stories.map((story) => {
    if (!story.image_url) return story;
    const key = story.image_url.toLowerCase().replace(/[#?].*$/, '');
    if (seen.has(key)) return { ...story, image_url: null };
    seen.add(key);
    return story;
  });
}

function splitIntoBlocks(stories: Story[]): StoryBlock[] {
  const blocks: StoryBlock[] = [];
  for (let i = 0; i < stories.length; i += 4) {
    blocks.push({
      feature: stories[i],
      minis: stories.slice(i + 1, i + 4),
    });
  }
  return blocks.filter((item) => Boolean(item.feature));
}

function computeTopSources(stories: Story[]): TopSource[] {
  const map = new Map<string, number>();
  for (const story of stories) {
    map.set(story.source, (map.get(story.source) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function computeTopTopics(stories: Story[]): TopTopic[] {
  const stopwords = new Set([
    'para', 'com', 'sobre', 'mercado', 'nicho', 'noticia', 'noticias', 'tech', 'tecnologia', '2026', '2025', '2024',
    'uma', 'umas', 'uns', 'que', 'como', 'isso', 'mais', 'menos', 'pela', 'pelo', 'entre', 'apenas', 'sobre', 'ainda',
  ]);

  const map = new Map<string, number>();
  for (const story of stories) {
    const text = `${story.title} ${story.summary}`.toLowerCase();
    const tokens = text
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4 && !stopwords.has(token));

    for (const token of tokens) {
      map.set(token, (map.get(token) || 0) + 1);
    }
  }

  return Array.from(map.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 16);
}

function buildSearchUrl(mercado: string, nicho: string): string {
  return `search://newsfeed?mercado=${encodeURIComponent(mercado)}&nicho=${encodeURIComponent(nicho)}`;
}

function parseSearchUrl(url: string): { mercado: string; nicho: string } | null {
  if (!url.startsWith('search://newsfeed?')) return null;
  const query = url.split('?')[1] || '';
  const params = new URLSearchParams(query);
  const mercado = String(params.get('mercado') || '').trim();
  const nicho = String(params.get('nicho') || '').trim();
  if (!mercado || !nicho) return null;
  return { mercado, nicho };
}

function isWithinRange(isoDate: string, range: SavedRange): boolean {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const days = range === 'week' ? 7 : range === 'fortnight' ? 15 : 30;
  const threshold = new Date(now);
  threshold.setDate(now.getDate() - days);

  return date >= threshold;
}

export default function NewsFeedPage() {
  const { activeTenant, user } = useAuth();

  const [mercado, setMercado] = useState(() => localStorage.getItem('newsfeed-mercado') || 'Inteligencia Artificial');
  const [nicho, setNicho] = useState(() => localStorage.getItem('newsfeed-nicho') || 'Criadores de conteudo e negocios digitais');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedResponse | null>(() => {
    try {
      const cached = localStorage.getItem(FEED_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [visibleBlocks, setVisibleBlocks] = useState(INITIAL_VISIBLE_BLOCKS);
  const [storyRange, setStoryRange] = useState<StoryRange>('all');
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  useEffect(() => {
    localStorage.setItem('newsfeed-mercado', mercado);
  }, [mercado]);

  useEffect(() => {
    localStorage.setItem('newsfeed-nicho', nicho);
  }, [nicho]);

  useEffect(() => {
    void loadSavedSearches();
  }, [user?.id, activeTenant?.id]);

  useEffect(() => {
    setVisibleBlocks(INITIAL_VISIBLE_BLOCKS);
  }, [feed?.generated_at, feed?.stories?.length]);

  const loadSavedSearches = async () => {
    if (!user?.id || !activeTenant?.id) {
      setSavedSearches([]);
      return;
    }

    setHistoryLoading(true);
    try {
      const { data, error: dbError } = await (supabase as any)
        .from('user_feeds')
        .select('id,name,url,created_at')
        .eq('user_id', user.id)
        .eq('tenant_id', activeTenant.id)
        .ilike('url', 'search://newsfeed%')
        .order('created_at', { ascending: false })
        .limit(60);

      if (dbError) throw new Error(dbError.message || 'Falha ao carregar historico');

      const mapped: SavedSearch[] = [];
      for (const row of data || []) {
        const parsed = parseSearchUrl(String(row.url || ''));
        if (!parsed) continue;
        mapped.push({
          id: row.id,
          name: String(row.name || `${parsed.mercado} • ${parsed.nicho}`),
          mercado: parsed.mercado,
          nicho: parsed.nicho,
          created_at: String(row.created_at || new Date().toISOString()),
        });
      }

      const dedup = new Map<string, SavedSearch>();
      for (const item of mapped) {
        const key = `${item.mercado.toLowerCase()}|${item.nicho.toLowerCase()}`;
        if (!dedup.has(key)) dedup.set(key, item);
      }

      setSavedSearches(Array.from(dedup.values()));
    } catch (err) {
      console.error('loadSavedSearches error:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const persistSavedSearch = async (mercadoValue: string, nichoValue: string) => {
    if (!user?.id || !activeTenant?.id) return;

    const searchUrl = buildSearchUrl(mercadoValue, nichoValue);
    const name = `${mercadoValue} • ${nichoValue}`;

    const db = supabase as any;

    const { data: existing } = await db
      .from('user_feeds')
      .select('id')
      .eq('user_id', user.id)
      .eq('tenant_id', activeTenant.id)
      .eq('url', searchUrl)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await db
        .from('user_feeds')
        .update({ name, created_at: new Date().toISOString() })
        .eq('id', existing.id)
        .eq('user_id', user.id)
        .eq('tenant_id', activeTenant.id);
      return;
    }

    const insertRow = async () => {
      return db.from('user_feeds').insert({
        user_id: user.id,
        tenant_id: activeTenant.id,
        name,
        url: searchUrl,
      });
    };

    const { error: insertError } = await insertRow();

    if (!insertError) return;

    const insertMessage = String(insertError.message || '').toLowerCase();
    if (!insertMessage.includes('maximo de 10 feeds')) return;

    const { data: oldest } = await db
      .from('user_feeds')
      .select('id,created_at')
      .eq('user_id', user.id)
      .eq('tenant_id', activeTenant.id)
      .ilike('url', 'search://newsfeed%')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (oldest?.id) {
      await db
        .from('user_feeds')
        .delete()
        .eq('id', oldest.id)
        .eq('user_id', user.id)
        .eq('tenant_id', activeTenant.id);

      await insertRow();
    }
  };

  const fetchFeed = async (
    params?: { mercado?: string; nicho?: string },
    options?: { saveHistory?: boolean },
  ) => {
    const mercadoValue = String(params?.mercado ?? mercado).trim();
    const nichoValue = String(params?.nicho ?? nicho).trim();

    if (!mercadoValue || !nichoValue) return;

    setLoading(true);
    setError(null);

    try {
      const data = await invokeSupabaseFunctionWithRetry<FeedResponse>('search-trends', {
        mercado: mercadoValue,
        nicho: nichoValue,
        tenantId: activeTenant?.id,
        limit: 45,
      });

      const rawStories = (data?.stories || []).filter(isValidStory);
      const unique = deduplicateStories(rawStories);
      const cleaned = unique.map((s) => ({
        ...s,
        title: stripMarkdown(s.title),
        summary: stripMarkdown(s.summary),
      }));
      const stories = deduplicateImages(cleaned);
      const normalized: FeedResponse = {
        generated_at: data?.generated_at || new Date().toISOString(),
        query_context: {
          mercado: mercadoValue,
          nicho: nichoValue,
        },
        total_stories: stories.length,
        stories,
        top_sources: (data?.top_sources || []).length ? data.top_sources : computeTopSources(stories),
        top_topics: (data?.top_topics || []).length ? data.top_topics : computeTopTopics(stories),
      };

      setFeed(normalized);
      try { localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(normalized)); } catch { /* quota */ }

      const shouldSaveHistory = options?.saveHistory !== false;
      if (shouldSaveHistory) {
        await persistSavedSearch(mercadoValue, nichoValue);
        await loadSavedSearches();
      }
    } catch (e: any) {
      console.error('News feed error:', e);
      setError(e?.message || 'Falha ao carregar noticias.');
      setFeed(null);
    } finally {
      setLoading(false);
    }
  };

  const applySavedSearch = async (item: SavedSearch) => {
    setMercado(item.mercado);
    setNicho(item.nicho);
    await fetchFeed({ mercado: item.mercado, nicho: item.nicho }, { saveHistory: false });
  };

  const filteredStories = useMemo(() => {
    if (!feed?.stories?.length) return [];
    if (storyRange === 'all') return feed.stories;
    return feed.stories.filter((s) => {
      if (!s.published_at) return true;
      const date = new Date(s.published_at);
      if (Number.isNaN(date.getTime())) return true;
      return isWithinRange(s.published_at, storyRange);
    });
  }, [feed, storyRange]);

  const hero = useMemo(() => (filteredStories.length ? filteredStories[0] : null), [filteredStories]);
  const remaining = useMemo(() => (filteredStories.length ? filteredStories.slice(1) : []), [filteredStories]);
  const blocks = useMemo(() => splitIntoBlocks(remaining), [remaining]);
  const visibleFeedBlocks = useMemo(() => blocks.slice(0, visibleBlocks), [blocks, visibleBlocks]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1480px] mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-5 rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">News Feed</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Monitoramento continuo com historico de pesquisas salvas.
                </p>
              </div>
              <button
                onClick={() => void fetchFeed()}
                disabled={loading || !mercado.trim() || !nicho.trim()}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Atualizar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
              <InputField label="Mercado" value={mercado} onChange={setMercado} placeholder="Ex: Inteligencia Artificial" />
              <InputField label="Nicho" value={nicho} onChange={setNicho} placeholder="Ex: Negocios digitais e creators" />
              <button
                onClick={() => void fetchFeed()}
                disabled={loading || !mercado.trim() || !nicho.trim()}
                className="h-[42px] mt-auto rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!feed && !loading && !error && (
          <div className="rounded-2xl border border-border/50 bg-card/30 p-12 text-center text-muted-foreground">
            <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-60" />
            <p>Busque um mercado e nicho para montar o feed de noticias.</p>
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-9 space-y-4">
              <div className="h-60 rounded-2xl border border-border/50 bg-card/40 animate-pulse" />
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="h-48 rounded-xl border border-border/40 bg-card/40 animate-pulse" />
              ))}
            </div>
            <div className="lg:col-span-3 space-y-4">
              <div className="h-40 rounded-xl border border-border/40 bg-card/40 animate-pulse" />
              <div className="h-64 rounded-xl border border-border/40 bg-card/40 animate-pulse" />
            </div>
          </div>
        )}

        {feed && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <section className="lg:col-span-9 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {filteredStories.length} de {feed.stories.length} noticias
                </p>
                <div className="flex items-center gap-1">
                  <RangeButton active={storyRange === 'all'} onClick={() => setStoryRange('all')} label="Todas" />
                  <RangeButton active={storyRange === 'week'} onClick={() => setStoryRange('week')} label="Semana" />
                  <RangeButton active={storyRange === 'fortnight'} onClick={() => setStoryRange('fortnight')} label="Quinzena" />
                  <RangeButton active={storyRange === 'month'} onClick={() => setStoryRange('month')} label="Mes" />
                </div>
              </div>

              {filteredStories.length === 0 && (
                <div className="rounded-xl border border-border/50 bg-card/30 p-8 text-center text-muted-foreground">
                  <p>Nenhuma noticia encontrada nesse periodo. Tente ampliar o filtro.</p>
                </div>
              )}

              {hero && <HeroCard story={hero} />}

              {visibleFeedBlocks.map((block, index) => (
                <div key={`${block.feature.id}-${index}`} className="space-y-3">
                  <FeatureCard story={block.feature} />
                  {block.minis.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {block.minis.map((story) => (
                        <MiniCard key={story.id} story={story} />
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {visibleBlocks < blocks.length && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => setVisibleBlocks((prev) => prev + LOAD_MORE_STEP)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary/60 transition-colors"
                  >
                    Carregar mais
                  </button>
                </div>
              )}
            </section>

            <aside className="lg:col-span-3 space-y-4 lg:sticky lg:top-4 h-fit">
              <Panel title="Resumo" icon={<TrendingUp className="w-4 h-4" />}>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p><span className="text-foreground font-medium">Mercado:</span> {feed.query_context.mercado}</p>
                  <p><span className="text-foreground font-medium">Nicho:</span> {feed.query_context.nicho}</p>
                  <p><span className="text-foreground font-medium">Itens:</span> {feed.total_stories}</p>
                  <p><span className="text-foreground font-medium">Atualizado:</span> {formatDate(feed.generated_at)}</p>
                </div>
              </Panel>

              <Panel title="Pesquisas salvas" icon={<History className="w-4 h-4" />}>
                {historyLoading && (
                  <div className="py-3 text-center text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                    Carregando historico...
                  </div>
                )}

                {!historyLoading && savedSearches.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma pesquisa salva.</p>
                )}

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {!historyLoading && savedSearches.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => void applySavedSearch(item)}
                      className="w-full text-left rounded-md border border-border/50 px-2.5 py-2 hover:bg-secondary/50 transition-colors"
                    >
                      <p className="text-xs font-medium text-foreground truncate">{item.mercado} • {item.nicho}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{formatDate(item.created_at)}</p>
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel title="Fontes relevantes" icon={<Newspaper className="w-4 h-4" />}>
                <div className="space-y-2">
                  {feed.top_sources.slice(0, 10).map((source, idx) => (
                    <div key={`${source.name}-${idx}`} className="flex items-center justify-between text-sm">
                      <span className="truncate pr-2 text-foreground">{source.name}</span>
                      <span className="text-muted-foreground">{source.count}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Temas em alta" icon={<Sparkles className="w-4 h-4" />}>
                <div className="flex flex-wrap gap-2">
                  {feed.top_topics.slice(0, 16).map((topic, idx) => (
                    <span key={`${topic.term}-${idx}`} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-xs text-foreground">
                      {topic.term}
                      <span className="text-muted-foreground">{topic.count}</span>
                    </span>
                  ))}
                </div>
              </Panel>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function HeroCard({ story }: { story: Story }) {
  return (
    <article className="rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="p-4 md:p-5 flex flex-col justify-center">
          <MetaLine story={story} />
          <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-tight mb-2">{story.title}</h2>
          <p className="text-sm text-muted-foreground line-clamp-4 mb-4">{story.summary || 'Sem resumo disponivel.'}</p>
          <a href={story.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80">
            Ler materia <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
        <NewsImage story={story} className="w-full h-56 md:h-full min-h-[14rem]" eager />
      </div>
    </article>
  );
}

function FeatureCard({ story }: { story: Story }) {
  return (
    <article className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_0.8fr] gap-0">
        <div className="p-4 flex flex-col justify-center">
          <MetaLine story={story} compact />
          <h3 className="text-[15px] font-semibold text-foreground leading-snug mb-2 line-clamp-2">{story.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{story.summary || 'Sem resumo disponivel.'}</p>
          <a href={story.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80">
            Abrir fonte <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <NewsImage story={story} className="w-full h-44 sm:h-full min-h-[10rem]" />
      </div>
    </article>
  );
}

function MiniCard({ story }: { story: Story }) {
  return (
    <article className="rounded-lg border border-border/50 bg-card/50 overflow-hidden hover:bg-card/70 transition-colors">
      <NewsImage story={story} className="w-full h-28 sm:h-32" />
      <div className="p-2.5">
        <h4 className="text-xs font-medium text-foreground line-clamp-2 mb-1.5">{story.title}</h4>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="truncate pr-2">{story.source}</span>
          <a href={story.url} target="_blank" rel="noopener noreferrer" className="text-primary">Abrir</a>
        </div>
      </div>
    </article>
  );
}

function NewsImage({ story, className, eager = false }: { story: Story; className?: string; eager?: boolean }) {
  const candidates = useMemo(() => imageCandidates(story), [story.image_url, story.url]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const loadedRef = useRef(false);

  const candidateKey = candidates.join('|');

  useEffect(() => {
    setIndex(0);
    setLoaded(false);
    setFailed(false);
    loadedRef.current = false;
  }, [candidateKey]);

  // Timeout: skip candidates that take too long (e.g. thum.io "Generating Preview")
  useEffect(() => {
    if (loadedRef.current || failed || index >= candidates.length) return;

    const timer = setTimeout(() => {
      if (loadedRef.current) return;
      const next = index + 1;
      if (next >= candidates.length) {
        setFailed(true);
      } else {
        setLoaded(false);
        loadedRef.current = false;
        setIndex(next);
      }
    }, 8000);

    return () => clearTimeout(timer);
  }, [index, failed, candidates.length]);

  const handleLoad = () => {
    loadedRef.current = true;
    setLoaded(true);
  };

  const handleError = () => {
    const next = index + 1;
    if (next >= candidates.length) {
      setFailed(true);
    } else {
      setLoaded(false);
      loadedRef.current = false;
      setIndex(next);
    }
  };

  if (!candidates.length || failed) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-secondary via-card to-secondary/60 ${className || ''}`}>
        <Newspaper className="w-8 h-8 text-muted-foreground/20" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-secondary/20 ${className || ''}`}>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-secondary/50 via-secondary/25 to-secondary/50" />
      )}
      <img
        src={candidates[index]}
        alt={story.title}
        className={`w-full h-full object-cover transition-opacity duration-500 ease-out ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}

function MetaLine({ story, compact = false }: { story: Story; compact?: boolean }) {
  return (
    <div className={`mb-2 flex items-center gap-2 ${compact ? 'text-[11px]' : 'text-xs'} text-muted-foreground`}>
      <img
        src={story.source_favicon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(story.source_domain || story.source)}&sz=32`}
        alt={story.source}
        className="w-3.5 h-3.5 rounded-sm"
        loading="lazy"
      />
      <span className="truncate max-w-[220px]">{story.source}</span>
      <span className="opacity-60">•</span>
      <span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" />{formatDate(story.published_at)}</span>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/50 p-4">
      <header className="flex items-center gap-2 mb-3 text-sm font-medium text-foreground">
        {icon}
        <span>{title}</span>
      </header>
      {children}
    </section>
  );
}

function RangeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'border border-border text-foreground hover:bg-secondary/60'
      }`}
    >
      {label}
    </button>
  );
}
