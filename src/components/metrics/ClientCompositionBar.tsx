interface ClientCompositionBarProps {
  over6Months: number;
  months3to6: number;
  under3Months: number;
  total: number;
}

export function ClientCompositionBar({
  over6Months,
  months3to6,
  under3Months,
  total,
}: ClientCompositionBarProps) {
  const hasData = over6Months + months3to6 + under3Months > 0;

  return (
    <div className="bg-secondary rounded-[10px] p-4 border border-border">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-muted-foreground">
          Composição da base
        </span>
        <span className="text-xs text-muted-foreground">
          {total} clientes ativos
        </span>
      </div>

      {/* Bar */}
      {hasData ? (
        <div className="flex h-6 rounded-md overflow-hidden gap-0.5">
          {over6Months > 0 && (
            <div
              className="rounded-sm"
              style={{ flex: over6Months, backgroundColor: '#5a6b2a' }}
              title={`>6 meses: ${over6Months}`}
            />
          )}
          {months3to6 > 0 && (
            <div
              className="rounded-sm"
              style={{ flex: months3to6, backgroundColor: '#eff5ce', border: '1px solid #c9d4a0' }}
              title={`3-6 meses: ${months3to6}`}
            />
          )}
          {under3Months > 0 && (
            <div
              className="rounded-sm"
              style={{ flex: under3Months, backgroundColor: '#fef3c7', border: '1px solid #fcd34d' }}
              title={`<3 meses: ${under3Months}`}
            />
          )}
        </div>
      ) : (
        <div className="h-6 rounded-md bg-muted" />
      )}

      {/* Legend */}
      <div className="flex gap-4 mt-2">
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#5a6b2a' }} />
          &gt;6 meses ({over6Months})
        </span>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#eff5ce', border: '1px solid #c9d4a0' }} />
          3-6 meses ({months3to6})
        </span>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d' }} />
          &lt;3 meses ({under3Months})
        </span>
      </div>
    </div>
  );
}
