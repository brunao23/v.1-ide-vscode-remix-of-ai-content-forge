import { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  Search, Loader2, AlertTriangle, User, Image, Calendar,
  ListOrdered, Target, Clock,
} from 'lucide-react';
import { PlatformIcon, PLATFORM_LIST } from '@/components/market-research/PlatformIcons';
import { useMarketResearch } from '@/hooks/useMarketResearch';
import { useCompetitors } from '@/hooks/useCompetitors';
import { useAuth } from '@/contexts/AuthContext';
import type {
  SearchFilters, SearchType, Platform, PostType, SortBy, SortOrder, Post,
} from '@/types/marketResearch';
import PostCard from '@/components/market-research/PostCard';
import PostDetailModal from '@/components/market-research/PostDetailModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ResearchProgressBar from '@/components/market-research/ResearchProgressBar';

const PERIOD_OPTIONS = [
  { value: '1', label: 'Último dia' },
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '60', label: 'Últimos 60 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: '365', label: 'Últimos 365 dias' },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'engagement', label: 'Mais engajamento' },
  { value: 'likes', label: 'Mais curtidas' },
  { value: 'comments', label: 'Mais comentários' },
  { value: 'shares', label: 'Mais compartilhamentos' },
  { value: 'views', label: 'Mais visualizações' },
  { value: 'recent', label: 'Mais recentes' },
];

interface RecentSearch {
  searchType: SearchType;
  platform: Platform;
  query: string;
  timestamp: number;
}

function recentKey(userId: string) {
  return `pesquisa-recent-${userId}`;
}

