export function SkeletonGrid() {
  const tile = 'w-full h-full bg-outline-variant animate-skeleton motion-reduce:animate-none';

  return (
    <>
      {/* Mobile — vertical stack */}
      <div className="flex flex-col gap-2 px-4 pt-6 pb-28 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="aspect-[4/3] rounded overflow-hidden">
            <div className={tile} />
          </div>
        ))}
      </div>

      {/* Desktop — bento grid */}
      <div className="hidden md:grid grid-cols-3 grid-rows-3 gap-3 max-w-5xl mx-auto h-[70vh] px-8 w-full">
        <div className="col-span-1 row-span-2 overflow-hidden rounded">
          <div className={tile} />
        </div>
        <div className="col-span-1 row-span-1 overflow-hidden rounded">
          <div className={tile} />
        </div>
        <div className="col-span-1 row-span-1 overflow-hidden rounded">
          <div className={tile} />
        </div>
        <div className="col-span-2 row-span-2 col-start-2 row-start-2 overflow-hidden rounded">
          <div className={tile} />
        </div>
        <div className="col-span-1 row-span-1 overflow-hidden rounded">
          <div className={tile} />
        </div>
      </div>
    </>
  );
}
