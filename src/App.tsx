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
    <div className="min-h-screen bg-background text-on-background">
      <header className="px-6 py-6 max-w-5xl mx-auto flex items-start gap-3">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcSet={logoDark} />
          <img
            className="w-9 h-9 flex-shrink-0 mt-0.5"
            src={logoLight}
            alt="Mood Atlas logo"
          />
        </picture>
        <div>
          <h1 className="text-3xl font-medium text-on-background">Mood Atlas</h1>
          <p className="text-on-surface-variant text-sm mt-0.5">
            Pull five images by mood
          </p>
        </div>
      </header>

      <main className="px-6 py-8 max-w-5xl mx-auto">
        <MoodRow selected={currentMood} onSelect={selectMood} />
        <div className="mt-8">
          {state.status === 'idle' && (
            <p className="text-center text-on-surface-variant py-16">
              Pick a mood to begin.
            </p>
          )}
          {state.status === 'loading' && <SkeletonGrid />}
          {state.status === 'success' && (
            <ImageGrid images={state.images} />
          )}
          {state.status === 'error' && (
            <ErrorState message={state.message} onRetry={retry} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
