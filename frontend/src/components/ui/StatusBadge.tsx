import React from 'react';
import { cn } from '../../utils';

export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'satellite' | 'neutral';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: StatusVariant;
  label: string;
  sublabel?: string;
  pulsing?: boolean;
  size?: 'xs' | 'sm';
}

const variantStyles: Record<StatusVariant, { badge: string; dot: string }> = {
  success: {
    badge: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300',
    dot: 'bg-emerald-400',
  },
  warning: {
    badge: 'border-amber-500/30 bg-amber-950/40 text-amber-300',
    dot: 'bg-amber-400',
  },
  error: {
    badge: 'border-red-500/30 bg-red-950/40 text-red-300',
    dot: 'bg-red-400',
  },
  info: {
    badge: 'border-blue-500/30 bg-blue-950/40 text-blue-300',
    dot: 'bg-blue-400',
  },
  satellite: {
    badge: 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300',
    dot: 'bg-cyan-400',
  },
  neutral: {
    badge: 'border-[#243044] bg-[#111724] text-slate-300',
    dot: 'bg-slate-400',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant = 'neutral',
  label,
  sublabel,
  pulsing = true,
  size = 'xs',
  className,
  ...props
}) => {
  const styles = variantStyles[variant];
  const isXs = size === 'xs';

  return (
    <div
      data-slot="status-badge"
      className={cn(
        'inline-flex items-center gap-1.5 font-mono select-none rounded-full border tracking-wide whitespace-nowrap shadow-xs',
        isXs ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]',
        styles.badge,
        className
      )}
      {...props}
    >
      <span
        data-slot="status-indicator"
        className={cn(
          'relative flex size-1.5 shrink-0 rounded-full',
          styles.dot,
          pulsing && [
            'before:absolute before:inset-0 before:animate-ping before:rounded-full before:bg-inherit before:opacity-75',
            'after:absolute after:inset-[0.5px] after:rounded-full after:bg-inherit',
          ]
        )}
        aria-hidden="true"
      />
      <span className="font-semibold leading-none">{label}</span>
      {sublabel && (
        <span className="text-slate-400/80 font-normal leading-none">
          • {sublabel}
        </span>
      )}
    </div>
  );
};

export default StatusBadge;
