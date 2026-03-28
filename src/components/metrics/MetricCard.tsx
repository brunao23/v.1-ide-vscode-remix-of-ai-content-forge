interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  highlight?: boolean;
  variant?: 'default' | 'highlight' | 'danger';
  format?: 'currency' | 'number' | 'percent';
  invertColors?: boolean;
  changeSuffix?: string;
}

const variantStyles = {
  default: {
    bg: 'bg-secondary border border-border',
    title: 'text-muted-foreground',
    value: 'text-foreground',
  },
  highlight: {
    bg: '',
    title: '',
    value: '',
    bgStyle: { backgroundColor: '#eff5ce', border: '1px solid #c9d4a0' },
    titleStyle: { color: '#5a6b2a' },
    valueStyle: { color: '#2d3a0f' },
  },
  danger: {
    bg: '',
    title: '',
    value: '',
    bgStyle: { backgroundColor: '#fee2e2', border: '1px solid #fca5a5' },
    titleStyle: { color: '#991b1b' },
    valueStyle: { color: '#991b1b' },
  },
};

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  highlight = false,
  variant,
  format = 'number',
  invertColors = false,
  changeSuffix = '%',
}: MetricCardProps) {
  const resolvedVariant = variant || (highlight ? 'highlight' : 'default');
  const styles = variantStyles[resolvedVariant];
  const formattedValue = formatValue(value, format);

  const isPositive = change !== undefined && change >= 0;

  const getChangeColor = () => {
    if (changeLabel) return { color: '#5a6b2a' };
    if (invertColors) {
      return isPositive ? { color: '#dc2626' } : { color: '#5a6b2a' };
    }
    return isPositive ? { color: '#5a6b2a' } : undefined;
  };

  const getChangeClass = () => {
    if (changeLabel) return '';
    if (invertColors) {
      return isPositive ? '' : '';
    }
    return isPositive ? '' : 'text-destructive';
  };

  return (
    <div
      className={`flex flex-col justify-between rounded-[10px] p-4 min-h-[120px] ${styles.bg}`}
      style={'bgStyle' in styles ? (styles as any).bgStyle : undefined}
    >
      <p
        className={`text-xs font-medium leading-tight ${styles.title}`}
        style={'titleStyle' in styles ? (styles as any).titleStyle : undefined}
      >
        {title}
      </p>

      <p
        className={`text-2xl font-bold mt-auto ${styles.value}`}
        style={'valueStyle' in styles ? (styles as any).valueStyle : undefined}
      >
        {formattedValue}
      </p>

      {(change !== undefined || changeLabel) && (
        <p
          className={`text-xs mt-1 ${getChangeClass()}`}
          style={getChangeColor()}
        >
          {changeLabel || (
            <>
              {isPositive ? '▲' : '▼'} {Math.abs(change!)}{changeSuffix}
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
