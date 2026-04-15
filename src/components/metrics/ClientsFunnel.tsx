import type { ClientMetrics } from '@/hooks/useMetrics';
import { MetricCard } from './MetricCard';

interface Props {
  metrics: ClientMetrics;
  change?: number;
}

function fmt(n: number | null): string {
  if (n == null) return '-';
  return new Intl.NumberFormat('pt-BR').format(n);
}

export function ClientsFunnel({ metrics, change }: Props) {
  const reach = metrics.total_reach_ig_impressions_li || 0;
  const subs = metrics.new_subscribers || 0;
  const clients = metrics.new_clients || 0;
  const subRate = reach > 0 ? ((subs / reach) * 100).toFixed(2) : '-';
  const clientRate = subs > 0 ? ((clients / subs) * 100).toFixed(1) : '-';

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground">Clientes</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricCard title="Novos clientes" value={clients} change={change} highlight />
        <div className="rounded-[10px] bg-secondary border border-border p-4 flex items-center gap-3 overflow-x-auto">
          <div className="text-center min-w-[70px]">
            <p className="text-[10px] text-muted-foreground">Alcance</p>
            <p className="text-sm font-bold text-foreground">{fmt(reach)}</p>
          </div>
          <span className="text-muted-foreground">-&gt;</span>
          <div className="text-center min-w-[70px]">
            <p className="text-[10px] text-muted-foreground">Inscritos</p>
            <p className="text-sm font-bold text-foreground">{fmt(subs)}</p>
            <p className="text-[10px] text-muted-foreground">{subRate}%</p>
          </div>
          <span className="text-muted-foreground">-&gt;</span>
          <div className="text-center min-w-[70px]">
            <p className="text-[10px] text-muted-foreground">Clientes</p>
            <p className="text-sm font-bold text-foreground">{clients}</p>
            <p className="text-[10px] text-muted-foreground">{clientRate}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
