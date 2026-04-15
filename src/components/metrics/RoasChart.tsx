import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
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

export function RoasChart({ history }: Props) {
  const data = history.map((h) => ({
    label: `${MONTH_LABELS[h.period_month - 1]} ${h.period_year}`,
    adSpend: h.ad_spend || 0,
    roas: h.roas || 0,
  }));

  if (!data.length) {
    return (
      <div className="rounded-[10px] bg-secondary border border-border p-6">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4">ROAS vs Investimento em anúncios</h3>
        <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] bg-secondary border border-border p-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">ROAS vs Investimento em anúncios</h3>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis
              yAxisId="left"
              tickFormatter={(v: number) => `R$${v}`}
              tick={{ fontSize: 10 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v: number) => `${v}x`}
              tick={{ fontSize: 10 }}
              stroke="#5a6b2a"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar
              yAxisId="left"
              dataKey="adSpend"
              fill="hsl(var(--muted-foreground))"
              opacity={0.3}
              radius={[4, 4, 0, 0]}
              name="Investimento"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="roas"
              stroke="#5a6b2a"
              strokeWidth={2}
              dot={{ r: 3, fill: '#5a6b2a' }}
              name="ROAS"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
