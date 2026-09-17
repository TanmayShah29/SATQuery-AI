/**
 * UI state store — Agent C (C-1)
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

type ModalKey = 'search' | 'geotiff' | 'benchmark' | 'modelStatus';

export type DeckTab = 'dag' | 'evidence' | 'telemetry';
export type MobileTab = 'map' | 'intelligence' | 'dag' | 'telemetry' | 'query';

type Updater<T> = T | ((prev: T) => T);

function resolve<T>(prev: T, next: Updater<T>): T {
  return typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
}

interface UIState {
  activeStudio: string | null;
  setActiveStudio: (studio: string | null) => void;
  modals: Record<ModalKey, boolean>;
  openModal: (modal: ModalKey) => void;
  closeModal: (modal: ModalKey) => void;
  toggleModal: (modal: ModalKey) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toasts: { id: string; message: string; type: 'info' | 'error' | 'success' }[];
  addToast: (message: string, type?: 'info' | 'error' | 'success') => void;
  removeToast: (id: string) => void;

  // Operational deck / panel visibility — agent-actuatable
  deckOpen: boolean;
  setDeckOpen: (open: Updater<boolean>) => void;
  deckTab: DeckTab;
  setDeckTab: (tab: DeckTab) => void;
  mobileTab: MobileTab;
  setMobileTab: (tab: MobileTab) => void;
  layersDrawerOpen: boolean;
  setLayersDrawerOpen: (open: Updater<boolean>) => void;
  situationalFeedOpen: boolean;
  setSituationalFeedOpen: (open: Updater<boolean>) => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      activeStudio: null,
      setActiveStudio: (activeStudio) => set({ activeStudio }),
      modals: {
        search: false,
        geotiff: false,
        benchmark: false,
        modelStatus: false,
      },
      openModal: (modal) =>
        set((state) => ({ modals: { ...state.modals, [modal]: true } })),
      closeModal: (modal) =>
        set((state) => ({ modals: { ...state.modals, [modal]: false } })),
      toggleModal: (modal) =>
        set((state) => ({ modals: { ...state.modals, [modal]: !state.modals[modal] } })),
      sidebarOpen: true,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toasts: [],
      addToast: (message, type = 'info') =>
        set((state) => ({
          toasts: [
            ...state.toasts,
            { id: crypto.randomUUID(), message, type },
          ],
        })),
      removeToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

      deckOpen: true,
      setDeckOpen: (open) =>
        set((state) => ({ deckOpen: resolve(state.deckOpen, open) })),
      deckTab: 'evidence',
      setDeckTab: (deckTab) => set({ deckTab }),
      mobileTab: 'map',
      setMobileTab: (mobileTab) => set({ mobileTab }),
      layersDrawerOpen: false,
      setLayersDrawerOpen: (open) =>
        set((state) => ({ layersDrawerOpen: resolve(state.layersDrawerOpen, open) })),
      situationalFeedOpen: false,
      setSituationalFeedOpen: (open) =>
        set((state) => ({
          situationalFeedOpen: resolve(state.situationalFeedOpen, open),
        })),
    }),
    { name: 'ui-store' }
  )
);
