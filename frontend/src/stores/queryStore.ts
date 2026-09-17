/**
 * Query state store — Agent C (C-1)
 * Manages query text, loading state, results, errors, and cancellation.
 *
 * Extended (Mission: agent control of map & dashboard) so the last executable
 * query result is readable by the action layer rather than being trapped in
 * App.tsx local state.
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { QueryResponse } from '../types';

type Updater<T> = T | ((prev: T) => T);

function resolve<T>(prev: T, next: Updater<T>): T {
  return typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
}

interface QueryState {
  query: string;
  setQuery: (query: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  response: QueryResponse | null;
  setResponse: (response: QueryResponse | null) => void;
  error: string | null;
  setError: (error: string | null) => void;
  liveStreamEnabled: boolean;
  setLiveStreamEnabled: (enabled: Updater<boolean>) => void;
  abortController: AbortController | null;
  setAbortController: (controller: AbortController | null) => void;
  cancelQuery: () => void;
}

export const useQueryStore = create<QueryState>()(
  devtools(
    (set, get) => ({
      query: '',
      setQuery: (query) => set({ query }),
      isLoading: false,
      setIsLoading: (isLoading) => set({ isLoading }),
      response: null,
      setResponse: (response) => set({ response }),
      error: null,
      setError: (error) => set({ error }),
      liveStreamEnabled: false,
      setLiveStreamEnabled: (enabled) =>
        set((state) => ({ liveStreamEnabled: resolve(state.liveStreamEnabled, enabled) })),
      abortController: null,
      setAbortController: (abortController) => set({ abortController }),
      cancelQuery: () => {
        const { abortController } = get();
        if (abortController) abortController.abort();
        set({ abortController: null, isLoading: false });
      },
    }),
    { name: 'query-store' }
  )
);
