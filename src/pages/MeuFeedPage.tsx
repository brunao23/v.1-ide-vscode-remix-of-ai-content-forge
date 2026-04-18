import { useState, useEffect, type ReactNode } from 'react';
import { Loader2, User, TrendingUp, Star, BarChart2, AlertTriangle } from 'lucide-react';
import { PlatformIcon, PLATFORM_LIST } from '@/components/market-research/PlatformIcons';
import { fetchSbStats, type SbPlatform, type SbStats } from '@/services/socialBladeApi';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CONFIG_KEY = 'meu-feed-config';

interface Config {
  platform: SbPlatform;
  username: string;
}

function fmtNum(n: number | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('pt-BR');
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

function StatCard({ label, value, icon, highlight }: { label: string; value: string; icon: ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${highlight ? 'border-foreground/20 bg-secondary/60' : 'border-border/50 bg-card/60'}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className="text-muted-foreground/50">{icon}</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function StatsDisplay({ stats, isYouTube }: { stats: SbStats; isYouTube: boolean }) {
  const gradeStyle = stats.gradeColor
    ? { backgroundColor: stats.gradeColor + '22', color: stats.gradeColor, borderColor: stats.gradeColor + '44' }
    : {};

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {stats.avatar && (
          <img src={stats.avatar} alt={stats.displayName} className="w-10 h-10 rounded-full object-cover" />
        )}
        <div>
          <p className="text-sm font-medium text-foreground">{stats.displayName || stats.username}</p>
          <p className="text-xs text-muted-foreground">@{stats.username}</p>
        </div>
        {stats.grade && (
          <div className="ml-auto px-3 py-1 rounded-full border text-sm font-bold" style={gradeStyle}>
            {stats.grade}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          label={isYouTube ? 'Inscritos' : 'Seguidores'}
          value={fmtNum(stats.followers)}
          icon={<TrendingUp className="w-4 h-4" strokeWidth={1.5} />}
          highlight
        />
        {stats.following != null && (
          <StatCard
            label="Seguindo"
            value={fmtNum(stats.following)}
            icon={<User className="w-4 h-4" strokeWidth={1.5} />}
          />
        )}
        <StatCard
          label={isYouTube ? 'Vídeos' : 'Publicações'}
          value={fmtNum(stats.uploads)}
          icon={<BarChart2 className="w-4 h-4" strokeWidth={1.5} />}
        />
        {stats.totalViews != null && (
          <StatCard
            label="Views Totais"
            value={fmtNum(stats.totalViews)}
            icon={<BarChart2 className="w-4 h-4" strokeWidth={1.5} />}
          />
        )}
        {stats.totalLikes != null && (
          <StatCard
            label="Likes Totais"
            value={fmtNum(stats.totalLikes)}
            icon={<Star className="w-4 h-4" strokeWidth={1.5} />}
          />
        )}
        {stats.rankSb != null && (
          <StatCard
            label="Rank Social Blade"
            value={`#${stats.rankSb.toLocaleString('pt-BR')}`}
            icon={<Star className="w-4 h-4" strokeWidth={1.5} />}
          />
        )}
        {stats.rankPrimary != null && (
          <StatCard
            label={isYouTube ? 'Rank Inscritos' : 'Rank Seguidores'}
            value={`#${stats.rankPrimary.toLocaleString('pt-BR')}`}
            icon={<Star className="w-4 h-4" strokeWidth={1.5} />}
          />
        )}
      </div>

      {(stats.avgFollowersMonthly != null || stats.avgUploadsMonthly != null || stats.avgViewsMonthly != null) && (
        <div className="rounded-xl border border-border/50 bg-card/60 p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Médias mensais (últimos 30 dias)</p>
          <div className="grid grid-cols-3 gap-3">
            {stats.avgFollowersMonthly != null && (
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{fmtNum(stats.avgFollowersMonthly)}</p>
                <p className="text-[11px] text-muted-foreground">{isYouTube ? 'Inscritos/mês' : 'Seguidores/mês'}</p>
              </div>
            )}
            {stats.avgUploadsMonthly != null && (
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{fmtNum(stats.avgUploadsMonthly)}</p>
                <p className="text-[11px] text-muted-foreground">{isYouTube ? 'Vídeos/mês' : 'Posts/mês'}</p>
              </div>
            )}
            {stats.avgViewsMonthly != null && (
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{fmtNum(stats.avgViewsMonthly)}</p>
                <p className="text-[11px] text-muted-foreground">Views/mês</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MeuFeedPage() {
  const [config, setConfig] = useState<Config>({ platform: 'instagram', username: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SbStats | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Config>;
        setConfig({
          platform: (parsed.platform as SbPlatform) || 'instagram',
          username: parsed.username || '',
        });
      }
    } catch {}
  }, []);

  const saveConfig = (next: Config) => {
    setConfig(next);
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(next)); } catch {}
  };

  const handleSearch = async () => {
    if (loading || !config.username.trim()) return;
    setLoading(true);
    setError(null);
    setStats(null);
    try {
      const result = await fetchSbStats(config.platform, config.username.trim());
      setStats(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados');
    } finally {
      setLoading(false);
    }
  };

  const isYouTube = config.platform === 'youtube';
  const isTikTok = config.platform === 'tiktok';

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-6 py-8 space-y-8">
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <h2 className="text-2xl text-foreground" style={{ fontFamily: "'ITC Garamond Std Lt Cond', serif" }}>
            Meu Feed
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Acompanhe as métricas do seu perfil em tempo real com dados do Social Blade — seguidores, engajamento, crescimento e ranking.
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
              onValueChange={(v) => saveConfig({ ...config, platform: v as SbPlatform })}
            >
              <SelectTrigger className="h-9 w-auto min-w-[130px] rounded-lg border border-border/60 bg-transparent hover:bg-secondary/30 text-sm text-foreground focus:ring-0 focus:ring-offset-0 gap-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[220px]">
                {PLATFORM_LIST.filter((p) => ['instagram', 'youtube', 'tiktok'].includes(p.value)).map((p) => (
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
            label={isYouTube ? 'Seu Canal' : 'Seu Usuário'}
            description={isYouTube ? 'Handle ou nome do canal' : isTikTok ? 'Seu usuário no TikTok' : 'Seu usuário ou URL do perfil'}
          >
            <input
              type="text"
              value={config.username}
              onChange={(e) => saveConfig({ ...config, username: e.target.value })}
              placeholder={isYouTube ? '@canal ou nome' : '@username'}
              className="h-9 px-3 rounded-lg border border-border/60 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 transition-colors w-[200px]"
              onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
            />
          </ConnectorRow>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => void handleSearch()}
            disabled={loading || !config.username.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" strokeWidth={1.5} />}
            {loading ? 'Buscando...' : 'Buscar Meu Perfil'}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />
              {error}
            </p>
          </div>
        )}

        {!stats && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-14 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-secondary/60 flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-muted-foreground">
              Configure seu usuário e clique em "Buscar Meu Perfil"
            </p>
          </div>
        )}

        {stats && !loading && <StatsDisplay stats={stats} isYouTube={isYouTube} />}
      </div>
    </div>
  );
}
