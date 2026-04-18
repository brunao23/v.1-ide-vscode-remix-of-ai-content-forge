import { useState, type ReactNode } from 'react';
import {
  ArrowLeft, Search, Loader2, AlertTriangle, User,
  Bookmark, Clock, Trash2, Target, Sparkles,
  TrendingUp, Star, BarChart2,
} from 'lucide-react';
import { PlatformIcon, PLATFORM_LIST } from '@/components/market-research/PlatformIcons';
import { useMarketResearch } from '@/hooks/useMarketResearch';
import { useCompetitors } from '@/hooks/useCompetitors';
import { fetchSbStats, type SbStats, type SbPlatform } from '@/services/socialBladeApi';
import { useGeminiAnalysis } from '@/hooks/useGeminiAnalysis';
import GeminiAnalysisPanel from '@/components/market-research/GeminiAnalysisPanel';
import type {
  SearchFilters, SearchType, Platform, PostType, SortBy, SortOrder,
  Post, ProfileMetadata, SearchResponse,
} from '@/types/marketResearch';
import PostCard from '@/components/market-research/PostCard';
import PostDetailModal from '@/components/market-research/PostDetailModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ResearchProgressBar from '@/components/market-research/ResearchProgressBar';
import { proxyImageUrl } from '@/lib/utils';

type PageView = 'search' | 'feed' | 'competitors' | 'favorites';

const PERIOD_OPTIONS = [
  { value: '1', label: 'Ultimo dia' },
  { value: '7', label: 'Ultimos 7 dias' },
  { value: '30', label: 'Ultimos 30 dias' },
  { value: '60', label: 'Ultimos 60 dias' },
  { value: '90', label: 'Ultimos 90 dias' },
  { value: '365', label: 'Ultimos 365 dias' },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'engagement', label: 'Mais engajamento' },
  { value: 'likes', label: 'Mais curtidas' },
  { value: 'comments', label: 'Mais comentarios' },
  { value: 'shares', label: 'Mais compartilhamentos' },
  { value: 'views', label: 'Mais visualizacoes' },
  { value: 'recent', label: 'Mais recentes' },
];

interface Props {
  onBack: () => void;
}

function daysRemaining(savedAt: string): number {
  const saved = new Date(savedAt).getTime();
  const expires = saved + 7 * 86_400_000;
  const remaining = Math.ceil((expires - Date.now()) / 86_400_000);
  return Math.max(0, remaining);
}

