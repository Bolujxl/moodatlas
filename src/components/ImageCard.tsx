import type { ImageResult } from '../types';

type Props = {
  image: ImageResult;
};

export function ImageCard({ image }: Props) {
  return (
    <div className="bg-surface-container border border-outline-variant rounded-md overflow-hidden">
      <div className="aspect-[4/3]">
        <img
          src={image.url}
          alt={image.alt}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-2 text-xs text-on-surface-variant">
        Photo by{' '}
        <a
          href={image.authorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-on-surface"
        >
          {image.authorName}
        </a>
      </div>
    </div>
  );
}
