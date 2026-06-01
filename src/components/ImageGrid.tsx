import type { ImageResult } from '../types';
import { ImageCard } from './ImageCard';
import { STAGGER_OFFSETS_TOP, STAGGER_OFFSETS_BOTTOM } from '../lib/layout';

type Props = {
  images: ImageResult[];
};

export function ImageGrid({ images }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
      <div
        className="lg:col-span-2 lg:mt-[var(--stagger)]"
        style={{ '--stagger': `${STAGGER_OFFSETS_TOP[0]}px` } as React.CSSProperties}
      >
        <ImageCard image={images[0]} />
      </div>
      <div
        className="lg:col-span-2 lg:mt-[var(--stagger)]"
        style={{ '--stagger': `${STAGGER_OFFSETS_TOP[1]}px` } as React.CSSProperties}
      >
        <ImageCard image={images[1]} />
      </div>
      <div
        className="lg:col-span-2 lg:mt-[var(--stagger)]"
        style={{ '--stagger': `${STAGGER_OFFSETS_TOP[2]}px` } as React.CSSProperties}
      >
        <ImageCard image={images[2]} />
      </div>

      <div
        className="lg:col-span-2 lg:col-start-2 lg:mt-[var(--stagger)]"
        style={{ '--stagger': `${STAGGER_OFFSETS_BOTTOM[0]}px` } as React.CSSProperties}
      >
        <ImageCard image={images[3]} />
      </div>
      <div
        className="lg:col-span-2 lg:mt-[var(--stagger)]"
        style={{ '--stagger': `${STAGGER_OFFSETS_BOTTOM[1]}px` } as React.CSSProperties}
      >
        <ImageCard image={images[4]} />
      </div>
    </div>
  );
}
