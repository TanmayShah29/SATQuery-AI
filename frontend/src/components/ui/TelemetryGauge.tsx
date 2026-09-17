import React, { useEffect, useState } from 'react';
import { cn } from '../../utils';

export type GaugeVariant = 'emerald' | 'cyan' | 'amber' | 'blue' | 'auto';

export interface TelemetryGaugeProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  segments?: number;
  label?: string;
  sublabel?: string;
  showValue?: boolean;
  variant?: GaugeVariant;
  size?: 'sm' | 'md';
}

function resolveVariant(value: number, requestedVariant: GaugeVariant): 'emerald' | 'cyan' | 'amber' | 'blue' {
  if (requestedVariant !== 'auto') return requestedVariant;
  if (value >= 75) return 'emerald';
  if (value >= 40) return 'cyan';
  return 'amber';
}

const variantStyles = {
  emerald: {
    filled: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    corner: 'border-emerald-500/50',
  },
  cyan: {
    filled: 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    corner: 'border-cyan-500/50',
  },
  amber: {
    filled: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    corner: 'border-amber-500/50',
  },
  blue: {
    filled: 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    corner: 'border-blue-500/50',
  },
};

export const TelemetryGauge: React.FC<TelemetryGaugeProps> = ({
  value,
  segments = 10,
  label,
  sublabel,
  showValue = true,
  variant = 'auto',
  size = 'md',
  className,
  ...props
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const resolved = resolveVariant(clamped, variant);
  const styles = variantStyles[resolved];
  const filledCount = Math.round((clamped / 100) * segments);

  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (filledCount === 0) {
      setVisibleCount(0);
      return;
    }
    let current = 0;
    const interval = setInterval(() => {
      current++;
      setVisibleCount(current);
      if (current >= filledCount) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [filledCount]);

  const isSm = size === 'sm';

  return (
    <div
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Telemetry Gauge'}
      className={cn(
        'relative overflow-hidden rounded border bg-[#0B0F17]/90 backdrop-blur-sm select-none',
        styles.border,
        isSm ? 'p-2' : 'p-2.5',
        className
      )}
      {...props}
    >
      {/* Tactical scanline texture */}
      <div
        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.18)_2px,rgba(0,0,0,0.18)_4px)] opacity-50"
        aria-hidden="true"
      />

      {/* Label and Numeric readout */}
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between relative z-10">
          <div className="flex flex-col">
            {label && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 font-semibold leading-none">
                {label}
              </span>
            )}
            {sublabel && (
              <span className="text-[9px] font-mono text-slate-500 mt-0.5 leading-none">
                {sublabel}
              </span>
            )}
          </div>
          {showValue && (
            <span
              className={cn(
                'font-mono font-bold tabular-nums leading-none tracking-tight',
                styles.text,
                isSm ? 'text-xs' : 'text-sm'
              )}
            >
              {clamped}%
            </span>
          )}
        </div>
      )}

      {/* Segments track */}
      <div className="flex gap-1 relative z-10" aria-hidden="true">
        {Array.from({ length: segments }, (_, i) => {
          const isFilled = i < visibleCount;
          const isLast = i === visibleCount - 1 && isFilled;
          return (
            <div
              key={i}
              className={cn(
                'rounded-xs transition-colors duration-150',
                isSm ? 'h-3 flex-1' : 'h-4 flex-1',
                isFilled ? styles.filled : 'bg-[#172030]/60 border border-[#202B3F]/40',
                isLast && 'brightness-125 ring-1 ring-white/30'
              )}
            />
          );
        })}
      </div>

      {/* Tactical HUD Corner Reticles */}
      <div className={cn('pointer-events-none absolute left-0 top-0 h-1.5 w-1.5 border-l-2 border-t-2', styles.corner)} aria-hidden="true" />
      <div className={cn('pointer-events-none absolute right-0 top-0 h-1.5 w-1.5 border-r-2 border-t-2', styles.corner)} aria-hidden="true" />
      <div className={cn('pointer-events-none absolute bottom-0 left-0 h-1.5 w-1.5 border-b-2 border-l-2', styles.corner)} aria-hidden="true" />
      <div className={cn('pointer-events-none absolute bottom-0 right-0 h-1.5 w-1.5 border-b-2 border-r-2', styles.corner)} aria-hidden="true" />
    </div>
  );
};

export default TelemetryGauge;
