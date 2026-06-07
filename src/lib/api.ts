import type { Mood, ImageResult } from '../types';
import { MOOD_QUERIES } from './moodQueries';

const UNSPLASH_URL = 'https://api.unsplash.com/photos/random';
const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

export async function fetchMoodImages(
  mood: Mood,
  signal: AbortSignal,
): Promise<ImageResult[]> {
  if (!ACCESS_KEY) {
    throw new Error('Missing VITE_UNSPLASH_ACCESS_KEY — see README.');
  }

  const query = MOOD_QUERIES[mood];
  const url = `${UNSPLASH_URL}?query=${encodeURIComponent(query)}&count=5&orientation=landscape`;

  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
    signal,
  });

  if (!response.ok) {
    if (response.status === 429 || response.status === 403) {
      throw new Error('Rate limit reached — please wait an hour and try again.');
    }
    throw new Error(`Unsplash returned ${response.status}`);
  }

  const data = await response.json();
  return data.map((r: any) => ({
    id: r.id,
    url: r.urls.regular,
    alt: r.alt_description || r.description || `${mood} mood image`,
    authorName: r.user.name,
    authorUrl: `${r.user.links.html}?utm_source=mood_atlas&utm_medium=referral`,
    width: r.width,
    height: r.height,
  }));
}
