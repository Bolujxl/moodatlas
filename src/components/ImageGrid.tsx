import { useState } from 'react';
import type { ImageResult } from '../types';
import { ImageCard } from './ImageCard';

type Props = {
  images: ImageResult[];
};

const TILE_DELAYS = [0, 80, 120, 60, 180];

export function ImageGrid({ images }: Props) {
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const someoneIsHovered = hoveredCardId !== null;

  if (images.length < 5) {
    return (
      <p className="flex items-center justify-center h-full text-on-surface-variant">
        Not enough images found for this mood. Try another.
      </p>
    );
  }

  const renderCard = (image: ImageResult, position: string, delay: number) => (
    <div
      key={image.id}
      className={`${position}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <ImageCard
        image={image}
        isHovered={hoveredCardId === image.id}
        someoneIsHovered={someoneIsHovered}
        onHoverChange={(hovering) =>
          setHoveredCardId(hovering ? image.id : null)
        }
        gridPosition=""
      />
    </div>
  );

  return (
    <>
      {/* Mobile — vertical stack */}
      <div className="flex flex-col gap-2 px-4 pt-6 pb-28 md:hidden">
        {images.map((image, i) => renderCard(image, '', i))}
      </div>

      {/* Desktop — bento grid */}
      <div className="hidden md:grid grid-cols-3 grid-rows-3 gap-3 max-w-5xl mx-auto h-[70vh] px-8 w-full">
        {renderCard(images[0], 'col-span-1 row-span-2 overflow-hidden rounded animate-tile', TILE_DELAYS[0])}
        {renderCard(images[1], 'col-span-1 row-span-1 overflow-hidden rounded animate-tile', TILE_DELAYS[1])}
        {renderCard(images[2], 'col-span-1 row-span-1 overflow-hidden rounded animate-tile', TILE_DELAYS[2])}
        {renderCard(images[3], 'col-span-2 row-span-2 col-start-2 row-start-2 overflow-hidden rounded animate-tile', TILE_DELAYS[3])}
        {renderCard(images[4], 'col-span-1 row-span-1 overflow-hidden rounded animate-tile', TILE_DELAYS[4])}
      </div>
    </>
  );
}
