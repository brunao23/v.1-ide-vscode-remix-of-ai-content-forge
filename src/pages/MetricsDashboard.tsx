import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMetrics } from '@/hooks/useMetrics';
import { MetricCard } from '@/components/metrics/MetricCard';
import { MetricsSection } from '@/components/metrics/MetricsSection';
import { RevenueChart } from '@/components/metrics/RevenueChart';
import { RoasChart } from '@/components/metrics/RoasChart';
import { ClientsFunnel } from '@/components/metrics/ClientsFunnel';
import { ClientCompositionBar } from '@/components/metrics/ClientCompositionBar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

function buildPeriodOptions() {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const months: { label: string; value: string }[] = [];
  for (let i = 0; i < 12; i++) {
    let m = curMonth - i;
    let y = curYear;
    while (m <= 0) { m += 12; y--; }
    months.push({ label: `${monthNames[m - 1]} ${y}`, value: `${y}-${m}` });
  }

  const ranges = [
    { label: 'Últimos 3 meses', value: 'last-3' },
    { label: 'Últimos 6 meses', value: 'last-6' },
    { label: 'Últimos 12 meses', value: 'last-12' },
  ];

  const quarters: { label: string; value: string }[] = [];
  for (let q = Math.ceil(curMonth / 3); q >= 1; q--) {
    quarters.push({ label: `Q${q} ${curYear}`, value: `${curYear}-Q${q}` });
  }

  const years = [
    { label: `${curYear}`, value: `${curYear}` },
    { label: `${curYear - 1}`, value: `${curYear - 1}` },
  ];

  return { months, ranges, quarters, years };
}

