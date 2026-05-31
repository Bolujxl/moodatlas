import { STAGGER_OFFSETS } from '../lib/layout';

export function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
      {STAGGER_OFFSETS.map((offset, i) => (
        <div
          key={i}
          className="lg:mt-[var(--stagger)] md:mt-[var(--stagger-md)]"
          style={{
            '--stagger': `${offset}px`,
            '--stagger-md': `${offset / 2}px`,
          } as React.CSSProperties}
        >
          <div className="bg-surface-container border border-outline-variant rounded-md overflow-hidden">
            <div className="aspect-[4/3] bg-outline-variant animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
