import type { ImageResult } from '../types';
import { ImageCard } from './ImageCard';

type Props = {
  images: ImageResult[];
};

export function ImageGrid({ images }: Props) {
  return (
    <div className="columns-1 md:columns-2 lg:columns-3 gap-3 max-w-5xl mx-auto">
      {images.map((image) => (
        <ImageCard key={image.id} image={image} />
      ))}
    </div>
  );
}
