import { useState, useRef, useCallback } from 'react';
import type { Mood, FetchState } from '../types';
import { fetchMoodImages } from '../lib/api';

export function useMoodFetch() {
  const [currentMood, setCurrentMood] = useState<Mood | null>(null);
  const [state, setState] = useState<FetchState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const selectMood = useCallback((mood: Mood) => {
    // Spam guard — block only if already loading the same mood
    if (mood === currentMood && state.status === 'loading') return;

    setCurrentMood(mood);

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // 10-second timeout — abort if request takes too long
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
    if (currentMood) selectMood(currentMood);
  }, [currentMood, selectMood]);

  return { currentMood, state, selectMood, retry };
}