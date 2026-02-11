import { useState } from 'react';
import { ArrowLeft, Search, Loader2, AlertTriangle, Inbox, FlaskConical } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMarketResearch } from '@/hooks/useMarketResearch';
import { SearchFilters, SearchType, Platform, PostType, SortBy, SortOrder, Post } from '@/types/marketResearch';
import PostCard from '@/components/market-research/PostCard';
import PostDetailModal from '@/components/market-research/PostDetailModal';
import { useIsMobile } from '@/hooks/use-mobile';

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

  const postTypeOptions = platform === 'instagram'
    ? [{ value: 'all', label: 'Todos' }, { value: 'carousel', label: 'Carrossel' }, { value: 'reels', label: 'Reels' }, { value: 'image', label: 'Imagem única' }]
    : [{ value: 'all', label: 'Todos' }, { value: 'video', label: 'Vídeos' }];

  const handleSearch = () => {
    const filters: SearchFilters = {
      searchType: tab,
      platform,
      username,
      keyword,
      postType,
      periodDays,
    };
    if (tab === 'profile' && !username.trim()) return;
    if (tab === 'keyword' && !keyword.trim()) return;
    search(filters);
  };

  const searched = posts.length > 0 || error || loading;

  return (
    <div className="flex-1 flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-secondary transition-colors" aria-label="Voltar">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <FlaskConical className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">Pesquisa de Mercado</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as SearchType)}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="profile">👤 Pesquisa Perfil</TabsTrigger>
            <TabsTrigger value="keyword">🔑 Pesquisa Palavra-chave</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} mt-4`}>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Plataforma</label>
                <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Usuário</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="@username ou nome do perfil"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Tipo de Post</label>
                <Select value={postType} onValueChange={(v) => setPostType(v as PostType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {postTypeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Período</label>
                <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {/* Keyword Tab */}
          <TabsContent value="keyword">
            <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} mt-4`}>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Plataforma</label>
                <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Palavra-chave</label>
                <input
                  type="text"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  placeholder="Ex: marketing digital, receitas fitness..."
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Tipo de Post</label>
                <Select value={postType} onValueChange={(v) => setPostType(v as PostType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {postTypeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Período</label>
                <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Search Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 px-8 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Raspando dados...' : 'Pesquisar'}
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-foreground font-medium">
              Raspando dados{tab === 'profile' ? ` de @${username}` : ''}...
            </p>
            <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos.</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-destructive" />
            <p className="text-foreground font-medium">Não foi possível completar a pesquisa</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button onClick={handleSearch} className="px-6 py-2 rounded-lg border border-border hover:bg-secondary transition-colors text-sm text-foreground">
              Tentar novamente
            </button>
          </div>
        )}

        {/* Empty initial state */}
        {!searched && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <FlaskConical className="w-12 h-12 text-muted-foreground" />
            <p className="text-foreground font-medium">Pesquise perfis ou palavras-chave</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Analise posts de concorrentes e tendências do seu nicho para inspirar sua estratégia de conteúdo.
            </p>
          </div>
        )}

        {/* Results */}
        {posts.length > 0 && !loading && (
          <>
            {/* Toolbar */}
            <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'}`}>
              <p className="text-sm text-muted-foreground">
                Resultados: <span className="text-foreground font-medium">{response?.pagination?.total || posts.length} posts</span> encontrados
              </p>
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                  <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
                  <SelectTrigger className="w-[120px] h-9 text-xs"><SelectValue /></SelectTrigger>
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
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg border border-border hover:bg-secondary transition-colors text-sm text-foreground disabled:opacity-60"
                >
                  {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loadingMore ? 'Carregando...' : 'Carregar mais posts'}
                </button>
              </div>
            )}
          </>
        )}

        {/* No results */}
        {!loading && !error && searched && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <Inbox className="w-10 h-10 text-muted-foreground" />
            <p className="text-foreground font-medium">Nenhum post encontrado</p>
            <p className="text-sm text-muted-foreground">Tente ajustar os filtros ou pesquisar outro perfil.</p>
          </div>
        )}
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
