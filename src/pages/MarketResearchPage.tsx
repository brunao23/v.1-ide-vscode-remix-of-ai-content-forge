import { useState, type ReactNode } from 'react';
import {
  ArrowLeft, Search, Loader2, AlertTriangle, User, Image, Calendar,
  ListOrdered, Bookmark, Clock, Trash2, Target, Sparkles,
} from 'lucide-react';
import { PlatformIcon, PLATFORM_LIST } from '@/components/market-research/PlatformIcons';
import { useMarketResearch } from '@/hooks/useMarketResearch';
import { useMyFeedSearch } from '@/hooks/useMyFeedSearch';
import { useCompetitors } from '@/hooks/useCompetitors';
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
  const limitDesc = isYouTube ? 'Maximo de resultados (1-50)' : 'Maximo de resultados (1-20)';
  const limitMax = isYouTube ? 50 : 20;

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

/* ─── Feed View ─── */
function FeedView({
  isMobile,
  setSelectedPost,
}: {
  isMobile: boolean;
  setSelectedPost: (p: Post) => void;
}) {
  const { posts, loading, error, hasSearched, config, saveConfig, search, metadata } = useMyFeedSearch();

  const isYouTube = config.platform === 'youtube';
  const isTikTok = config.platform === 'tiktok';
  const contentLabel = isYouTube ? 'videos' : 'posts';

  return (
    <div className="max-w-[720px] mx-auto px-6 py-8 space-y-8">
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <h2 className="text-2xl text-foreground" style={{ fontFamily: "'ITC Garamond Std Lt Cond', serif" }}>
          Meu Feed
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Analise o desempenho do seu proprio perfil com métricas e historico de publicações.
        </p>
      </div>

      <div className="space-y-0">
        <ConnectorRow
          icon={<PlatformIcon platform={config.platform} size={36} />}
          label="Plataforma"
          description="Sua rede social principal"
        >
          <Select
            value={config.platform}
            onValueChange={(v) => saveConfig({ ...config, platform: v as Platform })}
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

        <ConnectorRow
          icon={<IconCircle><User className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} /></IconCircle>}
          label={isYouTube ? 'Seu Canal' : 'Seu Usuario'}
          description={isYouTube ? 'Handle ou nome do canal' : isTikTok ? 'Seu usuario no TikTok' : 'Seu usuario ou URL do perfil'}
        >
          <input
            type="text"
            value={config.username}
            onChange={(e) => saveConfig({ ...config, username: e.target.value })}
            placeholder={isYouTube ? '@canal ou nome' : '@username'}
            className="h-9 px-3 rounded-lg border border-border/60 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 transition-colors w-[200px]"
            onKeyDown={(e) => e.key === 'Enter' && void search()}
          />
        </ConnectorRow>

        <RowDivider />

        <ConnectorRow
          icon={<IconCircle><Calendar className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} /></IconCircle>}
          label="Periodo"
          description="Intervalo de tempo do feed"
        >
          <Select
            value={String(config.periodDays)}
            onValueChange={(v) => saveConfig({ ...config, periodDays: Number(v) })}
          >
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
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => void search()}
          disabled={loading || !config.username.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" strokeWidth={1.5} />}
          {loading ? 'Carregando...' : 'Carregar Meu Feed'}
        </button>
      </div>

      <ResearchProgressBar active={loading} />

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />
            {error}
          </p>
        </div>
      )}

      {!hasSearched && (
        <div className="flex flex-col items-center justify-center py-14 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-secondary/60 flex items-center justify-center">
            <User className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-muted-foreground">
            Configure seu usuario e clique em "Carregar Meu Feed"
          </p>
        </div>
      )}

      {posts.length > 0 && !loading && (
        <>
          {metadata && (
            <ProfileMetadataCard metadata={metadata} isYouTube={isYouTube} contentLabel={contentLabel} />
          )}

          <p className="text-xs text-muted-foreground">
            {posts.length} {contentLabel} encontrados
          </p>

          <div className="grid grid-cols-2 gap-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onClick={() => setSelectedPost(post)} />
            ))}
          </div>
        </>
      )}

      {!loading && !error && hasSearched && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
          <p className="text-sm text-foreground">Nenhum {isYouTube ? 'video' : 'post'} encontrado</p>
          <p className="text-xs text-muted-foreground">
            Tente aumentar o periodo da busca ou verificar o nome de usuario.
          </p>
        </div>
      )}
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
    <div className="max-w-[720px] mx-auto px-6 py-8 space-y-8">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-2xl text-foreground" style={{ fontFamily: "'ITC Garamond Std Lt Cond', serif" }}>
          Pesquisa
        </h2>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Pesquise perfis ou palavras-chave e marque os posts mais relevantes como concorrentes para referencia.
          </p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">•</span>
              <span>Processo automatico sem dependencias de webhook externo</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">•</span>
              <span>Suporte para YouTube, Instagram e TikTok</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Search sub-tabs */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => setTab('profile')}
          className={`text-sm pb-1.5 transition-colors border-b-2 ${
            tab === 'profile'
              ? 'text-foreground font-medium border-foreground'
              : 'text-muted-foreground border-transparent hover:text-foreground/70'
          }`}
        >
          {profileLabel}
        </button>
        <button
          onClick={() => setTab('keyword')}
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
          <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
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
            description="Termo para buscar conteudo"
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

        <RowDivider />

        <ConnectorRow
          icon={<IconCircle><Image className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} /></IconCircle>}
          label={isYouTube ? 'Tipo de Conteudo' : 'Tipo de Post'}
          description={isYouTube ? 'Formato do conteudo' : 'Filtrar por formato de conteudo'}
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
          label="Periodo"
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
          label={limitLabel}
          description={limitDesc}
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

      <div className="flex justify-end">
        <button
          onClick={() => void handleSearch()}
          disabled={isSearching || loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {!searched && (
        <div className="flex flex-col items-center justify-center py-14 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-secondary/60 flex items-center justify-center">
            <Target className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-muted-foreground">
            Pesquise perfis ou palavras-chave para analisar concorrentes
          </p>
        </div>
      )}

      {posts.length > 0 && !loading && (
        <>
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

      {!loading && !error && searched && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
          <p className="text-sm text-foreground">Nenhum {isYouTube ? 'video' : 'post'} encontrado</p>
          <p className="text-xs text-muted-foreground">
            Tente aumentar o periodo da busca (ex.: 365 dias), ajustar os filtros ou pesquisar outro perfil.
          </p>
        </div>
      )}
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

/* ─── Shared UI Components ─── */
function ConnectorRow({
  icon,
  label,
  description,
  children,
}: {
  icon: ReactNode;
  label: string;
  description?: string;
  children: ReactNode;
}) {
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
