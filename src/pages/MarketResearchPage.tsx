import { useState } from 'react';
import { ArrowLeft, Search, Loader2, AlertTriangle, User, Image, Calendar, ListOrdered } from 'lucide-react';
import { toast } from 'sonner';
import { PlatformIcon, PLATFORM_LIST } from '@/components/market-research/PlatformIcons';
import { useMarketResearch } from '@/hooks/useMarketResearch';
import { SearchFilters, SearchType, Platform, PostType, SortBy, SortOrder, Post } from '@/types/marketResearch';
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

interface Props {
  onBack: () => void;
}

export default function MarketResearchPage({ onBack }: Props) {
  const isMobile = useIsMobile();
  const {
    posts, response, loading, loadingMore, error,
    sortBy, sortOrder, setSortBy, setSortOrder,
    search, loadMore, savePost, hasMore,
  } = useMarketResearch();

  const [tab, setTab] = useState<SearchType>('profile');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [username, setUsername] = useState('');
  const [keyword, setKeyword] = useState('');
  const [postType, setPostType] = useState<PostType>('all');
  const [periodDays, setPeriodDays] = useState(30);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [resultsLimit, setResultsLimit] = useState<string>('');
  const [webhookSent, setWebhookSent] = useState(false);

  const postTypeOptions = platform === 'instagram'
    ? [
        { value: 'all', label: 'Todos' },
        { value: 'posts', label: 'Posts' },
        { value: 'reels', label: 'Reels' },
        { value: 'comments', label: 'Comentários' },
        { value: 'details', label: 'Detalhes' },
        { value: 'mentions', label: 'Menções' },
      ]
    : platform === 'youtube'
    ? [{ value: 'all', label: 'Todos' }]
    : [{ value: 'all', label: 'Todos' }];

  const handleSearch = async () => {
    const inputValue = tab === 'profile' ? username.trim() : keyword.trim();
    if (!inputValue) return;

    const limitNum = resultsLimit ? Math.min(20, Math.max(1, parseInt(resultsLimit, 10) || 20)) : 20;

    const cleanUsername = (u: string) => u.trim().replace(/^@/, '');

    const calcDate = (days: number): string => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString().split('T')[0];
    };

    let payload: Record<string, any>;

    if (platform === 'instagram') {
      const user = cleanUsername(inputValue);
      const directUrl = user.includes('instagram.com')
        ? (user.endsWith('/') ? user : user + '/')
        : `https://www.instagram.com/${user}/`;

      const resultsTypeMap: Record<string, string> = {
        all: 'posts', posts: 'posts', reels: 'reels',
        comments: 'comments', details: 'details', mentions: 'mentions',
      };

      payload = {
        plataforma: 'instagram',
        addParentData: false,
        directUrls: [directUrl],
        onlyPostsNewerThan: calcDate(periodDays),
        resultsLimit: limitNum,
        resultsType: resultsTypeMap[postType] || 'posts',
        searchLimit: limitNum,
        searchType: 'hashtag',
      };
    } else if (platform === 'tiktok') {
      payload = {
        plataforma: 'tiktok',
        commentsPerPost: 0,
        excludePinnedPosts: false,
        hashtags: [],
        maxFollowersPerProfile: 0,
        maxFollowingPerProfile: 0,
        maxRepliesPerComment: 0,
        profiles: [cleanUsername(inputValue)],
        proxyCountryCode: 'None',
        resultsPerPage: limitNum,
        scrapeRelatedVideos: false,
        shouldDownloadAvatars: false,
        shouldDownloadCovers: false,
        shouldDownloadMusicCovers: false,
        shouldDownloadSlideshowImages: false,
        shouldDownloadVideos: false,
      };
    } else {
      // YouTube
      const isUrl = inputValue.includes('youtube.com') || inputValue.includes('youtu.be');
      payload = {
        plataforma: 'youtube',
        downloadSubtitles: false,
        hasCC: false,
        hasLocation: false,
        hasSubtitles: false,
        is360: false,
        is3D: false,
        is4K: false,
        isBought: false,
        isHD: false,
        isHDR: false,
        isLive: false,
        isVR180: false,
        maxResultStreams: 0,
        maxResults: limitNum,
        maxResultsShorts: 0,
        preferAutoGeneratedSubtitles: false,
        saveSubsToKVS: false,
        searchQueries: isUrl ? [] : [inputValue],
        startUrls: isUrl ? [{ url: inputValue }] : [],
      };
    }

    try {
      const res = await fetch('https://hook.us1.make.com/rgp4sp2c0xxuv9hq3fft1my1jqxxytsg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Webhook error');
      toast.success('Pesquisa enviada com sucesso!');
      setWebhookSent(true);
    } catch (err) {
      toast.error('Não foi possível completar a pesquisa. O sistema pode estar fora do ar. Tente novamente ou acione o administrador.');
      return; // Don't show progress bar on error
    }

    const filters: SearchFilters = {
      searchType: tab, platform, username, keyword, postType, periodDays,
      resultsLimit: limitNum,
    };
    search(filters);
  };

  const searched = posts.length > 0 || error || loading;

  return (
    <div className="flex-1 flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors" aria-label="Voltar">
            <ArrowLeft className="w-5 h-5 text-foreground" strokeWidth={1.5} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Pesquisa de Mercado</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Analise posts de concorrentes e tendências do seu nicho</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[640px] mx-auto px-6 py-8 space-y-8">
          {/* Intro section */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-2xl text-foreground" style={{ fontFamily: "'ITC Garamond Std Lt Cond', serif" }}>
              Análise de Competidores
            </h2>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Envie as URLs dos perfis dos seus concorrentes e receba uma planilha completa com todas as transcrições e análises de conteúdo.
              </p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>Acesso 24/7, use o quanto quiser</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>Funciona para YouTube, Instagram e LinkedIn</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => setTab('profile')}
              className={`text-sm pb-1.5 transition-colors border-b-2 ${
                tab === 'profile'
                  ? 'text-foreground font-medium border-foreground'
                  : 'text-muted-foreground border-transparent hover:text-foreground/70'
              }`}
            >
              Pesquisa Perfil
            </button>
            <button
              onClick={() => setTab('keyword')}
              className={`text-sm pb-1.5 transition-colors border-b-2 ${
                tab === 'keyword'
                  ? 'text-foreground font-medium border-foreground'
                  : 'text-muted-foreground border-transparent hover:text-foreground/70'
              }`}
            >
              Pesquisa Palavra-chave
            </button>
          </div>

          {/* Filter rows — Claude connector list style */}
          <div className="space-y-0">
            {/* Plataforma */}
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
                  {PLATFORM_LIST.map(p => (
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

            {/* Usuário / Palavra-chave */}
            {tab === 'profile' ? (
              <ConnectorRow
                icon={<IconCircle><User className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} /></IconCircle>}
                label="Usuário"
                description="Nome de usuário ou URL do perfil"
              >
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="@username"
                  className="h-9 px-3 rounded-lg border border-border/60 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 transition-colors w-[200px]"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
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
                  onChange={e => setKeyword(e.target.value)}
                  placeholder="Ex: marketing digital"
                  className="h-9 px-3 rounded-lg border border-border/60 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 transition-colors w-[200px]"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </ConnectorRow>
            )}

            <RowDivider />

            {/* Tipo de Post */}
            <ConnectorRow
              icon={<IconCircle><Image className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} /></IconCircle>}
              label="Tipo de Post"
              description="Filtrar por formato de conteúdo"
            >
              <Select value={postType} onValueChange={(v) => setPostType(v as PostType)}>
                <SelectTrigger className="h-9 w-auto min-w-[130px] rounded-lg border border-border/60 bg-transparent hover:bg-secondary/30 text-sm text-foreground focus:ring-0 focus:ring-offset-0 gap-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {postTypeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </ConnectorRow>

            <RowDivider />

            {/* Período */}
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
                  {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </ConnectorRow>

            <RowDivider />

            {/* Limite */}
            <ConnectorRow
              icon={<IconCircle><ListOrdered className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} /></IconCircle>}
              label="Limite de posts"
              description="Máximo de resultados (1-20)"
            >
              <input
                type="number"
                min={1}
                max={20}
                value={resultsLimit}
                onChange={e => setResultsLimit(e.target.value)}
                placeholder="20"
                className="h-9 px-3 rounded-lg border border-border/60 bg-transparent text-sm text-foreground text-center placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 transition-colors w-[72px]"
              />
            </ConnectorRow>
          </div>

          {/* Search Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" strokeWidth={1.5} />}
              {loading ? 'Raspando dados...' : 'Pesquisar'}
            </button>
          </div>

          {/* Progress Bar */}
          <ResearchProgressBar
            active={webhookSent}
            onComplete={() => setWebhookSent(false)}
          />

          {/* Loading */}
          {loading && !webhookSent && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground">
                Raspando dados{tab === 'profile' ? ` de @${username}` : ''}...
              </p>
            </div>
          )}

          {/* Error */}
          {error && !loading && !webhookSent && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-destructive/70" strokeWidth={1.5} />
              <p className="text-sm text-foreground">Não foi possível completar a pesquisa</p>
              <p className="text-xs text-muted-foreground">O sistema pode estar fora do ar. Tente novamente ou acione o administrador.</p>
              <button onClick={handleSearch} className="px-4 py-1.5 rounded-lg border border-border/50 hover:bg-secondary/40 transition-colors text-xs text-muted-foreground">
                Tentar novamente
              </button>
            </div>
          )}

          {/* Empty */}
          {!searched && (
            <div className="flex flex-col items-center justify-center py-14 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-secondary/60 flex items-center justify-center">
                <Search className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <p className="text-sm text-muted-foreground">
                Pesquise perfis ou palavras-chave para analisar conteúdo
              </p>
            </div>
          )}

          {/* Results */}
          {posts.length > 0 && !loading && (
            <>
              <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'}`}>
                <p className="text-xs text-muted-foreground">
                  {response?.pagination?.total || posts.length} posts encontrados
                </p>
                <div className="flex items-center gap-2">
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                    <SelectTrigger className="w-auto min-w-[160px] border-0 bg-secondary/40 hover:bg-secondary/60 h-8 text-xs text-foreground focus:ring-0 focus:ring-offset-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
                    <SelectTrigger className="w-auto min-w-[80px] border-0 bg-secondary/40 hover:bg-secondary/60 h-8 text-xs text-foreground focus:ring-0 focus:ring-offset-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">↓ Desc</SelectItem>
                      <SelectItem value="asc">↑ Asc</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className={`grid gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
                {posts.map(post => (
                  <PostCard key={post.id} post={post} onClick={() => setSelectedPost(post)} />
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

          {/* No results */}
          {!loading && !error && searched && posts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
              <p className="text-sm text-foreground">Nenhum post encontrado</p>
              <p className="text-xs text-muted-foreground">Tente ajustar os filtros ou pesquisar outro perfil.</p>
            </div>
          )}
        </div>
      </div>

      <PostDetailModal
        post={selectedPost}
        open={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        onSave={savePost}
      />
    </div>
  );
}

/* Connector-style row: large icon, label+description, action on right */
function ConnectorRow({ icon, label, description, children }: { 
  icon: React.ReactNode; label: string; description?: string; children: React.ReactNode 
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

/* Circular icon wrapper to match PlatformIcon size */
function IconCircle({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-9 h-9 rounded-[8px] bg-secondary/60 flex items-center justify-center shrink-0">
      {children}
    </div>
  );
}

/* Subtle divider */
function RowDivider() {
  return <div className="border-t border-border/30" />;
}
