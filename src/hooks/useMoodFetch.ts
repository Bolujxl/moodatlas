import { useState, useRef, useCallback } from 'react';
import type { Mood, ImageResult, FetchState } from '../types';
import { fetchMoodImages } from '../lib/api';

type Cache = Partial<Record<Mood, ImageResult[]>>;

export function useMoodFetch() {
  const [currentMood, setCurrentMood] = useState<Mood | null>(null);
  const [state, setState] = useState<FetchState>({ status: 'idle' });
  const cacheRef = useRef<Cache>({});
  const abortRef = useRef<AbortController | null>(null);

  const selectMood = useCallback((mood: Mood) => {
    if (mood === currentMood && state.status !== 'error') return;

    setCurrentMood(mood);

    const cached = cacheRef.current[mood];
    if (cached) {
      setState({ status: 'success', images: cached });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ status: 'loading' });

    fetchMoodImages(mood, controller.signal)
      .then((images) => {
        if (controller.signal.aborted) return;
        cacheRef.current[mood] = images;
        setState({ status: 'success', images });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: err.message });
      });
  }, [currentMood, state.status]);

  const retry = useCallback(() => {
    if (currentMood) {
      const moodToRetry = currentMood;
      delete cacheRef.current[moodToRetry];
      setCurrentMood(null);
      selectMood(moodToRetry);
    }
  }, [currentMood, selectMood]);

  return { currentMood, state, selectMood, retry };
}
