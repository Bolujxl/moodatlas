export type Mood = 'calm' | 'loud' | 'warm' | 'lonely' | 'bright';

export type ImageResult = {
  id: string;
  url: string;
  alt: string;
  authorName: string;
  authorUrl: string;
  width: number;
  height: number;
};

export type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; images: ImageResult[] }
  | { status: 'error'; message: string };
