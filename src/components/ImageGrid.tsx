import type { ImageResult } from '../types';
import { ImageCard } from './ImageCard';
import { STAGGER_OFFSETS } from '../lib/layout';

type Props = {
  images: ImageResult[];
};

export function ImageGrid({ images }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
      {images.map((image, i) => (
        <div
          key={image.id}
          className="lg:mt-[var(--stagger)] md:mt-[var(--stagger-md)]"
          style={{
            '--stagger': `${STAGGER_OFFSETS[i] ?? 0}px`,
            '--stagger-md': `${(STAGGER_OFFSETS[i] ?? 0) / 2}px`,
          } as React.CSSProperties}
        >
          <ImageCard image={image} />
        </div>
      ))}
    </div>
  );
}
