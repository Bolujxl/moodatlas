# The Engineering Principles Behind Mood Atlas

This document is about the *ideas* in the code — not what each line does (that's `01-explanation.md`), but what thinking each line is an example of. Every section pairs a principle with the real lines that demonstrate it.

"Principles" here means habits of writing code that prevent certain classes of bugs before they happen. They're not rules someone wrote down first and then the code followed; they're patterns the code fell into because they solved a real problem.

---

## 1. Separation of Concerns — UI vs Data Fetching

**In plain words:** The code that talks to the network doesn't know React exists. The code that renders buttons and images doesn't know the word "Unsplash." They talk through a single bridge — the hook — and that's the only place the two worlds touch.

**Where it lives:** `src/lib/api.ts`, `src/lib/moodQueries.ts`, `src/hooks/useMoodFetch.ts`, `src/components/ImageCard.tsx`, `src/components/MoodButton.tsx`

### The network layer — no React in sight

```ts
// src/lib/moodQueries.ts (lines 3-8)
export const MOOD_QUERIES: Record<Mood, string> = {
  calm: 'serene minimal misty',
  loud: 'vibrant neon crowd',
  warm: 'golden sunset cozy',
  lonely: 'empty solitude fog',
  bright: 'sunlit airy white',
};
```

```ts
// src/lib/api.ts (lines 7-10)
export async function fetchMoodImages(
  mood: Mood,
  signal: AbortSignal,
): Promise<ImageResult[]> {
```

`moodQueries.ts` is a plain object lookup. `fetchMoodImages` is a plain async function. Neither imports `useState`, `useEffect`, `useRef`, or anything from React. Neither returns JSX. Neither knows what a component is.

### The UI layer — no network in sight

```tsx
// src/components/MoodButton.tsx (lines 12-22)
return (
  <button
    className={
      selected
        ? `${base} bg-primary text-on-primary`
        : `${base} border border-outline text-on-background hover:bg-surface-container`
    }
    onClick={() => onSelect(mood)}
  >
    {mood}
  </button>
);
```

```tsx
// src/components/ImageCard.tsx (lines 9-29)
<div className="bg-surface-container border border-outline-variant rounded-md overflow-hidden">
  <div className="aspect-[4/3]">
    <img
      src={image.url}
      alt={image.alt}
      loading="lazy"
      className="w-full h-full object-cover"
    />
  </div>
  <div className="p-2 text-xs text-on-surface-variant">
    Photo by{' '}
    <a ...>{image.authorName}</a>
  </div>
</div>
```

`MoodButton` receives a `mood` string and an `onSelect` callback — it doesn't know where the mood came from or what happens when you click. `ImageCard` receives an `image` object with `url`, `alt`, and `authorName` — it doesn't know the image came from Unsplash, from a local file, or from a database. These components would work unmodified if the data source changed completely.

### The bridge — the only place both worlds meet

```ts
// src/hooks/useMoodFetch.ts (lines 7-11, 30)
export function useMoodFetch() {
  const [currentMood, setCurrentMood] = useState<Mood | null>(null);
  const [state, setState] = useState<FetchState>({ status: 'idle' });
  const cacheRef = useRef<Cache>({});
  const abortRef = useRef<AbortController | null>(null);
  ...
  fetchMoodImages(mood, controller.signal)
```

The hook is the translator. It speaks React (`useState`, `useRef`, `useCallback`) on one side, and it calls the network function (`fetchMoodImages`) on the other. No other file in the codebase imports both `fetchMoodImages` and a React hook. This is the one seam.

**Why this app needed it:** If you wanted to swap Unsplash for Pexels tomorrow, you'd change exactly one file: `api.ts`. You'd write a new function with the same signature, leaving every other file untouched. The components don't need to know the API key format. The hook doesn't need to know the response shape. The swap is local to the network boundary. Without this separation, a provider change would mean hunting through components for hardcoded URLs, headers, and response field names spread across the codebase.

---

## 2. Discriminated Union State — Make Impossible States Impossible

**In plain words:** Instead of tracking loading, success, and error with separate booleans (which can be true at the same time), the app uses a single `status` field that can be exactly one of four things. The type system then guarantees you can't read image data while in the error state, or an error message while loading.

**Where it lives:** `src/types.ts`, `src/App.tsx`, `src/hooks/useMoodFetch.ts`

### The type — four shapes, one discriminant

```ts
// src/types.ts (lines 13-17)
export type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; images: ImageResult[] }
  | { status: 'error'; message: string };
```

Each branch of the union has a shared `status` field — that's the **discriminant**. TypeScript uses it to narrow the type: once you've checked `status === 'success'`, the compiler knows `images` exists on that branch. Try to access `images` under `status === 'error'`, and TypeScript refuses to compile. The bug is caught at write-time, not at runtime.

### The render switch — one branch per state

```tsx
// src/App.tsx (lines 34-45)
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
```

Four branches, one per state. Each branch is exclusive — React renders exactly one. No one can write `{isLoading && !error && <Grid />}` and accidentally render the grid alongside the skeleton because `isLoading` was true and `error` was also true. In a boolean model, that bug is possible. In a discriminated union, you'd need to write a fifth branch for the impossible state — and the explicit check (`status === 'something'`) makes it obvious it shouldn't exist.

### The hook — the state transitions

```ts
// src/hooks/useMoodFetch.ts (lines 9, 20, 28, 34, 38)
const [state, setState] = useState<FetchState>({ status: 'idle' });
// cache hit:
setState({ status: 'success', images: cached });
// fetch starts:
setState({ status: 'loading' });
// fetch succeeds:
setState({ status: 'success', images });
// fetch fails:
setState({ status: 'error', message: err.message });
```

Every `setState` call creates an entire new state object. No partial updates, no `setState({ isLoading: true })` while leaving the previous images array intact. The transition is atomic: the old state is completely replaced by the new one. There is no moment where `images` and `message` both exist.

**Why this app needed it:** The app has exactly four visual states (empty, skeleton grid, image grid, error message). Those four states map directly to four type branches. The discriminated union guarantees the mapping is exhaustive — forget the `loading` branch and TypeScript warns you. The alternative (three booleans: `isIdle`, `isLoading`, `hasError`) allows 2^3 = 8 combinations, only 4 of which are valid. The type system prevents the other 4 from ever existing.

---

## 3. Error Handling at the Source — Expected vs Unexpected Errors

**In plain words:** When you know a specific operation might fail (like a network call), catch the error right there and turn it into UI. Don't throw it up the component tree and hope a generic Error Boundary catches it. Reserve Error Boundaries for the things you genuinely didn't expect — a component crashing mid-render.

**Where it lives:** `src/hooks/useMoodFetch.ts`, `src/components/ErrorState.tsx`

### The catch — handling the expected failure

```ts
// src/hooks/useMoodFetch.ts (lines 30, 36-38)
fetchMoodImages(mood, controller.signal)
  .then((images) => {
    if (controller.signal.aborted) return;
    cacheRef.current[mood] = images;
    setState({ status: 'success', images });
  })
  .catch((err) => {
    if (controller.signal.aborted) return;
    setState({ status: 'error', message: err.message });
  });
```

The only thing that can fail in this app is the fetch. The `.catch()` handles that failure right where it happens. It turns the error into a state transition (`{ status: 'error', message: ... }`), and the UI picks that up through the discriminated union switch in `App.tsx`. The error never escapes this hook.

Note the guard: `if (controller.signal.aborted) return;`. When the user changes moods, we abort the previous fetch. The abort causes the fetch promise to reject — but that's not a real error, it's us telling ourselves to stop. The guard filters out self-inflicted rejections so only genuine failures (network down, Unsplash 500, missing API key) become error state.

### The UI — rendering the known failure

```tsx
// src/components/ErrorState.tsx (lines 8-17)
<div className="flex flex-col items-center justify-center gap-3 py-16">
  <p className="text-on-background text-base">Couldn't load images.</p>
  <p className="text-on-surface-variant text-sm">{message}</p>
  <button
    className="mt-2 px-5 py-2 rounded-md bg-tertiary text-on-tertiary text-sm font-medium hover:bg-tertiary/90 transition-colors"
    onClick={onRetry}
  >
    Retry
  </button>
</div>
```

The `ErrorState` component renders the message and a retry button. It receives `message` and `onRetry` as props — no error object, no try/catch inside it. It is a pure presentational component for a known state. It doesn't handle errors; it displays the result of error handling done elsewhere.

### What's not here — and why

There is no `ErrorBoundary` class component anywhere in the codebase. No `componentDidCatch`, no `getDerivedStateFromError`. That's correct.

Error Boundaries catch **render-time crashes** — a component throws because of a null reference, or a hook call breaks the Rules of Hooks, or an invariant fails. Those are unexpected errors. Mood Atlas has no path where a render should throw unexpectedly.

Error Boundaries also catch errors that **escape** a component's own handling. But Mood Atlas's `.catch()` at `useMoodFetch.ts:36` prevents the fetch error from escaping. By the time the error exists, it's already been converted to state.

**Why this app needed it:** The only failure mode is "the network call didn't work." That's an expected path. Handling it in-place (`.catch()` → set state → render error UI) keeps the failure handling visible and testable. An Error Boundary would hide it behind a generic fallback component, making the retry logic harder to wire up and obscuring the connection between "what failed" and "what the user sees."

---

## 4. Request Cancellation as Cleanup

**In plain words:** When the user clicks a new mood before the old one finishes loading, the old request is told to stop. The stale images never appear. This is the same idea as "clean up what you started" — the `AbortController` is the cleanup mechanism.

**Where it lives:** `src/hooks/useMoodFetch.ts`, `src/lib/api.ts`

### Starting a request with a cancel button

```ts
// src/hooks/useMoodFetch.ts (lines 24-26)
abortRef.current?.abort();
const controller = new AbortController();
abortRef.current = controller;
```

Before every new fetch, the previous one is aborted. `abortRef.current?.abort()` tells the old request to stop. Then a fresh controller is created and stored in the ref, ready for the next time the user changes moods.

### Passing the cancel button in (a light form of dependency injection)

```ts
// src/lib/api.ts (lines 7-10, 19-20)
export async function fetchMoodImages(
  mood: Mood,
  signal: AbortSignal,
): Promise<ImageResult[]> {
  ...
  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
    signal,
  });
```

The fetch function doesn't create its own `AbortController`. It receives `signal` as a parameter. This is dependency injection at its simplest: the thing that might change (who can cancel the request, and when) is passed in rather than hardcoded. The hook controls the cancellation policy (cancel when the mood changes). A future caller — say, a unit test — could pass its own signal with its own cancellation rules.

### The defense — checking if we were aborted

```ts
// src/hooks/useMoodFetch.ts (lines 31-38)
.then((images) => {
  if (controller.signal.aborted) return;
  cacheRef.current[mood] = images;
  setState({ status: 'success', images });
})
.catch((err) => {
  if (controller.signal.aborted) return;
  setState({ status: 'error', message: err.message });
});
```

Both handlers check `controller.signal.aborted` before mutating state. When the user clicks `calm` then quickly `loud`, the `calm` request gets aborted. The calm `.catch()` fires (because aborting is a rejection), sees the signal is aborted, and does nothing. The calm `.then()` — if it somehow fires after the abort — also sees the signal is aborted and does nothing. The stale result never paints.

### The companion: spam guard

```ts
// src/hooks/useMoodFetch.ts (line 14)
if (mood === currentMood && state.status !== 'error') return;
```

Cancellation handles "user clicked B while A was loading." This line handles the opposite case: "user clicked A while A was already selected." Without it, every re-click on the same mood would trigger the cache check, a no-op fetch start, or — before the cache was added — a duplicate network request. The guard prevents starting something that's already in flight or already resolved.

**Why this app needed it:** Without cancellation, clicking `calm` then quickly `loud` would produce a race condition. If the calm request was slower than the loud request, calm's images would arrive *after* loud's images and overwrite the screen. The user would see loud's images flicker away and calm's images appear — the wrong mood. Cancellation prevents the race entirely: calm's result is dropped before it can interfere.

---

## 5. Single Source of Truth

**In plain words:** Exactly one place owns the answer to "what should the screen show right now?" Every component that needs that answer asks the same place. No component keeps its own copy of loading status, error messages, or image arrays.

**Where it lives:** `src/hooks/useMoodFetch.ts`, `src/App.tsx`, `src/lib/layout.ts`

### The state lives in one hook

```ts
// src/hooks/useMoodFetch.ts (lines 7-11, 51)
export function useMoodFetch() {
  const [currentMood, setCurrentMood] = useState<Mood | null>(null);
  const [state, setState] = useState<FetchState>({ status: 'idle' });
  const cacheRef = useRef<Cache>({});
  const abortRef = useRef<AbortController | null>(null);
  ...
  return { currentMood, state, selectMood, retry };
}
```

All state lives in this one hook. Four pieces (`currentMood`, `state`, `cacheRef`, `abortRef`), two kinds of storage (`useState` for visible things, `useRef` for internal things). The hook returns four things — that's the entire public interface.

### The UI reads from one place

```tsx
// src/App.tsx (lines 9-10)
function App() {
  const { currentMood, state, selectMood, retry } = useMoodFetch();
```

`App.tsx` calls the hook once. Every decision about what to show flows from `state` (the discriminated union) and `currentMood` (which button is highlighted). No component has its own `useState` for "am I loading" or "do I have images." No prop drilling: `App` destructures the hook, passes pieces to children, and that's it.

### The decision switch

```tsx
// src/App.tsx (lines 34-45)
{state.status === 'idle' && (...)}
{state.status === 'loading' && <SkeletonGrid />}
{state.status === 'success' && <ImageGrid images={state.images} />}
{state.status === 'error' && <ErrorState message={state.message} onRetry={retry} />}
```

One switch, four branches. If a bug causes the screen to show the wrong thing, there's exactly one place to look: this switch and the `setState` calls in `useMoodFetch.ts`. There's no debugging trail through six components each with their own `isLoading` flag that somehow desynced.

### Shared layout constants — the same idea, applied to numbers

```ts
// src/lib/layout.ts (lines 1-2)
export const STAGGER_OFFSETS_TOP = [0, 24, 8];
export const STAGGER_OFFSETS_BOTTOM = [0, 24];
```

```ts
// src/components/ImageGrid.tsx (line 3)
import { STAGGER_OFFSETS_TOP, STAGGER_OFFSETS_BOTTOM } from '../lib/layout';

// src/components/SkeletonGrid.tsx (line 1)
import { STAGGER_OFFSETS_TOP, STAGGER_OFFSETS_BOTTOM } from '../lib/layout';
```

Both `ImageGrid` and `SkeletonGrid` import the same two arrays. If the stagger pattern changes, you change two numbers in one file, and both grids stay identical. The alternative — copying the arrays into each component — would allow them to drift apart over time, producing a visible jump when the skeleton swaps out for real images.

**Why this app needed it:** The app's complexity is in the state transitions, not in the component count. Concentrating all state in one hook means you can read the entire data flow by reading one file (`useMoodFetch.ts`) and one switch (`App.tsx`). Spreading state across components would make the same behavior spread across five or six files, each needing to be checked in isolation and in combination. The saved debugging time outweighs any abstraction purity.

---

## 6. Immutability — New Data, New Object

**In plain words:** When data changes, the entire object is replaced with a new one. Nothing is modified in place. This is a rule React depends on — it detects changes by checking if the reference is the same, not by deep-comparing every field.

**Where it lives:** `src/hooks/useMoodFetch.ts`, `src/lib/api.ts`

### State updates create new objects

```ts
// src/hooks/useMoodFetch.ts (lines 20, 28, 34, 38)
setState({ status: 'success', images: cached });   // cache hit
setState({ status: 'loading' });                    // fetch starts
setState({ status: 'success', images });            // fetch succeeds
setState({ status: 'error', message: err.message }); // fetch fails
```

Every state change is a new object literal. No code does `state.status = 'loading'` then passes the mutated object to `setState`. React's diffing algorithm uses reference equality (`===`) to decide whether to re-render. Mutating in place would keep the same reference — React would see the same object, assume nothing changed, and skip the re-render. The screen would freeze.

### API responses become new objects

```ts
// src/lib/api.ts (lines 28-36)
return data.results.map((r: any) => ({
  id: r.id,
  url: r.urls.regular,
  alt: r.alt_description ?? '',
  authorName: r.user.name,
  authorUrl: `${r.user.links.html}?utm_source=mood_atlas&utm_medium=referral`,
  width: r.width,
  height: r.height,
}));
```

The `.map()` creates a brand-new object for every image. The original Unsplash response object — with its dozens of extra fields — is left untouched. The mapped objects are clean `ImageResult` objects, and they're fresh allocations. Nothing downstream can accidentally mutate Unsplash's raw response because the codebase never holds a reference to it after this line.

### What's not in the codebase

There are zero calls to `.push()`, `.splice()`, `.sort()` (which mutates in place), `Object.assign()` on state, or direct property assignment on any state or props object. The entire codebase treats data objects as read-once, replace-never in place.

**Why this app needed it:** The app deals with arrays of images that React maps into components. If the image array were mutated in place (e.g., `images.push(newImage)`), React would see the same reference and skip re-rendering — the new image would never appear. By replacing the entire array (`setState({ images: newImages })`), React sees a new reference and re-renders correctly. The same applies to the `state` object itself: a mutated state object would break the discriminated union switch in `App.tsx` because React wouldn't know the status changed.

---

## How These Fit Together

The six principles aren't independent good ideas — they reinforce each other in this particular app.

**Separation of concerns** (principle 1) means the UI components receive data as props and callbacks. They don't fetch. **Single source of truth** (principle 5) means the data flows from one place. The combination is: one hook owns the state, the fetch function lives in an isolated file, and the components are pure receivers. You can read the app by following a single thread: `api.ts` fetches → `useMoodFetch.ts` manages state → `App.tsx` picks the component → leaf components render pixels.

**Discriminated union state** (principle 2) and **error handling at the source** (principle 3) combine to make the error state a first-class citizen. The error isn't a side effect that a generic boundary catches; it's a normal transition between states (`loading` → `error`), with a dedicated UI component. The retry button lives in `ErrorState.tsx`, calls `retry` from the hook, and the hook clears the cache and re-fetches — a closed loop.

**Request cancellation** (principle 4) and **immutability** (principle 6) combine to prevent the race condition bug: cancellation drops stale results before they can mutate state, and immutability ensures fresh results always produce a new object that React detects. If either were missing — if cancellation didn't abort stale requests, or if state updates mutated in place — the stale-paint bug would exist.

The light form of **dependency injection** inside principle 4 (`signal` as a parameter) is what makes cancellation *possible* at all. If `fetchMoodImages` created its own `AbortController` internally, the hook couldn't cancel it. The signal is the seam that lets the hook control the fetch's lifecycle while the fetch function stays oblivious to React.
