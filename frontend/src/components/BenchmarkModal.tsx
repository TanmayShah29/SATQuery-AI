import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  ExternalLink,
  Award,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  CheckCircle,
  Loader2,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import type { BenchmarkQuery, ModalityMode } from '../types';
import { OFFICIAL_BENCHMARK_QUERIES } from '../config/tacticalData';
import { fetchBenchmarkCatalog, evaluateBenchmark } from '../services/api';

interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunBenchmark: (bench: BenchmarkQuery) => void;
}

export const BenchmarkModal: React.FC<BenchmarkModalProps> = ({
  isOpen,
  onClose,
  onRunBenchmark,
}) => {
  const [activeTab, setActiveTab] = useState<'sih' | 'vrsbench' | 'cdvqa' | 'bigearthnet'>('sih');
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [evalResults, setEvalResults] = useState<Record<string, any>>({});

  useEffect(() => {
    if (isOpen) {
      fetchBenchmarkCatalog().then((res) => {
        if (res && res.challenges) {
          setCatalogItems(res.challenges);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunEvaluation = async (challenge: any) => {
    setEvaluatingId(challenge.id);
    try {
      const res = await evaluateBenchmark({
        query: challenge.question,
        groundTruth: challenge.ground_truth,
        modality: challenge.suggested_modality || 'single_image',
      });
      setEvalResults((prev) => ({ ...prev, [challenge.id]: res }));
    } catch (err) {
      console.error('Benchmark evaluation error:', err);
    } finally {
      setEvaluatingId(null);
    }
  };

  const filteredChallenges =
    activeTab === 'sih'
      ? []
      : catalogItems.filter((c) => {
          if (activeTab === 'vrsbench') return c.dataset === 'VRSBench';
          if (activeTab === 'cdvqa') return c.dataset.includes('CDVQA');
          if (activeTab === 'bigearthnet') return c.dataset.includes('BigEarthNet');
          return true;
        });

  return (
    <div
      id="benchmark-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none"
      onClick={onClose}
    >
      <div
        id="benchmark-modal-container"
        className="w-full max-w-4xl bg-gradient-to-b from-[#151A26] to-[#0D1018] border border-[#232B3E] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#202838] bg-gradient-to-b from-[#182030] to-[#111622]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-md bg-[#161D2C] border border-[#26334A] text-slate-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-semibold text-slate-100 font-mono tracking-wide">
                  Official SIH26167 Benchmark & Verification Suite
                </h2>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-gradient-to-b from-[#20293C] to-[#151B27] text-slate-300 border border-slate-500/40">
                  ACADEMIC GROUNDING
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluated against BigEarthNet.txt (arXiv:2603.29630), VRSBench (37k VQA pairs), and CDVQA (39k change pairs).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E2536] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Paper Reference Spotlight: BigEarthNet.txt */}
          <div className="p-4 rounded-lg bg-gradient-to-b from-[#172030] to-[#101622] border border-[#27354D] shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-[#141C2A] text-slate-300 border border-[#2A3952]">
                    CORE PRE-TRAINING SUITE
                  </span>
                  <span className="text-xs font-mono text-slate-400">arXiv:2603.29630</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-100 mt-1">
                  BigEarthNet.txt: Multimodal Sentinel-1 SAR & Sentinel-2 Multispectral Dataset with Textual Annotations
                </h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  SatQuery AI’s vision-language adaptor is grounded on BigEarthNet.txt, which provides co-registered 
                  Sentinel-1 C-SAR dual-polarization (VV/VH) and Sentinel-2 12-band multispectral data coupled with natural language semantic descriptions for cross-modal land-use classification.
                </p>
              </div>
              <a
                href="https://arxiv.org/abs/2603.29630"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-md bg-gradient-to-b from-[#1E2738] to-[#141A25] hover:from-[#263147] hover:to-[#18202D] border border-[#2C3B54] text-slate-200 text-xs font-mono flex items-center space-x-1.5 shrink-0 transition-colors shadow-sm"
              >
                <span>Read Paper</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            </div>
          </div>

          {/* Dataset Tabs */}
          <div className="flex items-center space-x-2 border-b border-[#20293A] pb-2">
            <button
              onClick={() => setActiveTab('sih')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                activeTab === 'sih'
                  ? 'bg-[#1E2738] text-white font-semibold border border-slate-500/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#151B27]'
              }`}
            >
              ISRO Mandatory Tasks (4)
            </button>
            <button
              onClick={() => setActiveTab('vrsbench')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                activeTab === 'vrsbench'
                  ? 'bg-[#1E2738] text-white font-semibold border border-slate-500/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#151B27]'
              }`}
            >
              VRSBench Dataset ({catalogItems.filter((c) => c.dataset === 'VRSBench').length || '12'})
            </button>
            <button
              onClick={() => setActiveTab('cdvqa')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                activeTab === 'cdvqa'
                  ? 'bg-[#1E2738] text-white font-semibold border border-slate-500/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#151B27]'
              }`}
            >
              CDVQA Change Detection ({catalogItems.filter((c) => c.dataset.includes('CDVQA')).length || '8'})
            </button>
            <button
              onClick={() => setActiveTab('bigearthnet')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                activeTab === 'bigearthnet'
                  ? 'bg-[#1E2738] text-white font-semibold border border-slate-500/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#151B27]'
              }`}
            >
              BigEarthNet.txt ({catalogItems.filter((c) => c.dataset.includes('BigEarthNet')).length || '15'})
            </button>
          </div>

          {/* Tab 1: SIH Official Pre-Packaged Tasks */}
          {activeTab === 'sih' && (
            <div className="space-y-3">
              {OFFICIAL_BENCHMARK_QUERIES.map((bench) => (
                <div
                  key={bench.id}
                  className="p-4 rounded-lg bg-gradient-to-b from-[#161D2B] to-[#10141E] border border-[#232C3E] hover:border-slate-500/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-[#0D1118] text-slate-300 border border-[#242D3D]">
                        {bench.dataset}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-[#0D1118] text-slate-300 border border-[#242D3D] uppercase">
                        Modality: {bench.suggestedModality.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-100">
                      "{bench.query}"
                    </div>

                    <p className="text-[11px] text-slate-400">
                      {bench.description}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      onRunBenchmark(bench);
                      onClose();
                    }}
                    className="px-4 py-2 rounded-lg bg-gradient-to-b from-[#2A5288] to-[#1E3B63] hover:from-[#3564A3] hover:to-[#254A7C] border border-blue-400/30 text-white font-mono text-xs font-semibold transition-all shadow-sm flex items-center justify-center space-x-1.5 shrink-0 active:from-[#1A3457] active:to-[#142844]"
                  >
                    <span>EXECUTE IN CANVAS</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Tab 2 & 3: Live Academic Challenge Registry with Ground Truth Evaluation */}
          {activeTab !== 'sih' && (
            <div className="space-y-3">
              {filteredChallenges.map((item) => {
                const evalResult = evalResults[item.id];
                const isRunning = evaluatingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-lg bg-gradient-to-b from-[#161D2B] to-[#10141E] border border-[#232C3E] space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-[#0C1017] border border-[#20293A] text-amber-400">
                          {item.category.toUpperCase()}
                        </span>
                        {item.image_ref && (
                          <span className="text-[10px] font-mono text-slate-500">
                            Asset: {item.image_ref}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        Ground Truth: <span className="text-emerald-300 font-bold">"{item.ground_truth}"</span>
                      </span>
                    </div>

                    <div className="text-xs font-medium text-slate-100">
                      {item.question}
                    </div>

                    {/* Evaluation Result Banner */}
                    {evalResult && (
                      <div className="p-2.5 rounded bg-[#0A0E16] border border-[#1E273A] text-[11px] font-mono space-y-1">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Score: {evalResult.score_percent}%</span>
                          </span>
                          <span className="text-slate-400">Latency: {evalResult.latency_ms != null ? `${evalResult.latency_ms}ms` : 'N/A'}</span>
                        </div>
                        <div className="text-slate-300">
                          <span className="text-slate-500">Generated Answer:</span> {evalResult.generated_answer}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end space-x-2 pt-1 border-t border-[#1C2536]">
                      <button
                        onClick={() => handleRunEvaluation(item)}
                        disabled={isRunning}
                        className="px-3 py-1.5 bg-[#172338] hover:bg-[#1E2E48] border border-[#293C5C] text-blue-200 rounded text-xs font-mono font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                      >
                        {isRunning ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                            <span>EVALUATING MODEL...</span>
                          </>
                        ) : (
                          <>
                            <TrendingUp className="w-3 h-3 text-blue-400" />
                            <span>{evalResult ? 'RE-EVALUATE SCORE' : 'EVALUATE AGAINST TRUTH'}</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          onRunBenchmark({
                            id: item.id,
                            query: item.question,
                            category: 'urban_infrastructure',
                            dataset: item.dataset,
                            suggestedModality: item.suggested_modality || 'single_image',
                            targetPinId: 'isro-sac',
                            description: `Benchmark question from ${item.dataset}.`,
                          });
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-gradient-to-b from-[#2A5288] to-[#1E3B63] hover:from-[#3564A3] text-white rounded text-xs font-mono font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
                      >
                        <span>VIEW ON MAP</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
