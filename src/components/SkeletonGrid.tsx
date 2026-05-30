const SKELETON_RATIOS = [3 / 4, 4 / 3, 1 / 1, 3 / 4, 4 / 3];

export function SkeletonGrid() {
  return (
    <div className="columns-1 md:columns-2 lg:columns-3 gap-3 max-w-5xl mx-auto">
      {SKELETON_RATIOS.map((ratio, i) => (
        <div
          key={i}
          className="break-inside-avoid mb-3 bg-surface-container border border-outline-variant rounded-md overflow-hidden relative"
        >
          <div style={{ aspectRatio: ratio }}>
            <div className="absolute inset-0 skeleton-shimmer" />
          </div>
          <div className="px-3 py-2">
            <div className="h-3 w-2/3 bg-surface-container-high rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
