/**
 * Honest accuracy disclosure component — Agent D (D-7)
 * Always shown alongside benchmark metrics.
 */
import React from 'react';

interface BenchmarkMetrics {
  top1_accuracy: number;
  top1_ci_95: [number, number];
  top3_accuracy?: number;
  f1_macro: number;
  f1_ci_95: [number, number];
  precision_macro?: number;
  recall_macro?: number;
  n_samples: number;
  n_classes: number;
  methodology?: string;
}

interface AccuracyDisclosureProps {
  metrics: BenchmarkMetrics;
}

export function AccuracyDisclosure({ metrics }: AccuracyDisclosureProps) {
  const fmt = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="p-4 bg-[#0C1018] rounded-lg border border-amber-800/40">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-4 h-4 rounded-full bg-amber-950 border border-amber-500/50 text-amber-400 text-[10px] flex items-center justify-center font-bold shrink-0">
          !
        </div>
        <h4 className="text-xs font-semibold text-amber-300">Model Performance Disclosure</h4>
      </div>
      <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
        These metrics are from <strong>internal validation on self-authored data splits</strong>.
        They do not represent performance on independently verified public benchmarks (LEVIR-CD, SpaceNet, etc.).
        Results should not be cited as official benchmark scores.
      </p>
      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
        <div className="p-2 bg-[#0A0D14] rounded border border-[#1A2232]">
          <div className="text-slate-500 text-[9px] uppercase mb-1">Top-1 Accuracy</div>
          <div className="text-white font-bold">{fmt(metrics.top1_accuracy)}</div>
          <div className="text-slate-500 text-[9px]">
            95% CI: {fmt(metrics.top1_ci_95[0])}–{fmt(metrics.top1_ci_95[1])}
          </div>
        </div>
        <div className="p-2 bg-[#0A0D14] rounded border border-[#1A2232]">
          <div className="text-slate-500 text-[9px] uppercase mb-1">F1 Macro</div>
          <div className="text-white font-bold">{fmt(metrics.f1_macro)}</div>
          <div className="text-slate-500 text-[9px]">
            95% CI: {fmt(metrics.f1_ci_95[0])}–{fmt(metrics.f1_ci_95[1])}
          </div>
        </div>
        <div className="p-2 bg-[#0A0D14] rounded border border-[#1A2232]">
          <div className="text-slate-500 text-[9px] uppercase mb-1">N Samples</div>
          <div className="text-white font-bold">{metrics.n_samples.toLocaleString()}</div>
        </div>
        <div className="p-2 bg-[#0A0D14] rounded border border-[#1A2232]">
          <div className="text-slate-500 text-[9px] uppercase mb-1">N Classes</div>
          <div className="text-white font-bold">{metrics.n_classes}</div>
        </div>
      </div>
      {metrics.methodology && (
        <p className="text-[10px] text-slate-600 mt-2">
          Methodology: {metrics.methodology}
        </p>
      )}
    </div>
  );
}