function loadRecent(userId: string): RecentSearch[] {
  try {
    const raw = localStorage.getItem(recentKey(userId));
    return raw ? (JSON.parse(raw) as RecentSearch[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(userId: string, entry: RecentSearch) {
  try {
    const all = loadRecent(userId);
    const dedupeKey = `${entry.searchType}|${entry.platform}|${entry.query}`;
    const filtered = all.filter((r) => `${r.searchType}|${r.platform}|${r.query}` !== dedupeKey);
    const next = [entry, ...filtered].slice(0, 5);
    localStorage.setItem(recentKey(userId), JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

function ConnectorRow({ icon, label, description, children }: { icon: ReactNode; label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-5">
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function IconCircle({ children }: { children: ReactNode }) {
  return (
    <div className="w-9 h-9 rounded-[8px] bg-secondary/60 flex items-center justify-center shrink-0">
      {children}
    </div>
  );
}

function RowDivider() {
  return <div className="border-t border-border/30" />;
}

export default function PesquisaPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const userId = user?.id || '';

  const {
    posts, response, loading, loadingMore, error,
    sortBy, sortOrder, setSortBy, setSortOrder,
    search, loadMore, hasMore,
  } = useMarketResearch();

  const { isCompetitor, markAsCompetitor } = useCompetitors();

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [tab, setTab] = useState<SearchType>('profile');
  const [transitioning, setTransitioning] = useState(false);
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [username, setUsername] = useState('');
  const [keyword, setKeyword] = useState('');
  const [postType, setPostType] = useState<PostType>('all');
  const [periodDays, setPeriodDays] = useState(30);
  const [resultsLimit, setResultsLimit] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    if (userId) setRecentSearches(loadRecent(userId));
  }, [userId]);

  const switchTab = (next: SearchType) => {
    if (next === tab || transitioning) return;
    setTransitioning(true);
    setTimeout(() => {
      setTab(next);
      if (next === 'profile') setKeyword('');
      else setUsername('');
      setTransitioning(false);
    }, 180);
  };

  const isYouTube = platform === 'youtube';
  const isTikTok = platform === 'tiktok';

  const postTypeOptions = platform === 'instagram'
    ? [
        { value: 'all', label: 'Todos' },
        { value: 'carousel', label: 'Carrossel' },
        { value: 'reels', label: 'Reels' },
        { value: 'image', label: 'Imagem' },
        { value: 'video', label: 'Vídeo' },
      ]
    : platform === 'tiktok'
    ? [{ value: 'all', label: 'Todos' }, { value: 'video', label: 'Vídeo' }]
    : [{ value: 'video', label: 'Vídeo' }];

  const profileLabel = isYouTube ? 'Pesquisa Canal' : 'Pesquisa de Perfil';
  const keywordLabel = isYouTube ? 'Pesquisa Vídeos' : 'Pesquisa de Palavra-chave';
  const userFieldLabel = isYouTube ? 'Canal' : 'Usuário';
  const userFieldDesc = isYouTube ? 'Handle ou nome do canal' : isTikTok ? 'Nome de usuário do TikTok' : 'Nome de usuário ou URL do perfil';
  const userFieldPlaceholder = isYouTube ? '@canal ou nome' : '@username';
  const limitMax = isYouTube ? 50 : 20;
  const contentLabel = isYouTube ? 'vídeos' : 'posts';

  const handleSearch = useCallback(async (overrideTab?: SearchType, overridePlatform?: Platform, overrideQuery?: string) => {
    const activeTab = overrideTab ?? tab;
    const activePlatform = overridePlatform ?? platform;
    const query = overrideQuery ?? (activeTab === 'profile' ? username.trim() : keyword.trim());
    if (isSearching || loading || !query) return;

    setIsSearching(true);
    setHasSearched(true);
    const limitNum = resultsLimit ? Math.min(limitMax, Math.max(1, parseInt(resultsLimit, 10) || 20)) : 20;

    const filters: SearchFilters = {
      searchType: activeTab,
      platform: activePlatform,
      username: activeTab === 'profile' ? query : '',
      keyword: activeTab === 'keyword' ? query : '',
      postType,
      periodDays,
      resultsLimit: limitNum,
    };

    try {
      await search(filters);
      if (userId) {
        const updated = saveRecent(userId, { searchType: activeTab, platform: activePlatform, query, timestamp: Date.now() });
        setRecentSearches(updated);
      }
    } finally {
      setIsSearching(false);
    }
  }, [tab, platform, username, keyword, isSearching, loading, resultsLimit, limitMax, postType, periodDays, search, userId]);

  const applyRecent = (r: RecentSearch) => {
    setTab(r.searchType);
    setPlatform(r.platform);
    if (r.searchType === 'profile') { setUsername(r.query); setKeyword(''); }
    else { setKeyword(r.query); setUsername(''); }
    void handleSearch(r.searchType, r.platform, r.query);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <h2 className="text-2xl text-foreground" style={{ fontFamily: "'ITC Garamond Std Lt Cond', serif" }}>
            Pesquisa
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Pesquise perfis ou palavras-chave e marque os resultados mais relevantes como concorrentes.
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => switchTab('profile')}
            className={`text-sm pb-1.5 transition-colors border-b-2 ${
              tab === 'profile'
                ? 'text-foreground font-medium border-foreground'
                : 'text-muted-foreground border-transparent hover:text-foreground/70'
            }`}
          >
            {profileLabel}
          </button>
          <button
            onClick={() => switchTab('keyword')}
            className={`text-sm pb-1.5 transition-colors border-b-2 ${
              tab === 'keyword'
                ? 'text-foreground font-medium border-foreground'
                : 'text-muted-foreground border-transparent hover:text-foreground/70'
            }`}
          >
            {keywordLabel}
          </button>
        </div>

        {/* Search form */}
        <div className="space-y-0">
          <ConnectorRow
            icon={<PlatformIcon platform={platform} size={36} />}
            label="Plataforma"
            description="Rede social para pesquisa"
          >
            <Select
              value={platform}
              onValueChange={(v) => { setPlatform(v as Platform); setPostType(v === 'youtube' ? 'video' : 'all'); }}
            >
              <SelectTrigger className="h-9 w-auto min-w-[130px] rounded-lg border border-border/60 bg-transparent hover:bg-secondary/30 text-sm text-foreground focus:ring-0 focus:ring-offset-0 gap-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[220px]">
                {PLATFORM_LIST.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex items-center gap-2.5">
                      <PlatformIcon platform={p.value} size={24} />
                      <span>{p.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ConnectorRow>

          <RowDivider />

          {/* Animated input row */}
          <div
            className="transition-all duration-[180ms] ease-out"
            style={{
              opacity: transitioning ? 0 : 1,
              transform: transitioning ? 'translateY(4px)' : 'translateY(0)',
            }}
          >
            {tab === 'profile' ? (
              <ConnectorRow
                icon={<IconCircle><User className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} /></IconCircle>}
                label={userFieldLabel}
                description={userFieldDesc}
              >
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={userFieldPlaceholder}
                  className="h-9 px-3 rounded-lg border border-border/60 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 transition-colors w-[200px]"
                  onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
                />
              </ConnectorRow>
            ) : (
              <ConnectorRow
                icon={<IconCircle><Search className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} /></IconCircle>}
                label="Palavra-chave"
                description="Termo para buscar conteúdo"
              >
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Ex: marketing digital"
                  className="h-9 px-3 rounded-lg border border-border/60 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 transition-colors w-[200px]"
                  onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
                />
              </ConnectorRow>
            )}
          </div>

          <RowDivider />

          <ConnectorRow
            icon={<IconCircle><Image className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} /></IconCircle>}
            label={isYouTube ? 'Tipo de Conteúdo' : 'Tipo de Post'}
            description={isYouTube ? 'Formato do conteúdo' : 'Filtrar por formato de conteúdo'}
          >
            <Select value={postType} onValueChange={(v) => setPostType(v as PostType)}>
              <SelectTrigger className="h-9 w-auto min-w-[130px] rounded-lg border border-border/60 bg-transparent hover:bg-secondary/30 text-sm text-foreground focus:ring-0 focus:ring-offset-0 gap-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {postTypeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ConnectorRow>

          <RowDivider />

          <ConnectorRow
            icon={<IconCircle><Calendar className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} /></IconCircle>}
            label="Período"
            description="Intervalo de tempo da pesquisa"
          >
            <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
              <SelectTrigger className="h-9 w-auto min-w-[160px] rounded-lg border border-border/60 bg-transparent hover:bg-secondary/30 text-sm text-foreground focus:ring-0 focus:ring-offset-0 gap-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ConnectorRow>

          <RowDivider />

          <ConnectorRow
            icon={<IconCircle><ListOrdered className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} /></IconCircle>}
            label={isYouTube ? 'Limite de vídeos' : 'Limite de posts'}
            description={isYouTube ? 'Máximo de resultados (1-50)' : 'Máximo de resultados (1-20)'}
          >
            <input
              type="number"
              min={1}
              max={limitMax}
              value={resultsLimit}
              onChange={(e) => setResultsLimit(e.target.value)}
              placeholder="20"
              className="h-9 px-3 rounded-lg border border-border/60 bg-transparent text-sm text-foreground text-center placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 transition-colors w-[72px]"
            />
          </ConnectorRow>
        </div>

        <div className="flex items-start justify-between gap-4">
          {/* Recent searches */}
          <div className="flex-1 flex flex-wrap gap-2">
            {recentSearches.map((r, i) => (
              <button
                key={i}
                onClick={() => applyRecent(r)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/50 bg-secondary/40 hover:bg-secondary/70 text-xs text-muted-foreground transition-colors"
              >
                <Clock className="w-3 h-3 shrink-0" />
                <PlatformIcon platform={r.platform} size={12} />
                <span className="truncate max-w-[120px]">{r.query}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => void handleSearch()}
            disabled={isSearching || loading}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {(isSearching || loading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" strokeWidth={1.5} />}
            {(isSearching || loading) ? 'Processando...' : 'Pesquisar'}
          </button>
        </div>

        <ResearchProgressBar active={isSearching || loading} />

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />
              {error}
            </p>
          </div>
        )}

        {!hasSearched && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-14 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-secondary/60 flex items-center justify-center">
              <Search className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-muted-foreground">
              Configure os filtros e clique em "Pesquisar"
            </p>
          </div>
        )}

        {posts.length > 0 && !loading && (
          <>
            <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'}`}>
              <p className="text-xs text-muted-foreground">
                {response?.pagination?.total || posts.length} {contentLabel} encontrados
              </p>
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                  <SelectTrigger className="w-auto min-w-[160px] border-0 bg-secondary/40 hover:bg-secondary/60 h-8 text-xs text-foreground focus:ring-0 focus:ring-offset-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
                  <SelectTrigger className="w-auto min-w-[80px] border-0 bg-secondary/40 hover:bg-secondary/60 h-8 text-xs text-foreground focus:ring-0 focus:ring-offset-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Desc</SelectItem>
                    <SelectItem value="asc">Asc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {posts.map((post) => (
                <div key={post.id} className="relative group">
                  <PostCard post={post} onClick={() => setSelectedPost(post)} />
                  <button
                    onClick={(e) => { e.stopPropagation(); void markAsCompetitor(post); }}
                    className={`absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium backdrop-blur-sm transition-colors ${
                      isCompetitor(post.id)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background/80 text-muted-foreground hover:bg-primary/20 hover:text-primary opacity-0 group-hover:opacity-100'
                    }`}
                    title={isCompetitor(post.id) ? 'Remover dos concorrentes' : 'Marcar como concorrente'}
                  >
                    <Target className="w-3 h-3" />
                    {isCompetitor(post.id) ? 'Concorrente' : 'Marcar'}
                  </button>
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg border border-border/40 hover:bg-secondary/40 transition-colors text-xs text-muted-foreground disabled:opacity-50"
                >
                  {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {loadingMore ? 'Carregando...' : 'Carregar mais'}
                </button>
              </div>
            )}
          </>
        )}

        {!loading && !error && hasSearched && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
            <p className="text-sm text-foreground">Nenhum {isYouTube ? 'vídeo' : 'post'} encontrado</p>
            <p className="text-xs text-muted-foreground">
              Tente aumentar o período da busca, ajustar os filtros ou pesquisar outro perfil.
            </p>
          </div>
        )}
      </div>

      <PostDetailModal
        post={selectedPost}
        open={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        onSave={() => {}}
        isSaved={false}
      />
    </div>
  );
}
