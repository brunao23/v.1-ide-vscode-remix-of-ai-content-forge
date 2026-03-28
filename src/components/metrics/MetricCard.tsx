interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  highlight?: boolean;
  format?: 'currency' | 'number' | 'percent';
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  highlight = false,
  format = 'number',
}: MetricCardProps) {
  const formattedValue = formatValue(value, format);
  const isPositive = change !== undefined && change >= 0;

  return (
    <div
      className={`flex flex-col justify-between rounded-[10px] p-4 min-h-[120px] ${
        highlight ? '' : 'bg-secondary border border-border'
      }`}
      style={highlight ? { backgroundColor: '#eff5ce', border: '1px solid #c9d4a0' } : undefined}
    >
      <p
        className={`text-xs font-medium leading-tight ${highlight ? '' : 'text-muted-foreground'}`}
        style={highlight ? { color: '#5a6b2a' } : undefined}
      >
        {title}
      </p>

      <p
        className={`text-2xl font-bold mt-auto ${highlight ? '' : 'text-foreground'}`}
        style={highlight ? { color: '#2d3a0f' } : undefined}
      >
        {formattedValue}
      </p>

      {(change !== undefined || changeLabel) && (
        <p
          className={`text-xs mt-1 ${
            changeLabel || isPositive ? '' : 'text-destructive'
          }`}
          style={changeLabel || isPositive ? { color: '#5a6b2a' } : undefined}
        >
          {changeLabel || (
            <>
              {isPositive ? '▲' : '▼'} {Math.abs(change!)}%
            </>
          )}
        </p>
      )}
    </div>
  );
}

function formatValue(value: string | number, format: string): string {
  if (typeof value === 'string') return value;
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return `${value}%`;
    default:
      return new Intl.NumberFormat('en-US').format(value);
  }
}
