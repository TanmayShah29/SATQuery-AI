import React from 'react';
import { cn } from '../../utils';

export type ProvenanceVariant = 'SIMULATED' | 'SAMPLE DATA' | 'VERIFIED' | 'LIVE';

export interface ProvenanceBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant: ProvenanceVariant;
  size?: 'xs' | 'sm';
  showIcon?: boolean;
  className?: string;
}

const variantStyles: Record<ProvenanceVariant, { badge: string; dot: string; icon: string }> = {
  SIMULATED: {
    badge: 'border-amber-500/30 bg-amber-950/40 text-amber-300',
    dot: 'bg-amber-400',
    icon: '⚠',
  },
  'SAMPLE DATA': {
    badge: 'border-blue-500/30 bg-blue-950/40 text-blue-300',
    dot: 'bg-blue-400',
    icon: '📋',
  },
  VERIFIED: {
    badge: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300',
    dot: 'bg-emerald-400',
    icon: '✓',
  },
  LIVE: {
    badge: 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300',
    dot: 'bg-cyan-400',
    icon: '🔴',
  },
};

const variantDescriptions: Record<ProvenanceVariant, string> = {
  SIMULATED: 'Procedurally generated — not from live sensor acquisition',
  'SAMPLE DATA': 'Curated sample file — not a live query result',
  VERIFIED: 'Authentic sensor data with cryptographic audit trail',
  LIVE: 'Real-time satellite pass from STAC catalog',
};

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({
  variant,
  size = 'xs',
  showIcon = true,
  className,
  ...props
}) => {
  const styles = variantStyles[variant];
  const isXs = size === 'xs';
  const description = variantDescriptions[variant];

  return (
    <div
      data-slot="provenance-badge"
      className={cn(
        'inline-flex items-center gap-1 font-mono select-none rounded-full border tracking-wide whitespace-nowrap shadow-xs transition-colors',
        isXs ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]',
        styles.badge,
        className
      )}
      title={description}
      {...props}
    >
      {showIcon && (
        <span
          data-slot="provenance-indicator"
          className={cn(
            'relative flex size-1.5 shrink-0 rounded-full',
            styles.dot,
            'before:absolute before:inset-0 before:animate-ping before:rounded-full before:bg-inherit before:opacity-75',
            'after:absolute after:inset-[0.5px] after:rounded-full after:bg-inherit'
          )}
          aria-hidden="true"
        />
      )}
      <span className="font-semibold leading-none">{variant}</span>
    </div>
  );
};

export default ProvenanceBadge;