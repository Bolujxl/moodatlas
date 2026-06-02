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

    const timedOut = { current: false };
    const timeoutId = setTimeout(() => {
      timedOut.current = true;
      controller.abort();
    }, 10_000);

    setState({ status: 'loading' });

    fetchMoodImages(mood, controller.signal)
      .then((images) => {
        clearTimeout(timeoutId);
        if (controller.signal.aborted) return;
        cacheRef.current[mood] = images;
        setState({ status: 'success', images });
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        if (controller.signal.aborted && !timedOut.current) return;
        setState({
          status: 'error',
          message: timedOut.current
            ? 'Request timed out — please try again.'
            : err.message,
        });
      });
  }, [currentMood, state.status]);

  const retry = useCallback(() => {
    if (currentMood) {
      delete cacheRef.current[currentMood];
      selectMood(currentMood);
    }
  }, [currentMood, selectMood]);

  return { currentMood, state, selectMood, retry };
}
