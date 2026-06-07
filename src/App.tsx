import { useMoodFetch } from './hooks/useMoodFetch';
import { MoodRow } from './components/MoodRow';
import { ImageGrid } from './components/ImageGrid';
import { SkeletonGrid } from './components/SkeletonGrid';
import { ErrorState } from './components/ErrorState';
import logoDark from '/logo-dark.svg';
import logoLight from '/logo.svg';

function App() {
  const { currentMood, state, selectMood, retry } = useMoodFetch();

  return (
    <div className="flex flex-col min-h-dvh bg-background text-on-background md:overflow-x-hidden">
      {/* Header — left title + right glass logo */}
      <header className="sticky top-0 z-50 flex items-start justify-between px-6 py-3 bg-background/80 backdrop-blur-md">
        <div className="animate-badge">
          <h1 className="text-xl md:text-2xl font-medium text-on-background">
            Mood Atlas
          </h1>
          <p className="text-on-surface-variant text-xs md:text-sm mt-0.5">
            Pull five images by mood
          </p>
        </div>

        <div className="animate-badge w-12 h-12 md:w-16 md:h-16 rounded-lg md:rounded-xl bg-surface/70 backdrop-blur-md border border-outline-variant shadow-lg flex items-center justify-center p-1 flex-shrink-0">
          <picture>
            <source media="(prefers-color-scheme: dark)" srcSet={logoDark} />
            <img
              className="w-full h-full"
              src={logoLight}
              alt="Mood Atlas logo"
            />
          </picture>
        </div>
      </header>

      {/* Grid area — flex-1 fills remaining vertical space */}
      <main
        className="flex-1 flex items-center justify-center md:items-start md:pt-6 md:overflow-hidden"
        aria-live="polite"
        aria-atomic="true"
      >
        {state.status === 'idle' && (
          <p className="text-on-surface-variant">
            Pick a mood to begin.
          </p>
        )}
        {state.status === 'loading' && (
          <>
            <span className="sr-only">Loading images…</span>
            <SkeletonGrid />
          </>
        )}
        {state.status === 'success' && (
          <>
            <span className="sr-only">Five images loaded.</span>
            <ImageGrid images={state.images} />
          </>
        )}
        {state.status === 'error' && (
          <ErrorState message={state.message} onRetry={retry} />
        )}
      </main>

      {/* MoodRow — fixed bottom pill */}
      <MoodRow
        selected={currentMood}
        onSelect={selectMood}
      />
    </div>
  );
}

export default App;
