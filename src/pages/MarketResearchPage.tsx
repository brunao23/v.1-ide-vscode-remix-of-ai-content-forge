import { useState } from 'react';
import { ArrowLeft, Search, Loader2, AlertTriangle, Inbox, ChevronDown } from 'lucide-react';
import { useMarketResearch } from '@/hooks/useMarketResearch';
import { SearchFilters, SearchType, Platform, PostType, SortBy, SortOrder, Post } from '@/types/marketResearch';
import PostCard from '@/components/market-research/PostCard';
import PostDetailModal from '@/components/market-research/PostDetailModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

  const postTypeOptions = platform === 'instagram'
    ? [{ value: 'all', label: 'Todos' }, { value: 'carousel', label: 'Carrossel' }, { value: 'reels', label: 'Reels' }, { value: 'image', label: 'Imagem única' }]
    : [{ value: 'all', label: 'Todos' }, { value: 'video', label: 'Vídeos' }];

  const handleSearch = () => {
    const parsedLimit = resultsLimit ? Math.min(20, Math.max(1, parseInt(resultsLimit, 10) || 20)) : undefined;
    const filters: SearchFilters = {
      searchType: tab,
      platform,
      username,
      keyword,
      postType,
      periodDays,
      resultsLimit: parsedLimit,
    };
    if (tab === 'profile' && !username.trim()) return;
    if (tab === 'keyword' && !keyword.trim()) return;
    search(filters);
  };

  const searched = posts.length > 0 || error || loading;

  return (
    <div className="flex-1 flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors" aria-label="Voltar">
          <ArrowLeft className="w-5 h-5 text-foreground" strokeWidth={1.5} />
        </button>
        <h1 className="text-lg font-semibold text-foreground">Pesquisa de Mercado</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* Tabs - text style */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => setTab('profile')}
              className={`text-sm pb-1 transition-colors border-b-2 ${
                tab === 'profile'
                  ? 'text-foreground font-medium border-foreground'
                  : 'text-muted-foreground border-transparent hover:text-foreground/70'
              }`}
            >
              Pesquisa Perfil
            </button>
            <button
              onClick={() => setTab('keyword')}
              className={`text-sm pb-1 transition-colors border-b-2 ${
                tab === 'keyword'
                  ? 'text-foreground font-medium border-foreground'
                  : 'text-muted-foreground border-transparent hover:text-foreground/70'
              }`}
            >
              Pesquisa Palavra-chave
            </button>
          </div>

          {/* Form Fields - vertical list */}
          <div className="divide-y divide-border/30">
            {/* Plataforma */}
            <SettingsRow label="Plataforma">
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger className="w-auto min-w-[140px] border-0 bg-transparent hover:bg-secondary/40 h-9 text-sm text-foreground focus:ring-0 focus:ring-offset-0 justify-end gap-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            {/* Username or Keyword */}
            {tab === 'profile' ? (
              <SettingsRow label="Usuário">
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="@username ou nome"
                  className="bg-transparent text-sm text-foreground text-right placeholder:text-muted-foreground/50 focus:outline-none w-full max-w-[200px]"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </SettingsRow>
            ) : (
              <SettingsRow label="Palavra-chave">
                <input
                  type="text"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  placeholder="Ex: marketing digital"
                  className="bg-transparent text-sm text-foreground text-right placeholder:text-muted-foreground/50 focus:outline-none w-full max-w-[200px]"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </SettingsRow>
            )}

            {/* Tipo de Post */}
            <SettingsRow label="Tipo de Post">
              <Select value={postType} onValueChange={(v) => setPostType(v as PostType)}>
                <SelectTrigger className="w-auto min-w-[140px] border-0 bg-transparent hover:bg-secondary/40 h-9 text-sm text-foreground focus:ring-0 focus:ring-offset-0 justify-end gap-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {postTypeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </SettingsRow>

            {/* Período */}
            <SettingsRow label="Período">
              <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
                <SelectTrigger className="w-auto min-w-[160px] border-0 bg-transparent hover:bg-secondary/40 h-9 text-sm text-foreground focus:ring-0 focus:ring-offset-0 justify-end gap-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </SettingsRow>

            {/* Limite */}
            <SettingsRow label="Limite de posts">
              <input
                type="number"
                min={1}
                max={20}
                value={resultsLimit}
                onChange={e => setResultsLimit(e.target.value)}
                placeholder="20"
                className="bg-transparent text-sm text-foreground text-right placeholder:text-muted-foreground/50 focus:outline-none w-16"
              />
            </SettingsRow>
          </div>

          {/* Search Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" strokeWidth={1.5} />}
              {loading ? 'Raspando dados...' : 'Pesquisar'}
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground">
                Raspando dados{tab === 'profile' ? ` de @${username}` : ''}...
              </p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-destructive/70" strokeWidth={1.5} />
              <p className="text-sm text-foreground">Não foi possível completar a pesquisa</p>
              <p className="text-xs text-muted-foreground">{error}</p>
              <button onClick={handleSearch} className="px-4 py-1.5 rounded-lg border border-border/50 hover:bg-secondary/40 transition-colors text-xs text-muted-foreground">
                Tentar novamente
              </button>
            </div>
          )}

          {/* Empty initial state */}
          {!searched && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Pesquise perfis ou palavras-chave para analisar conteúdo.
              </p>
            </div>
          )}

          {/* Results */}
          {posts.length > 0 && !loading && (
            <>
              {/* Toolbar */}
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

              {/* Post Grid */}
              <div className={`grid gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
                {posts.map(post => (
                  <PostCard key={post.id} post={post} onClick={() => setSelectedPost(post)} />
                ))}
              </div>

              {/* Load More */}
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

      {/* Post Detail Modal */}
      <PostDetailModal
        post={selectedPost}
        open={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        onSave={savePost}
      />
    </div>
  );
}

/* Settings-style row component */
function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
