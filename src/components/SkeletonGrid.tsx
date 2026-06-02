import { STAGGER_OFFSETS_TOP, STAGGER_OFFSETS_BOTTOM } from '../lib/layout';

export function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
      {STAGGER_OFFSETS_TOP.map((offset, i) => (
        <div
          key={i}
          className="lg:col-span-2 lg:mt-[var(--stagger)]"
          style={{ '--stagger': `${offset}px` } as React.CSSProperties}
        >
          <div className="bg-surface-container border border-outline-variant rounded-md overflow-hidden">
            <div className="aspect-[4/3] bg-outline-variant animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
      ))}

      {STAGGER_OFFSETS_BOTTOM.map((offset, i) => (
        <div
          key={i + 3}
          className={[
            'lg:col-span-2 lg:mt-[var(--stagger)]',
            i === 0 ? 'lg:col-start-2' : '',
          ].join(' ')}
          style={{ '--stagger': `${offset}px` } as React.CSSProperties}
        >
          <div className="bg-surface-container border border-outline-variant rounded-md overflow-hidden">
            <div className="aspect-[4/3] bg-outline-variant animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}