export default function MarketResearchPage({ onBack }: Props) {
  const isMobile = useIsMobile();
  const {
    posts,
    response,
    loading,
    loadingMore,
    error,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    search,
    loadMore,
    savePost,
    isPostSaved,
    savedPosts,
    savedPostsLoading,
    hasMore,
  } = useMarketResearch();

  const [pageView, setPageView] = useState<PageView>('search');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // Search form state (persists across tab switches, used in CompetitorsView)
  const [tab, setTab] = useState<SearchType>('profile');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [username, setUsername] = useState('');
  const [keyword, setKeyword] = useState('');
  const [postType, setPostType] = useState<PostType>('all');
  const [periodDays, setPeriodDays] = useState(30);
  const [resultsLimit, setResultsLimit] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearchedCompetitors, setHasSearchedCompetitors] = useState(false);

  const postTypeOptions = platform === 'instagram'
    ? [
        { value: 'all', label: 'Todos' },
        { value: 'carousel', label: 'Carrossel' },
        { value: 'reels', label: 'Reels' },
        { value: 'image', label: 'Imagem' },
        { value: 'video', label: 'Video' },
      ]
    : platform === 'tiktok'
    ? [
        { value: 'all', label: 'Todos' },
        { value: 'video', label: 'Video' },
      ]
    : [{ value: 'video', label: 'Video' }];

  const isYouTube = platform === 'youtube';
  const isTikTok = platform === 'tiktok';
  const profileLabel = isYouTube ? 'Pesquisa Canal' : 'Pesquisa Perfil';
  const keywordLabel = isYouTube ? 'Pesquisa Videos' : 'Pesquisa Palavra-chave';
  const userFieldLabel = isYouTube ? 'Canal' : 'Usuario';
  const userFieldDesc = isYouTube ? 'Handle ou nome do canal' : isTikTok ? 'Nome de usuario do TikTok' : 'Nome de usuario ou URL do perfil';
  const userFieldPlaceholder = isYouTube ? '@canal ou nome' : isTikTok ? '@username' : '@username';
  const contentLabel = isYouTube ? 'videos' : 'posts';
  const limitLabel = isYouTube ? 'Limite de videos' : 'Limite de posts';
  const limitDesc = 'Maximo de resultados (1-50)';
  const limitMax = 50;

  const handleSearch = async () => {
    if (isSearching || loading) return;
    const inputValue = tab === 'profile' ? username.trim() : keyword.trim();
    if (!inputValue) return;

    setIsSearching(true);
    setHasSearchedCompetitors(true);
    const limitNum = resultsLimit ? Math.min(limitMax, Math.max(1, parseInt(resultsLimit, 10) || 20)) : 20;

    const filters: SearchFilters = {
      searchType: tab,
      platform,
      username,
      keyword,
      postType,
      periodDays,
      resultsLimit: limitNum,
    };

    try {
      await search(filters);
    } finally {
      setIsSearching(false);
    }
  };

  const searched = hasSearchedCompetitors;

  return (
    <div className="flex-1 flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" strokeWidth={1.5} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-foreground">Pesquisa de Mercado</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Analise seu perfil, favoritos e concorrentes do seu nicho
            </p>
          </div>
        </div>

        {/* Page tabs */}
        <div className="flex items-center gap-1 mt-4 overflow-x-auto">
          <button
            onClick={() => setPageView('search')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
              pageView === 'search'
                ? 'bg-secondary text-foreground font-medium'
                : 'text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            <Search className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            Pesquisa
          </button>
          <button
            onClick={() => setPageView('feed')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
              pageView === 'feed'
                ? 'bg-secondary text-foreground font-medium'
                : 'text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            <User className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            Meu Feed
          </button>
          <button
            onClick={() => setPageView('competitors')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
              pageView === 'competitors'
                ? 'bg-secondary text-foreground font-medium'
                : 'text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            <Target className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            Análise de Concorrentes
          </button>
          <button
            onClick={() => setPageView('favorites')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
              pageView === 'favorites'
                ? 'bg-secondary text-foreground font-medium'
                : 'text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            <Bookmark className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            Favoritos
            {savedPosts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                {savedPosts.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {pageView === 'search' && (
          <SearchView
            isMobile={isMobile}
            posts={posts}
            response={response}
            loading={loading}
            loadingMore={loadingMore}
            error={error}
            sortBy={sortBy}
            sortOrder={sortOrder}
            setSortBy={setSortBy}
            setSortOrder={setSortOrder}
            loadMore={loadMore}
            hasMore={hasMore}
            searched={searched}
            isSearching={isSearching}
            tab={tab}
            setTab={setTab}
            platform={platform}
            setPlatform={(p) => { setPlatform(p); setPostType(p === 'youtube' ? 'video' : 'all'); }}
            username={username}
            setUsername={setUsername}
            keyword={keyword}
            setKeyword={setKeyword}
            postType={postType}
            setPostType={setPostType}
            periodDays={periodDays}
            setPeriodDays={setPeriodDays}
            resultsLimit={resultsLimit}
            setResultsLimit={setResultsLimit}
            handleSearch={handleSearch}
            setSelectedPost={setSelectedPost}
            postTypeOptions={postTypeOptions}
            isYouTube={isYouTube}
            profileLabel={profileLabel}
            keywordLabel={keywordLabel}
            userFieldLabel={userFieldLabel}
            userFieldDesc={userFieldDesc}
            userFieldPlaceholder={userFieldPlaceholder}
            contentLabel={contentLabel}
            limitLabel={limitLabel}
            limitDesc={limitDesc}
            limitMax={limitMax}
          />
        )}
        {pageView === 'feed' && (
          <FeedView isMobile={isMobile} setSelectedPost={setSelectedPost} />
        )}
        {pageView === 'competitors' && (
          <SavedCompetitorsView setSelectedPost={setSelectedPost} />
        )}
        {pageView === 'favorites' && (
          <FavoritesView
            isMobile={isMobile}
            savedPosts={savedPosts}
            savedPostsLoading={savedPostsLoading}
            setSelectedPost={setSelectedPost}
            savePost={savePost}
          />
        )}
      </div>

      <PostDetailModal
        post={selectedPost}
        open={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        onSave={savePost}
        isSaved={selectedPost ? isPostSaved(selectedPost.id) : false}
      />
    </div>
  );
}

/* ─── Feed View (Social Blade) ─── */
const FEED_CONFIG_KEY = 'meu-feed-config';
const FEED_STATS_KEY = 'meu-feed-stats';
const FEED_HISTORY_KEY = 'meu-feed-history';
const FEED_HISTORY_MAX = 5;

type FeedHistoryEntry = SbStats & { searchedAt: string };

function loadHistory(): FeedHistoryEntry[] {
  try {
    const raw = localStorage.getItem(FEED_HISTORY_KEY);
    if (raw) return JSON.parse(raw) as FeedHistoryEntry[];
  } catch {}
  return [];
}

function saveHistory(entry: SbStats, prev: FeedHistoryEntry[]): FeedHistoryEntry[] {
  const filtered = prev.filter((e) => !(e.platform === entry.platform && e.username === entry.username));
  const next = [{ ...entry, searchedAt: new Date().toISOString() }, ...filtered].slice(0, FEED_HISTORY_MAX);
  try { localStorage.setItem(FEED_HISTORY_KEY, JSON.stringify(next)); } catch {}
  return next;
}

function fmtNum(n: number | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('pt-BR');
}

function BigStatCard({ label, value, icon, highlight }: { label: string; value: string; icon: ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 space-y-1 ${highlight ? 'border-foreground/20 bg-secondary/60' : 'border-border/40 bg-card/50'}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <span className="text-muted-foreground/40">{icon}</span>
      </div>
      <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function SbStatsDisplay({ stats }: { stats: SbStats }) {
  const isYT = stats.platform === 'youtube';
  const gradeStyle = stats.gradeColor
    ? { backgroundColor: stats.gradeColor + '22', color: stats.gradeColor, borderColor: stats.gradeColor + '55' }
    : {};

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <div className="flex items-center gap-4 p-4 rounded-2xl border border-border/40 bg-card/50">
        {stats.avatar
          ? <img src={stats.avatar} alt={stats.displayName} className="w-14 h-14 rounded-full object-cover ring-2 ring-border/40" />
          : <div className="w-14 h-14 rounded-full bg-secondary/60 flex items-center justify-center"><User className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} /></div>
        }
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-foreground truncate">{stats.displayName || stats.username}</p>
          <p className="text-sm text-muted-foreground">@{stats.username}</p>
        </div>
        {stats.grade && (
          <div className="px-4 py-1.5 rounded-full border text-base font-bold shrink-0" style={gradeStyle}>
            {stats.grade}
          </div>
        )}
      </div>

      {/* Main stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <BigStatCard
          label={isYT ? 'Inscritos' : 'Seguidores'}
          value={fmtNum(stats.followers)}
          icon={<TrendingUp className="w-4 h-4" strokeWidth={1.5} />}
          highlight
        />
        {stats.following != null && (
          <BigStatCard label="Seguindo" value={fmtNum(stats.following)} icon={<User className="w-4 h-4" strokeWidth={1.5} />} />
        )}
        <BigStatCard
          label={isYT ? 'Vídeos' : 'Publicações'}
          value={fmtNum(stats.uploads)}
          icon={<BarChart2 className="w-4 h-4" strokeWidth={1.5} />}
        />
        {stats.totalViews != null && (
          <BigStatCard label="Views Totais" value={fmtNum(stats.totalViews)} icon={<BarChart2 className="w-4 h-4" strokeWidth={1.5} />} />
        )}
        {stats.totalLikes != null && (
          <BigStatCard label="Likes Totais" value={fmtNum(stats.totalLikes)} icon={<Star className="w-4 h-4" strokeWidth={1.5} />} />
        )}
        {stats.rankSb != null && (
          <BigStatCard label="Rank Social Blade" value={`#${stats.rankSb.toLocaleString('pt-BR')}`} icon={<Star className="w-4 h-4" strokeWidth={1.5} />} />
        )}
        {stats.rankPrimary != null && (
          <BigStatCard
            label={isYT ? 'Rank Inscritos' : 'Rank Seguidores'}
            value={`#${stats.rankPrimary.toLocaleString('pt-BR')}`}
            icon={<Star className="w-4 h-4" strokeWidth={1.5} />}
          />
        )}
      </div>

      {/* Monthly averages */}
      {(stats.avgFollowersMonthly != null || stats.avgUploadsMonthly != null || stats.avgViewsMonthly != null) && (
        <div className="rounded-2xl border border-border/40 bg-card/50 p-5 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Crescimento — últimos 30 dias</p>
          <div className="grid grid-cols-3 gap-4">
            {stats.avgFollowersMonthly != null && (
              <div>
                <p className="text-2xl font-semibold text-foreground">{fmtNum(stats.avgFollowersMonthly)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{isYT ? 'Inscritos/mês' : 'Seguidores/mês'}</p>
              </div>
            )}
            {stats.avgUploadsMonthly != null && (
              <div>
                <p className="text-2xl font-semibold text-foreground">{fmtNum(stats.avgUploadsMonthly)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{isYT ? 'Vídeos/mês' : 'Posts/mês'}</p>
              </div>
            )}
            {stats.avgViewsMonthly != null && (
              <div>
                <p className="text-2xl font-semibold text-foreground">{fmtNum(stats.avgViewsMonthly)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Views/mês</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FeedView({ isMobile }: { isMobile: boolean; setSelectedPost: (p: Post) => void }) {
  const [config, setConfig] = useState<{ platform: SbPlatform; username: string }>(() => {
    try {
      const saved = localStorage.getItem(FEED_CONFIG_KEY);
      if (saved) {
        const p = JSON.parse(saved) as Partial<{ platform: SbPlatform; username: string }>;
        return { platform: p.platform ?? 'instagram', username: p.username ?? '' };
      }
    } catch {}
    return { platform: 'instagram', username: '' };
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SbStats | null>(() => {
    try {
      const saved = localStorage.getItem(FEED_STATS_KEY);
      if (saved) return JSON.parse(saved) as SbStats;
    } catch {}
    return null;
  });
  const [history, setHistory] = useState<FeedHistoryEntry[]>(() => loadHistory());

  const saveConfig = (next: typeof config) => {
    setConfig(next);
    try { localStorage.setItem(FEED_CONFIG_KEY, JSON.stringify(next)); } catch {}
  };

  const applyStats = (s: SbStats | null) => {
    setStats(s);
    try {
      if (s) localStorage.setItem(FEED_STATS_KEY, JSON.stringify(s));
      else localStorage.removeItem(FEED_STATS_KEY);
    } catch {}
  };

  const handleSearch = async () => {
    if (loading || !config.username.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSbStats(config.platform, config.username.trim());
      applyStats(result);
      setHistory((prev) => saveHistory(result, prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadFromHistory = (entry: FeedHistoryEntry) => {
    saveConfig({ platform: entry.platform, username: entry.username });
    applyStats(entry);
    setError(null);
  };

  const isYouTube = config.platform === 'youtube';
  const isTikTok = config.platform === 'tiktok';

  return (
    <div className={`flex gap-6 px-6 py-8 ${isMobile ? 'flex-col' : 'flex-row items-start'}`}>
      {/* Left panel — search */}
      <div className="shrink-0 space-y-4" style={{ width: isMobile ? '100%' : '260px' }}>
        <div>
          <h2 className="text-xl text-foreground mb-1" style={{ fontFamily: "'ITC Garamond Std Lt Cond', serif" }}>Meu Feed</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">Métricas do seu perfil via Social Blade.</p>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card/50 p-4 space-y-4">
          {/* Platform */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Plataforma</p>
            <Select
              value={config.platform}
              onValueChange={(v) => saveConfig({ ...config, platform: v as SbPlatform })}
            >
              <SelectTrigger className="h-9 w-full rounded-lg border border-border/60 bg-transparent text-sm text-foreground focus:ring-0 focus:ring-offset-0 gap-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_LIST.filter((p) => ['instagram', 'youtube', 'tiktok'].includes(p.value)).map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={p.value} size={20} />
                      <span>{p.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{isYouTube ? 'Canal' : 'Usuário'}</p>
            <input
              type="text"
              value={config.username}
              onChange={(e) => saveConfig({ ...config, username: e.target.value })}
              placeholder={isYouTube ? '@canal ou nome' : isTikTok ? '@username' : '@username'}
              className="h-9 w-full px-3 rounded-lg border border-border/60 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
            />
          </div>

          <button
            onClick={() => void handleSearch()}
            disabled={loading || !config.username.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" strokeWidth={1.5} />}
            {loading ? 'Buscando...' : 'Buscar Perfil'}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              {error}
            </p>
          </div>
        )}

        {/* Recent searches history */}
        {history.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-0.5">Pesquisas recentes</p>
            <div className="space-y-1">
              {history.map((entry) => (
                <button
                  key={`${entry.platform}-${entry.username}`}
                  onClick={() => loadFromHistory(entry)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-secondary/60 transition-colors text-left group"
                >
                  {entry.avatar
                    ? <img src={entry.avatar} alt={entry.displayName} className="w-7 h-7 rounded-full object-cover shrink-0" />
                    : <div className="w-7 h-7 rounded-full bg-secondary/60 flex items-center justify-center shrink-0"><User className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{entry.displayName || entry.username}</p>
                    <p className="text-[10px] text-muted-foreground truncate capitalize">{entry.platform}</p>
                  </div>
                  <PlatformIcon platform={entry.platform} size={14} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right panel — stats */}
      <div className="flex-1 min-w-0">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!stats && !loading && (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-secondary/60 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-muted-foreground">Configure seu usuário e clique em "Buscar Perfil"</p>
          </div>
        )}
        {stats && !loading && <SbStatsDisplay stats={stats} />}
      </div>
    </div>
  );
}

/* ─── Favorites View ─── */
function FavoritesView({
  isMobile,
  savedPosts,
  savedPostsLoading,
  setSelectedPost,
  savePost,
}: {
  isMobile: boolean;
  savedPosts: (Post & { saved_at: string })[];
  savedPostsLoading: boolean;
  setSelectedPost: (p: Post) => void;
  savePost: (p: Post) => void;
}) {
  const savedPostIds = savedPosts.map((p) => p.id);
  const { analyzePost, getAnalysis, isAnalyzing, hasAnalysis } = useGeminiAnalysis(savedPostIds);
  const [analysisPostId, setAnalysisPostId] = useState<string | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const openAnalysis = (postId: string) => {
    setAnalysisPostId(postId);
    setAnalysisOpen(true);
  };

  const activeAnalysis = analysisPostId ? getAnalysis(analysisPostId) : null;

  return (
    <div className="max-w-[720px] mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-foreground">Posts Salvos</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Posts ficam salvos por 7 dias. Use o Gemini AI para analisar o conteudo de cada post.
          </p>
        </div>
        {savedPosts.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {savedPosts.length} salvo{savedPosts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {savedPostsLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!savedPostsLoading && savedPosts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-secondary/60 flex items-center justify-center">
            <Bookmark className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-muted-foreground">Nenhum post salvo ainda</p>
          <p className="text-xs text-muted-foreground max-w-[280px]">
            Pesquise conteudo e clique em "Salvar" para guardar posts de referencia aqui por ate 7 dias
          </p>
        </div>
      )}

      {!savedPostsLoading && savedPosts.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {savedPosts.map((post) => {
            const days = daysRemaining(post.saved_at);
            const analyzing = isAnalyzing(post.id);
            const analyzed = hasAnalysis(post.id);
            const a = getAnalysis(post.id);
            const hasError = a?.status === 'error';

            return (
              <div key={post.id} className="relative group">
                <PostCard post={post} onClick={() => setSelectedPost(post)} />

                {/* Expiry badge + remove */}
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                  <span className={`pointer-events-auto flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium backdrop-blur-sm ${
                    days <= 1 ? 'bg-destructive/80 text-white' : 'bg-background/80 text-muted-foreground'
                  }`}>
                    <Clock className="w-3 h-3" />
                    {days <= 0 ? 'Expirando' : days === 1 ? '1 dia' : `${days} dias`}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); void savePost(post); }}
                    className="pointer-events-auto p-1 rounded bg-background/80 backdrop-blur-sm hover:bg-destructive/80 hover:text-white text-muted-foreground transition-colors opacity-0 group-hover:opacity-100"
                    title="Remover dos salvos"
                    aria-label="Remover dos salvos"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Gemini analyze / view button */}
                <div className="absolute bottom-2 right-2">
                  {analyzing ? (
                    <div className="p-1.5 rounded-lg bg-background/80 backdrop-blur-sm">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    </div>
                  ) : analyzed ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); openAnalysis(post.id); }}
                      className="p-1.5 rounded-lg bg-primary/15 text-primary backdrop-blur-sm hover:bg-primary/25 transition-colors"
                      title="Ver análise Gemini"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  ) : hasError ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); void analyzePost(post); }}
                      className="p-1.5 rounded-lg bg-orange-500/15 text-orange-500 backdrop-blur-sm hover:bg-orange-500/25 transition-colors"
                      title="Erro na análise — clique para tentar novamente"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); void analyzePost(post); }}
                      className="p-1.5 rounded-lg bg-primary/10 text-primary backdrop-blur-sm hover:bg-primary/25 transition-colors"
                      title="Analisar com Gemini AI"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <GeminiAnalysisPanel
        open={analysisOpen}
        onClose={() => setAnalysisOpen(false)}
        analysis={activeAnalysis}
      />
    </div>
  );
}

/* ─── Search View ─── */
function SearchView({
  isMobile,
  posts,
  response,
  loading,
  loadingMore,
  error,
  sortBy,
  sortOrder,
  setSortBy,
  setSortOrder,
  loadMore,
  hasMore,
  searched,
  isSearching,
  tab,
  setTab,
  platform,
  setPlatform,
  username,
  setUsername,
  keyword,
  setKeyword,
  postType,
  setPostType,
  periodDays,
  setPeriodDays,
  resultsLimit,
  setResultsLimit,
  handleSearch,
  setSelectedPost,
  postTypeOptions,
  isYouTube,
  profileLabel,
  keywordLabel,
  userFieldLabel,
  userFieldDesc,
  userFieldPlaceholder,
  contentLabel,
  limitLabel,
  limitDesc,
  limitMax,
}: {
  isMobile: boolean;
  posts: Post[];
  response: SearchResponse | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  sortBy: SortBy;
  sortOrder: SortOrder;
  setSortBy: (v: SortBy) => void;
  setSortOrder: (v: SortOrder) => void;
  loadMore: () => void;
  hasMore: boolean;
  searched: boolean;
  isSearching: boolean;
  tab: SearchType;
  setTab: (v: SearchType) => void;
  platform: Platform;
  setPlatform: (v: Platform) => void;
  username: string;
  setUsername: (v: string) => void;
  keyword: string;
  setKeyword: (v: string) => void;
  postType: PostType;
  setPostType: (v: PostType) => void;
  periodDays: number;
  setPeriodDays: (v: number) => void;
  resultsLimit: string;
  setResultsLimit: (v: string) => void;
  handleSearch: () => void;
  setSelectedPost: (p: Post) => void;
  postTypeOptions: { value: string; label: string }[];
  isYouTube: boolean;
  profileLabel: string;
  keywordLabel: string;
  userFieldLabel: string;
  userFieldDesc: string;
  userFieldPlaceholder: string;
  contentLabel: string;
  limitLabel: string;
  limitDesc: string;
  limitMax: number;
}) {
  const { isCompetitor, markAsCompetitor } = useCompetitors();

  return (
    <div className={`flex gap-6 px-6 py-8 ${isMobile ? 'flex-col' : 'flex-row items-start'}`}>
      {/* Left panel — form */}
      <div className="shrink-0 space-y-4" style={{ width: isMobile ? '100%' : '280px' }}>
        <div>
          <h2 className="text-xl text-foreground mb-1" style={{ fontFamily: "'ITC Garamond Std Lt Cond', serif" }}>Pesquisa</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">Perfis e palavras-chave no YouTube, Instagram e TikTok.</p>
        </div>

        {/* Profile / Keyword tab switcher */}
        <div className="flex rounded-lg bg-secondary/40 p-1 gap-1">
          <button
            onClick={() => setTab('profile')}
            className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-medium ${
              tab === 'profile' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {profileLabel}
          </button>
          <button
            onClick={() => setTab('keyword')}
            className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-medium ${
              tab === 'keyword' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {keywordLabel}
          </button>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card/50 p-4 space-y-4">
          {/* Platform */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Plataforma</p>
            <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
              <SelectTrigger className="h-9 w-full rounded-lg border border-border/60 bg-transparent text-sm text-foreground focus:ring-0 focus:ring-offset-0 gap-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_LIST.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={p.value} size={20} />
                      <span>{p.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Username or keyword */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {tab === 'profile' ? userFieldLabel : 'Palavra-chave'}
            </p>
            {tab === 'profile' ? (
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={userFieldPlaceholder}
                className="h-9 w-full px-3 rounded-lg border border-border/60 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
              />
            ) : (
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Ex: marketing digital"
                className="h-9 w-full px-3 rounded-lg border border-border/60 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
              />
            )}
          </div>

          {/* Post type */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{isYouTube ? 'Tipo de Conteudo' : 'Tipo de Post'}</p>
            <Select value={postType} onValueChange={(v) => setPostType(v as PostType)}>
              <SelectTrigger className="h-9 w-full rounded-lg border border-border/60 bg-transparent text-sm text-foreground focus:ring-0 focus:ring-offset-0 gap-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {postTypeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Period */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Período</p>
            <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
              <SelectTrigger className="h-9 w-full rounded-lg border border-border/60 bg-transparent text-sm text-foreground focus:ring-0 focus:ring-offset-0 gap-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Limit */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{limitLabel}</p>
            <input
              type="number"
              min={1}
              max={limitMax}
              value={resultsLimit}
              onChange={(e) => setResultsLimit(e.target.value)}
              placeholder="20"
              className="h-9 w-full px-3 rounded-lg border border-border/60 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 transition-colors"
            />
          </div>

          <button
            onClick={() => void handleSearch()}
            disabled={isSearching || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {(isSearching || loading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" strokeWidth={1.5} />}
            {(isSearching || loading) ? 'Processando...' : 'Pesquisar'}
          </button>
        </div>

        <ResearchProgressBar active={isSearching || loading} />

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              {error}
            </p>
          </div>
        )}
      </div>

      {/* Right panel — results */}
      <div className="flex-1 min-w-0">
        {!searched && (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-secondary/60 flex items-center justify-center">
              <Target className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-muted-foreground">
              Pesquise perfis ou palavras-chave para analisar concorrentes
            </p>
          </div>
        )}

        {(isSearching || loading) && posts.length === 0 && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {posts.length > 0 && !loading && (
          <div className="space-y-4">
            {response?.metadata && (
              <ProfileMetadataCard
                metadata={response.metadata}
                isYouTube={isYouTube}
                contentLabel={contentLabel}
              />
            )}

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

            <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-3'} gap-3`}>
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
          </div>
        )}

        {!loading && !error && searched && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
            <p className="text-sm text-foreground">Nenhum {isYouTube ? 'video' : 'post'} encontrado</p>
            <p className="text-xs text-muted-foreground">
              Tente aumentar o periodo da busca (ex.: 365 dias), ajustar os filtros ou pesquisar outro perfil.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Saved Competitors View ─── */
function SavedCompetitorsView({ setSelectedPost }: { setSelectedPost: (p: Post) => void }) {
  const { competitors, loading, isCompetitor, markAsCompetitor } = useCompetitors();

  return (
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
            Nenhum concorrente marcado ainda. Use a aba Pesquisa para encontrar perfis e marcá-los.
          </p>
        </div>
      )}

      {!loading && competitors.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            {competitors.length} concorrente{competitors.length !== 1 ? 's' : ''} marcado{competitors.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {competitors.map((post) => (
              <div key={post.id} className="relative group">
                <PostCard post={post} onClick={() => setSelectedPost(post)} />
                <button
                  onClick={(e) => { e.stopPropagation(); void markAsCompetitor(post); }}
                  className={`absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium backdrop-blur-sm transition-colors ${
                    isCompetitor(post.id)
                      ? 'bg-primary text-primary-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-white'
                      : 'bg-background/80 text-muted-foreground hover:bg-destructive/20 hover:text-destructive opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Target className="w-3 h-3" />
                  Remover
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Profile Metadata Card ─── */
function ProfileMetadataCard({
  metadata,
  isYouTube,
  contentLabel,
}: {
  metadata: ProfileMetadata;
  isYouTube: boolean;
  contentLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/80 px-4 py-3">
      <div className="flex items-center gap-3">
        {metadata.profile_picture ? (
          <img
            src={proxyImageUrl(metadata.profile_picture)}
            alt={metadata.username}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <User className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">@{metadata.username}</p>
          <p className="text-xs text-muted-foreground">
            {metadata.followers.toLocaleString('pt-BR')} {isYouTube ? 'inscritos' : 'seguidores'} •{' '}
            {metadata.total_posts.toLocaleString('pt-BR')} {contentLabel}
          </p>
          {metadata.bio && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap">
              {metadata.bio}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

