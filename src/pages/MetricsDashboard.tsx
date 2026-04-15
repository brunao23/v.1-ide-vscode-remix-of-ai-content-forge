import { useState, useMemo } from 'react';
import { useMetrics } from '@/hooks/useMetrics';
import { MetricCard } from '@/components/metrics/MetricCard';
import { MetricsSection } from '@/components/metrics/MetricsSection';
import { RevenueChart } from '@/components/metrics/RevenueChart';
import { RoasChart } from '@/components/metrics/RoasChart';
import { ClientsFunnel } from '@/components/metrics/ClientsFunnel';
import { ClientCompositionBar } from '@/components/metrics/ClientCompositionBar';
import { MetricsSubmissionActions } from '@/components/metrics/MetricsSubmissionActions';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import loulouLogo from '@/assets/loulou-studios-logo.png';

function buildPeriodOptions() {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  const months: { label: string; value: string }[] = [];
  for (let i = 0; i < 12; i++) {
    let m = curMonth - i;
    let y = curYear;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
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
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const [period, setPeriod] = useState(defaultPeriod);
  const { metrics, previousMetrics, history, loading, calculateChange, refetch } = useMetrics(period);
  const options = useMemo(() => buildPeriodOptions(), []);

  const chg = (field: keyof NonNullable<typeof metrics>) =>
    calculateChange((metrics as any)?.[field], (previousMetrics as any)?.[field]);

  const v = (field: keyof NonNullable<typeof metrics>): number => (metrics as any)?.[field] ?? 0;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-8 space-y-4">
        <div className="flex justify-end">
          <img src={loulouLogo} alt="Loulou Studios" className="h-12 object-contain rounded" loading="lazy" />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-8">
          <div>
            <h1 className="text-foreground pl-6" style={{ fontFamily: "'ITC Garamond Std Lt Cond', serif", fontSize: '2.6rem' }}>
              Dashboard de Métricas
            </h1>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Meses</SelectLabel>
                  {options.months.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Períodos</SelectLabel>
                  {options.ranges.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Trimestres</SelectLabel>
                  {options.quarters.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Anual</SelectLabel>
                  {options.years.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <MetricsSubmissionActions onSubmitted={refetch} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Acompanhe a evolução do seu negócio mês a mês. Selecione o período desejado para visualizar receita,
            publicidade, audiência, clientes e saúde do negócio. Compare com o mês anterior automaticamente e filtre
            por mês, trimestre ou período personalizado.
          </p>
        </div>

        {!metrics ? (
          <div className="rounded-[10px] bg-secondary border border-border p-8 text-center">
            <p className="text-muted-foreground">Nenhuma métrica encontrada para este período.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              <span style={{ color: '#5a6b2a' }}>+</span> <span className="text-destructive">-</span> vs mês anterior
            </p>

            <MetricsSection title="Receita e finanças" icon="$" columns={5}>
              <MetricCard title="Receita nova total" value={v('total_new_revenue')} format="currency" change={chg('total_new_revenue')} />
              <MetricCard title="Caixa total recebido" value={v('total_cash_collected')} format="currency" change={chg('total_cash_collected')} />
              <MetricCard title="MRR" value={v('monthly_recurring_revenue')} format="currency" change={chg('monthly_recurring_revenue')} />
              <MetricCard title="Despesas" value={v('expenses')} format="currency" change={chg('expenses')} />
              <MetricCard title="Lucro" value={v('profit')} format="currency" change={chg('profit')} highlight />
            </MetricsSection>

            <RevenueChart history={history} />

            <MetricsSection title="Publicidade" icon="ADS" columns={6}>
              <MetricCard title="Investimento em anúncios" value={v('ad_spend')} format="currency" change={chg('ad_spend')} />
              <MetricCard title="Investimento diário em anúncios" value={v('daily_ad_spend')} format="currency" change={chg('daily_ad_spend')} />
              <MetricCard title="Alcance (IG)" value={v('advertising_reach_ig')} change={chg('advertising_reach_ig')} />
              <MetricCard title="Impressões (IG)" value={v('advertising_impressions_ig')} change={chg('advertising_impressions_ig')} />
              <MetricCard title="CPM" value={v('cpm')} format="currency" change={chg('cpm')} />
              <MetricCard title="ROAS" value={`${v('roas')}x`} change={chg('roas')} highlight />
            </MetricsSection>

            <RoasChart history={history} />

            <MetricsSection title="Conteúdo curto" icon="SF" columns={4}>
              <MetricCard title="Tamanho do canal" value={v('short_form_channel_size')} change={chg('short_form_channel_size')} />
              <MetricCard title="Alcance / impressões totais" value={v('total_reach_ig_impressions_li')} change={chg('total_reach_ig_impressions_li')} />
              <MetricCard title="Total de posts publicados" value={v('total_posts_made')} change={chg('total_posts_made')} />
              <MetricCard
                title="Alcance por post"
                value={v('total_posts_made') > 0 ? Math.round(v('total_reach_ig_impressions_li') / v('total_posts_made')) : 0}
              />
            </MetricsSection>

            <MetricsSection title="Conteúdo longo" icon="LF" columns={5}>
              <MetricCard title="Tamanho do canal" value={v('long_form_channel_size')} change={chg('long_form_channel_size')} />
              <MetricCard title="Audiência mensal" value={v('long_form_monthly_audience')} change={chg('long_form_monthly_audience')} />
              <MetricCard title="Visualizações no YouTube" value={v('youtube_total_views')} change={chg('youtube_total_views')} />
              <MetricCard title="Horas no YouTube" value={v('youtube_total_hours')} change={chg('youtube_total_hours')} />
              <MetricCard title="Vídeos / Podcasts" value={v('total_videos_podcasts_made')} change={chg('total_videos_podcasts_made')} />
            </MetricsSection>

            <MetricsSection title="Marketing por e-mail" icon="MAIL" columns={3}>
              <MetricCard title="Tamanho da lista de e-mails" value={v('email_list_size')} change={chg('email_list_size')} />
              <MetricCard title="Novos inscritos" value={v('new_subscribers')} change={chg('new_subscribers')} />
              <MetricCard title="Novos inscritos líquidos" value={v('net_new_subscribers')} change={chg('net_new_subscribers')} />
            </MetricsSection>

            <ClientsFunnel metrics={metrics} change={chg('new_clients')} />

            {(() => {
              const activeClients = v('active_clients');
              const churnCancel = v('churned_cancellation');
              const churnEnd = v('churned_end_of_contract');
              const mrr = v('monthly_recurring_revenue');
              const retentionRate =
                activeClients + churnEnd + churnCancel > 0
                  ? Math.round(((activeClients - churnCancel) / (activeClients + churnEnd + churnCancel)) * 1000) / 10
                  : 0;
              const mrrPerClient = activeClients > 0 ? Math.round(mrr / activeClients) : 0;

              return (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">Saúde do negócio e retenção</h3>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard title="Clientes ativos" value={v('active_clients')} change={chg('active_clients')} highlight />
                    <MetricCard title="Fim de contrato" value={v('churned_end_of_contract')} changeLabel="Natural" />
                    <MetricCard
                      title="Churn (cancelamento)"
                      value={v('churned_cancellation')}
                      change={chg('churned_cancellation')}
                      variant="danger"
                      invertColors
                    />
                    <MetricCard title="Upsells / expansões" value={v('upsells_expansions')} change={chg('upsells_expansions')} />
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard title="Taxa de retenção" value={`${retentionRate}%`} highlight />
                    <MetricCard title="MRR por cliente" value={mrrPerClient} format="currency" />
                    <MetricCard title="Tempo médio (meses)" value={metrics.avg_client_tenure_months ?? 0} change={chg('avg_client_tenure_months')} />
                    <MetricCard title="Clientes em risco" value={v('clients_at_risk')} change={chg('clients_at_risk')} invertColors />
                  </div>

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
