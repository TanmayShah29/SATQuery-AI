/**
 * Accessible Dialog component — Agent C (C-4)
 * Focus trap, Escape to close, ARIA modal attributes.
 */
import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Dialog({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Manage focus on open/close
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Defer so animation frame completes
      requestAnimationFrame(() => dialogRef.current?.focus());
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  // Escape key + focus trap
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Dialog panel */}
          <motion.div
            key="dialog-wrapper"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              tabIndex={-1}
              onKeyDown={handleKeyDown}
              className={`bg-[#0A0D15] border border-gray-800 rounded-xl ${maxWidth} w-full max-h-[85vh] overflow-auto pointer-events-auto outline-none`}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-[#0A0D15]">
                <h2 className="text-base font-semibold text-white">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={`Close ${title}`}
                  className="p-1.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              {/* Body */}
              <div className="p-4">{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
