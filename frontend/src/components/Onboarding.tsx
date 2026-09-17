/**
 * Onboarding flow — Agent F (F-3)
 * Shows on first visit, walkthrough the 3 key actions.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Satellite, Search, Layers, ArrowRight, X } from 'lucide-react';

const steps = [
  {
    icon: Satellite,
    title: 'Welcome to SatQuery AI',
    description:
      'Ask questions about satellite imagery in plain language. The system analyses Sentinel-1 SAR and Sentinel-2 optical data locally — no cloud dependency.',
    color: 'text-blue-400',
    bg: 'bg-blue-950/40 border-blue-500/30',
  },
  {
    icon: Search,
    title: 'Natural Language Queries',
    description:
      'Type questions like "What changed in this area?" or "Show me flood inundation extent". Results include GeoJSON polygon overlays and confidence scores.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-950/40 border-cyan-500/30',
  },
  {
    icon: Layers,
    title: 'Explore Data Layers',
    description:
      'Toggle between optical and SAR imagery, upload your own GeoTIFF, or browse precalibrated sector assets. Click map pins for pixel-level inspection.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/40 border-emerald-500/30',
  },
];

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);

  const isLast = step === steps.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        key="onboarding-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Onboarding walkthrough"
      >
        {/* Skip button */}
        <button
          type="button"
          onClick={onComplete}
          aria-label="Skip onboarding"
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="max-w-md w-full text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
            >
              {(() => {
                const { icon: Icon, title, description, color, bg } = steps[step];
                return (
                  <>
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl border mx-auto mb-6 ${bg}`}>
                      <Icon className={color} size={32} aria-hidden="true" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-3">{title}</h2>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8">{description}</p>
                  </>
                );
              })()}
            </motion.div>
          </AnimatePresence>

          {/* Step dots */}
          <div className="flex justify-center gap-2 mb-8" aria-label={`Step ${step + 1} of ${steps.length}`}>
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === step ? 'bg-blue-500 w-6' : 'bg-slate-700 hover:bg-slate-500'
                }`}
              />
            ))}
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={() => (isLast ? onComplete() : setStep(step + 1))}
            className="flex items-center gap-2 mx-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-semibold text-sm transition-colors"
          >
            {isLast ? 'Get Started' : 'Next'}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
