import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { ClientMetrics } from '@/hooks/useMetrics';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function fmtCurrency(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v}`;
}

interface Props {
  history: ClientMetrics[];
}

export function AdSpendChart({ history }: Props) {
  const data = history.map((h) => ({
    label: `${MONTHS[h.period_month - 1]}/${String(h.period_year).slice(2)}`,
    value: h.ad_spend || 0,
  }));

  if (!data.length) {
    return (
      <div className="rounded-[10px] bg-secondary border border-border p-6">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4">Gastos com Anúncios</h3>
        <p className="text-sm text-muted-foreground">Sem dados suficientes para exibir o gráfico.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] bg-secondary border border-border p-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">Gastos com Anúncios (últimos meses)</h3>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tickFormatter={fmtCurrency} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              formatter={(value: number) => [
                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value),
                'Investimento',
              ]}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="value" fill="hsl(var(--foreground))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
