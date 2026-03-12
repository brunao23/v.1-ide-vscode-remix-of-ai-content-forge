import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  'Enviando solicitação',
  'Coletando dados',
  'Analisando conteúdo',
  'Processando métricas',
  'Finalizando relatório',
];

interface ResearchProgressBarProps {
  active: boolean;
  onComplete?: () => void;
}

export default function ResearchProgressBar({ active, onComplete }: ResearchProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  const currentStep = Math.min(Math.floor(progress / 20), STEPS.length - 1);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      progressRef.current = 0;
      return;
    }

    // Monotonically increasing progress that slows down asymptotically
    // Never goes backwards, never reaches 100 on its own
    const interval = setInterval(() => {
      const cur = progressRef.current;
      // Slow down as we approach 95 — always moving forward
      const remaining = 95 - cur;
      const increment = Math.max(0.05, remaining * 0.008);
      const next = Math.min(cur + increment, 95);
      progressRef.current = next;
      setProgress(next);
    }, 100);

    return () => clearInterval(interval);
  }, [active]);

  // When deactivated after being active, snap to 100 briefly
  useEffect(() => {
    if (!active && progressRef.current > 5) {
      setProgress(100);
      const t = setTimeout(() => {
        onComplete?.();
        setProgress(0);
        progressRef.current = 0;
      }, 600);
      return () => clearTimeout(t);
    }
  }, [active, onComplete]);

  if (!active && progress === 0) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 p-5 space-y-4 animate-in fade-in duration-300">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground tracking-wide">
          {STEPS[currentStep]}...
        </p>
        <div className="h-[3px] w-full rounded-full bg-secondary/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary/70 transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-start justify-between gap-1">
        {STEPS.map((label, i) => {
          const isComplete = i < currentStep || progress >= 100;
          const isCurrent = i === currentStep && progress < 100;

          return (
            <div key={i} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500',
                  isComplete && 'bg-primary/80 text-primary-foreground',
                  isCurrent && 'bg-secondary text-foreground/70',
                  !isComplete && !isCurrent && 'bg-secondary/40 text-muted-foreground/40'
                )}
              >
                {isComplete ? (
                  <Check className="w-3 h-3" strokeWidth={2} />
                ) : (
                  <span className="text-[9px] font-medium">{i + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] text-center leading-tight truncate w-full',
                  isCurrent ? 'text-foreground/80' : 'text-muted-foreground/50'
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