export default function MetricsDashboard() {
  const { user } = useAuth();
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const [period, setPeriod] = useState(defaultPeriod);
  const { metrics, previousMetrics, history, loading, calculateChange } = useMetrics(period);
  const options = useMemo(() => buildPeriodOptions(), []);

  const chg = (field: keyof NonNullable<typeof metrics>) =>
    calculateChange(
      (metrics as any)?.[field],
      (previousMetrics as any)?.[field]
    );

  const v = (field: keyof NonNullable<typeof metrics>): number =>
    (metrics as any)?.[field] ?? 0;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl text-foreground" style={{ fontFamily: "'ITC Garamond Std Lt Cond', serif" }}>
              Dashboard de Métricas
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Meses</SelectLabel>
                  {options.months.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Períodos</SelectLabel>
                  {options.ranges.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Quarters</SelectLabel>
                  {options.quarters.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Anual</SelectLabel>
                  {options.years.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Description box */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-2xl text-foreground" style={{ fontFamily: "'ITC Garamond Std Lt Cond', serif" }}>
            Dashboard de Métricas
          </h2>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Acompanhe a evolução do seu negócio mês a mês. Selecione o período desejado para visualizar receita, publicidade, audiência, clientes e saúde do negócio.
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Compare com o mês anterior automaticamente</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Filtre por mês, trimestre ou período personalizado</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Métricas calculadas automaticamente a partir dos seus dados</span>
              </li>
            </ul>
          </div>
        </div>

        {!metrics ? (
          <div className="rounded-[10px] bg-secondary border border-border p-8 text-center">
            <p className="text-muted-foreground">Nenhuma métrica encontrada para este período.</p>
          </div>
        ) : (
          <>
            {/* Change indicator */}
            <p className="text-xs text-muted-foreground">
              <span style={{ color: '#5a6b2a' }}>▲</span>{' '}
              <span className="text-destructive">▼</span>{' '}
              vs mês anterior
            </p>

            {/* 1. Receita e Finanças */}
            <MetricsSection title="Receita e Finanças" icon="💰" columns={5}>
              <MetricCard title="Total NEW Revenue" value={v('total_new_revenue')} format="currency" change={chg('total_new_revenue')} />
              <MetricCard title="Total Cash Collected" value={v('total_cash_collected')} format="currency" change={chg('total_cash_collected')} />
              <MetricCard title="MRR" value={v('monthly_recurring_revenue')} format="currency" change={chg('monthly_recurring_revenue')} />
              <MetricCard title="Expenses" value={v('expenses')} format="currency" change={chg('expenses')} />
              <MetricCard title="PROFIT" value={v('profit')} format="currency" change={chg('profit')} highlight />
            </MetricsSection>

            {/* 2. Revenue Chart */}
            <RevenueChart history={history} />

            {/* 3. Publicidade */}
            <MetricsSection title="Publicidade" icon="📣" columns={6}>
              <MetricCard title="Ad Spend" value={v('ad_spend')} format="currency" change={chg('ad_spend')} />
              <MetricCard title="Daily Ad Spend" value={v('daily_ad_spend')} format="currency" change={chg('daily_ad_spend')} />
              <MetricCard title="Reach (IG)" value={v('advertising_reach_ig')} change={chg('advertising_reach_ig')} />
              <MetricCard title="Impressions (IG)" value={v('advertising_impressions_ig')} change={chg('advertising_impressions_ig')} />
              <MetricCard title="CPM" value={v('cpm')} format="currency" change={chg('cpm')} />
              <MetricCard title="ROAS" value={`${v('roas')}x`} change={chg('roas')} highlight />
            </MetricsSection>

            {/* 4. ROAS Chart */}
            <RoasChart history={history} />

            {/* 5. Short Form */}
            <MetricsSection title="Short Form" icon="📱" columns={4}>
              <MetricCard title="Channel Size" value={v('short_form_channel_size')} change={chg('short_form_channel_size')} />
              <MetricCard title="Total Reach / Impressions" value={v('total_reach_ig_impressions_li')} change={chg('total_reach_ig_impressions_li')} />
              <MetricCard title="Total Posts Made" value={v('total_posts_made')} change={chg('total_posts_made')} />
              <MetricCard
                title="Reach per Post"
                value={v('total_posts_made') > 0 ? Math.round(v('total_reach_ig_impressions_li') / v('total_posts_made')) : 0}
              />
            </MetricsSection>

            {/* 6. Long Form */}
            <MetricsSection title="Long Form" icon="🎥" columns={5}>
              <MetricCard title="Channel Size" value={v('long_form_channel_size')} change={chg('long_form_channel_size')} />
              <MetricCard title="Monthly Audience" value={v('long_form_monthly_audience')} change={chg('long_form_monthly_audience')} />
              <MetricCard title="YouTube Views" value={v('youtube_total_views')} change={chg('youtube_total_views')} />
              <MetricCard title="YouTube Hours" value={v('youtube_total_hours')} change={chg('youtube_total_hours')} />
              <MetricCard title="Videos / Podcasts" value={v('total_videos_podcasts_made')} change={chg('total_videos_podcasts_made')} />
            </MetricsSection>

            {/* 7. Email */}
            <MetricsSection title="Email Marketing" icon="📧" columns={3}>
              <MetricCard title="Email List Size" value={v('email_list_size')} change={chg('email_list_size')} />
              <MetricCard title="New Subscribers" value={v('new_subscribers')} change={chg('new_subscribers')} />
              <MetricCard title="Net New Subscribers" value={v('net_new_subscribers')} change={chg('net_new_subscribers')} />
            </MetricsSection>

            {/* 8. Clientes / Funil */}
            <ClientsFunnel metrics={metrics} change={chg('new_clients')} />

            {/* 9. Saúde do Negócio & Retenção */}
            {(() => {
              const activeClients = v('active_clients');
              const churnCancel = v('churned_cancellation');
              const churnEnd = v('churned_end_of_contract');
              const mrr = v('monthly_recurring_revenue');
              const retentionRate = activeClients + churnEnd + churnCancel > 0
                ? Math.round(((activeClients - churnCancel) / (activeClients + churnEnd + churnCancel)) * 1000) / 10
                : 0;
              const mrrPerClient = activeClients > 0
                ? Math.round(mrr / activeClients)
                : 0;

              return (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    💚 Saúde do Negócio & Retenção
                  </h3>

                  {/* Row 1: Client Base */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard
                      title="Clientes Ativos"
                      value={v('active_clients')}
                      change={chg('active_clients')}
                      highlight
                    />
                    <MetricCard
                      title="Fim de Contrato"
                      value={v('churned_end_of_contract')}
                      changeLabel="Natural"
                    />
                    <MetricCard
                      title="Churn (Cancelamento)"
                      value={v('churned_cancellation')}
                      change={chg('churned_cancellation')}
                      variant="danger"
                      invertColors
                    />
                    <MetricCard
                      title="Upsells / Expansões"
                      value={v('upsells_expansions')}
                      change={chg('upsells_expansions')}
                    />
                  </div>

                  {/* Row 2: Health Indicators */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard
                      title="Taxa de Retenção"
                      value={`${retentionRate}%`}
                      highlight
                    />
                    <MetricCard
                      title="MRR por Cliente"
                      value={mrrPerClient}
                      format="currency"
                    />
                    <MetricCard
                      title="Tempo Médio (meses)"
                      value={metrics.avg_client_tenure_months ?? 0}
                      change={chg('avg_client_tenure_months')}
                    />
                    <MetricCard
                      title="Clientes em Risco"
                      value={v('clients_at_risk')}
                      change={chg('clients_at_risk')}
                      invertColors
                    />
                  </div>

                  {/* Row 3: Composition Bar */}
                  <ClientCompositionBar
                    over6Months={v('clients_over_6_months')}
                    months3to6={v('clients_3_to_6_months')}
                    under3Months={v('clients_under_3_months')}
                    total={v('active_clients')}
                  />
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
