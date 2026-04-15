import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { ClientMetrics } from '@/hooks/useMetrics';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface Props {
  history: ClientMetrics[];
}

export function RevenueChart({ history }: Props) {
  const data = history.map((h) => ({
    label: `${MONTH_LABELS[h.period_month - 1]} ${h.period_year}`,
    revenue: h.total_new_revenue || 0,
  }));

  if (!data.length) {
    return (
      <div className="rounded-[10px] bg-secondary border border-border p-6">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4">Evolução de receita</h3>
        <p className="text-sm text-muted-foreground">Sem dados suficientes para exibir o gráfico.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] bg-secondary border border-border p-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">Evolução de receita (últimos 12 meses)</h3>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#eff5ce" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#eff5ce" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis
              tickFormatter={(v: number) => `R$${v >= 1000 ? `${Math.round(v / 100) / 10}k` : v}`}
              tick={{ fontSize: 10 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip
              formatter={(value: number) => [
                new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 0,
                }).format(value),
                'Receita',
              ]}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(var(--foreground))"
              fill="url(#revenueGrad)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'hsl(var(--foreground))', stroke: 'none' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
