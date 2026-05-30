import type { Mood, ImageResult } from '../types';
import { MOOD_QUERIES } from './moodQueries';

const UNSPLASH_URL = 'https://api.unsplash.com/search/photos';
const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

export async function fetchMoodImages(
  mood: Mood,
  signal: AbortSignal,
): Promise<ImageResult[]> {
  if (!ACCESS_KEY) {
    throw new Error('Missing VITE_UNSPLASH_ACCESS_KEY — see README.');
  }

  const query = MOOD_QUERIES[mood];
  const url = `${UNSPLASH_URL}?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;

  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Unsplash returned ${response.status}`);
  }

  const data = await response.json();
  return data.results.map((r: any) => ({
    id: r.id,
    url: r.urls.regular,
    alt: r.alt_description ?? '',
    authorName: r.user.name,
    authorUrl: `${r.user.links.html}?utm_source=mood_atlas&utm_medium=referral`,
    width: r.width,
    height: r.height,
  }));
}
