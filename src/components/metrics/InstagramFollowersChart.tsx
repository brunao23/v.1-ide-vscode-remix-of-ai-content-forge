import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { ClientMetrics } from '@/hooks/useMetrics';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function fmtNum(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

interface Props {
  history: ClientMetrics[];
}

export function InstagramFollowersChart({ history }: Props) {
  const data = history.map((h) => ({
    label: `${MONTHS[h.period_month - 1]}/${String(h.period_year).slice(2)}`,
    value: h.short_form_channel_size || 0,
  }));

  if (!data.length) {
    return (
      <div className="rounded-[10px] bg-secondary border border-border p-6">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4">Novos Seguidores Instagram</h3>
        <p className="text-sm text-muted-foreground">Sem dados suficientes para exibir o gráfico.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] bg-secondary border border-border p-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">Seguidores Instagram (evolução)</h3>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tickFormatter={fmtNum} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              formatter={(value: number) => [new Intl.NumberFormat('pt-BR').format(value), 'Seguidores']}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
              dot={{ r: 3, fill: 'hsl(var(--foreground))', stroke: 'none' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
