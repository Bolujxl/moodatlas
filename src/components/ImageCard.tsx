import type { ImageResult } from '../types';

type Props = {
  image: ImageResult;
  isHovered: boolean;
  someoneIsHovered: boolean;
  onHoverChange: (hovering: boolean) => void;
  gridPosition: string;
};

export function ImageCard({ image, isHovered, someoneIsHovered, onHoverChange, gridPosition }: Props) {
  const opacity = !someoneIsHovered ? 1 : isHovered ? 1 : 0.75;

  return (
    <div
      className={`relative overflow-hidden aspect-[4/3] rounded md:aspect-auto md:rounded w-full h-full transition-all duration-300 ease-out md:hover:scale-[1.02] md:hover:shadow-xl md:hover:z-10 md:shadow-none motion-reduce:transition-none ${gridPosition}`}
      style={{ opacity, transition: 'opacity 250ms ease-out, transform 300ms ease-out, box-shadow 300ms ease-out' }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <img
        src={image.url}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-background/60 md:bg-black/40">
        <span className="text-xs text-on-surface">
          Photo by{' '}
          <a
            href={image.authorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-on-surface"
          >
            {image.authorName}
          </a>
        </span>
      </div>
    </div>
  );
}
