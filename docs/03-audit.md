# Mood Atlas — Security & Resilience Audit

**Executive summary:** 0 CRITICAL, 0 HIGH, 6 MEDIUM, 3 LOW, 9 OK / BY DESIGN. The codebase is in good shape for a Demo-tier app. The six MEDIUM findings are real but small — each fixable in under 10 minutes. The top item to fix first is the **alt text fallback** (D1): images with null `alt_description` become invisible to screen readers, and the fix is a one-line change in `api.ts`.

---

## 1. API Key Exposure

### [OK / BY DESIGN] Client-side Access Key is bundled into production JS

**Where:** `src/lib/api.ts` (line 5), `.gitignore` (line 3), `.env.example` (line 1)

```ts
// src/lib/api.ts:5
const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
```

```ts
// .gitignore:3
.env
```

```
// .env.example:1
VITE_UNSPLASH_ACCESS_KEY=your-key-here
```

**The situation:** `Vite` replaces `import.meta.env.VITE_UNSPLASH_ACCESS_KEY` with the actual key at build time. Anyone can open the browser's Network tab or DevTools and read the key from the production JavaScript bundle. This is an **architectural limitation** of any client-side-only app — not a bug.

**Why it's acceptable here:** Unsplash's API has two key types: the **Access Key** (client-side, limited to 50 requests/hour) and the **Secret Key** (server-side only, for operations like user authentication). This codebase uses only the Access Key (`VITE_UNSPLASH_ACCESS_KEY`). The Secret Key (`VITE_UNSPLASH_SECRET_KEY`) is never referenced anywhere. Unsplash's Demo tier is designed with the Access Key's exposure in mind.

**What's correct about the current setup:**
- `.env` is in `.gitignore` — the real key never leaves the developer's machine.
- `.env.example` provides a placeholder for the README to reference.
- No Secret Key usage — no CRITICAL exposure.

**What a production app would do differently:** Proxy requests through a backend (e.g. a simple Express route or serverless function). The key lives on the server, the client talks to your server, your server talks to Unsplash. This app is a Demo — the extra infrastructure cost isn't justified here.

---

## 2. Race Conditions

### [OK] Race A — Different mood while loading

**Where:** `src/hooks/useMoodFetch.ts` (lines 24-26, 32, 37)

```ts
// useMoodFetch.ts:24-26
abortRef.current?.abort();
const controller = new AbortController();
abortRef.current = controller;

// useMoodFetch.ts:32, 37
if (controller.signal.aborted) return;
```

**How it works correctly:**
1. User clicks `calm`. `selectMood('calm')` creates a new `AbortController` and starts a fetch with its signal.
2. User clicks `loud`. `selectMood('loud')` calls `abortRef.current?.abort()` on the calm controller, then creates a fresh controller for loud.
3. The calm fetch's `.then` and `.catch` handlers both check `controller.signal.aborted` (where `controller` is calm's controller, preserved in the closure). The signal is aborted, so both handlers bail out — stale calm images never paint.

**Why the closure works correctly here:** Each invocation of `selectMood` creates its own `controller` variable. The `.then` and `.catch` callbacks close over that specific controller. When a new `selectMood` call creates a new controller and aborts the old one, the old callbacks check the old controller's signal — which is now aborted. No cross-contamination.

### [OK] Race B — Same mood spam

**Where:** `src/hooks/useMoodFetch.ts` (line 14)

```ts
// useMoodFetch.ts:14
if (mood === currentMood && state.status !== 'error') return;
```

**How it works correctly:**
1. User clicks `calm`. `currentMood` becomes `'calm'`, `state.status` becomes `'loading'`.
2. User clicks `calm` again. Guard check: `'calm' === 'calm'` (true) AND `'loading' !== 'error'` (true) → returns immediately. No duplicate fetch.
3. User clicks `calm` when it's already loaded (cache hit or completed fetch). `state.status` is `'success'`. Guard check: `'calm' === 'calm'` (true) AND `'success' !== 'error'` (true) → returns. No unnecessary re-render.

**The error escape hatch:** If `calm` failed and `state.status` is `'error'`, the guard's second condition fails (`'error' !== 'error'` is false), so clicking `calm` again passes through and re-fetches. This is also the path the `retry` function uses (lines 42-49), but a direct re-click works too.

### [OK] Race C — Clicking during error

**Where:** `src/hooks/useMoodFetch.ts` (line 14), `src/components/ErrorState.tsx` (lines 11-16)

Same guard as Race B. Two scenarios:

- **Same mood, error state:** `mood === currentMood` is true, `state.status !== 'error'` is false → guard passes → re-fetches `calm`. ✓
- **Different mood, error state:** `mood !== currentMood` → guard passes → fetches the new mood. ✓

The `ErrorState` component also has a Retry button wired to `retry()` (line 49), which deletes the cache entry and re-calls `selectMood` — same outcome, cleaner path specifically for retry.

### [LOW] Race E — setState after component unmounts

**Where:** `src/hooks/useMoodFetch.ts` (lines 30-38)

```ts
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

**The theoretical problem:** If the component using this hook unmounts during an in-flight fetch (and no new mood is selected to trigger an abort), the `.then` or `.catch` will call `setState` on an unmounted component. React 18+ doesn't throw for this in production, but it triggers a dev warning.

**Why it's LOW:** `App.tsx` — the only consumer of this hook — is the root component and never unmounts. This finding would only become real if the hook were reused in a child component that conditionally renders (e.g., embedded in a modal or tab panel). The fix (tracking a `mountedRef`) adds complexity for a scenario that doesn't exist today. Noted, but not urgent.

---

## 3. API Rate Limiting and Failure Modes

### [MEDIUM] Rate limit message is opaque

**Where:** `src/lib/api.ts` (line 24)

```ts
// api.ts:23-25
if (!response.ok) {
  throw new Error(`Unsplash returned ${response.status}`);
}
```

**The problem:** When Unsplash's 50-requests-per-hour cap is hit, it returns HTTP 429 (or sometimes 403 on the Demo tier). The current code throws `"Unsplash returned 429"`. The ErrorState component shows:

```
Couldn't load images.
Unsplash returned 429
```

The user sees a cryptic number. They don't know it means "you used all 50 requests — wait an hour." They might retry repeatedly, which does nothing.

**Real-world consequence:** A user testing the app by clicking through all five moods morning and night hits the cap by evening. They see an error page with no useful guidance. They might assume the app is broken and move on.

**Fix:** Check for 429/403 and provide a useful message:

```ts
// api.ts — replace lines 23-25
if (!response.ok) {
  if (response.status === 429 || response.status === 403) {
    throw new Error(
      'Rate limit reached — please wait an hour and try again.'
    );
  }
  throw new Error(`Unsplash returned ${response.status}`);
}
```

### [MEDIUM] Empty results render a blank grid

**Where:** `src/components/ImageGrid.tsx` (lines 9-44), `src/lib/api.ts` (line 28)

```tsx
// ImageGrid.tsx:9-44 — the grid renders but with zero children
export function ImageGrid({ images }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
      {images.map(...)}  // images is [], so map produces nothing
    </div>
  );
}
```

**The problem:** If Unsplash returns an empty `results` array (rare for these queries but possible — e.g., the search engine returns zero matches), `api.ts` returns `[]`. `ImageGrid` renders an empty grid. The user sees a blank space where images should be — no error, no "no results" message, no hint.

**Real-world consequence:** A mood query that produces no matches makes the app silently fail. The user clicked a mood, the skeleton shimmered, and then... nothing. They might think the loading never finished.

**Fix:** Guard in either `ImageGrid` or `App.tsx`. Cleanest: check in `ImageGrid`:

```tsx
// ImageGrid.tsx — add early return before the grid
if (images.length === 0) {
  return (
    <p className="text-center text-on-surface-variant py-16">
      No images found for this mood. Try another.
    </p>
  );
}
```

### [MEDIUM] No fetch timeout — infinite skeleton

**Where:** `src/lib/api.ts` (line 18), `src/hooks/useMoodFetch.ts` (line 30)

```ts
// api.ts:18 — no timeout option
const response = await fetch(url, {
  headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  signal,
});
```

**The problem:** If Unsplash's server hangs (TCP connection accepted but never responds), `fetch` will wait indefinitely. The abort signal would cancel it if the user changed moods, but if they wait patiently on a single mood, the skeleton shimmer spins forever. `fetch` has no built-in timeout.

**Real-world consequence:** A user on a slow or unstable connection clicks `calm`, sees the skeleton, and the skeleton stays. After 30 seconds of nothing, they think the app is broken and leave. A 10-second timeout is long enough for legitimate slow responses but short enough to feel responsive.

**Fix:** Add a timeout that triggers the existing `AbortController`:

```ts
// In useMoodFetch.ts, after line 26 (controller creation)
const timeoutId = setTimeout(() => controller.abort(), 10_000);

// In both .then and .catch (lines 31-39), add clearing:
clearTimeout(timeoutId);

// Full pattern:
const controller = new AbortController();
abortRef.current = controller;
const timeoutId = setTimeout(() => controller.abort(), 10_000);

setState({ status: 'loading' });

fetchMoodImages(mood, controller.signal)
  .then((images) => {
    clearTimeout(timeoutId);
    if (controller.signal.aborted) return;
    cacheRef.current[mood] = images;
    setState({ status: 'success', images });
  })
  .catch((err) => {
    clearTimeout(timeoutId);
    if (controller.signal.aborted) return;
    const message = err.name === 'AbortError'
      ? 'Request timed out — please try again.'
      : err.message;
    setState({ status: 'error', message });
  });
```

Note: when the timeout fires, the abort triggers a rejection with an `AbortError`. The `.catch` now distinguishes between a timeout abort (show "timed out" message) and a user-initiated abort (already handled by `if (controller.signal.aborted) return;` — but wait, a timeout abort also sets `signal.aborted` to true). The check needs refinement — the timeout abort and user-initiated abort both set `signal.aborted`. The fix above distinguishes by checking `err.name === 'AbortError'` AND `signal.aborted`:

Actually, simpler approach: don't use `AbortController.abort()` for the timeout. Use a separate flag:

Actually, even simpler: the `err.name` approach works because when the user changes moods, `selectMood` calls `abortRef.current?.abort()` which creates an `AbortError`, AND the handlers check `controller.signal.aborted` and bail out. When the timeout fires, `controller.abort()` also creates an `AbortError`, AND the handlers... would also see `controller.signal.aborted` and bail out silently, never reaching the `setState({ status: 'error', ... })` call. That's a problem.

Better approach:

```ts
.then((images) => {
  clearTimeout(timeoutId);
  if (controller.signal.aborted) return;
  cacheRef.current[mood] = images;
  setState({ status: 'success', images });
})
.catch((err) => {
  clearTimeout(timeoutId);
  // Check if this was a user-initiated abort (mood change)
  if (controller.signal.aborted && err.name === 'AbortError') return;
  // Otherwise, a real error (including timeout)
  setState({ status: 'error', message: err.message });
});
```

Wait, but the user-initiated abort also produces `err.name === 'AbortError'`. So both paths would be caught. The problem is distinguishing between "I aborted because the user changed moods" and "I aborted because of a timeout."

Best fix: use a `timeoutRef` to track whether the abort was timeout-initiated:

Actually, let me keep it simpler in the audit doc. The important thing is to flag the absence of a timeout. I'll propose a clean solution using `AbortSignal.timeout()` (which exists in some modern browsers) or a manual approach.

Let me use the cleanest possible solution in the doc:

```ts
// After abortRef.current = controller
const timeoutId = setTimeout(() => controller.abort(), 10_000);

// In catch
.catch((err) => {
  clearTimeout(timeoutId);
  if (controller.signal.aborted) {
    // If the abort was triggered externally (mood change or timeout),
    // and it's NOT a timeout, the caller handles it.
    // We can check: if err.name is AbortError and no other flag, it's a mood change.
    // Use a ref to distinguish.
    return;
  }
  setState({ status: 'error', message: err.message });
})
```

I'm overcomplicating this. Let me propose a clean solution using a `timedOutRef`:

In the hook:
```ts
const timedOutRef = useRef(false);

// Inside selectMood:
timedOutRef.current = false;

// After controller creation:
const timeoutId = setTimeout(() => {
  timedOutRef.current = true;
  controller.abort();
}, 10_000);

// In catch:
if (controller.signal.aborted) {
  if (timedOutRef.current) {
    setState({ status: 'error', message: 'Request timed out — try again.' });
  }
  clearTimeout(timeoutId);
  return;
}
```

Hmm, but this is getting complex. Let me just present a simpler version in the doc that captures the essence without over-engineering. The key point is: add a timeout.

Let me just show this:

```ts
// In the .catch, modify the message for AbortError
.catch((err) => {
  clearTimeout(timeoutId);
  if (err.name === 'AbortError') return; // mood change OR timeout — both safe to ignore
  setState({ status: 'error', message: err.message });
});
```

This is simpler. The timeout produces an AbortError which gets silenced — same as the mood change. The user sees the skeleton briefly and then... nothing? Actually no, when the timeout fires, the controller is aborted, the fetch throws AbortError, the catch catches it, sees AbortError, and returns silently. The state remains `{ status: 'loading' }` — the skeleton stays forever, same as before. That doesn't fix anything.

OK, the cleanest fix that actually works:

```ts
// Track whether we timed out
const didTimeoutRef = useRef(false);

// Inside selectMood, after creating controller:
didTimeoutRef.current = false;
const timeoutId = setTimeout(() => {
  didTimeoutRef.current = true;
  controller.abort();
}, 10_000);

// In .catch:
.catch((err) => {
  clearTimeout(timeoutId);
  if (controller.signal.aborted && !didTimeoutRef.current) return;
  const message = didTimeoutRef.current
    ? 'Request timed out. Please try again.'
    : err.message;
  setState({ status: 'error', message });
});
```

This is clean enough. I'll present this in the doc.

### [OK] Network offline — handled

**Where:** `src/hooks/useMoodFetch.ts` (line 38)

```ts
setState({ status: 'error', message: err.message });
```

When the browser is offline, `fetch` throws a `TypeError: Failed to fetch`. The `.catch` sets the error state with this message. The user sees:

```
Couldn't load images.
Failed to fetch
```

It's not the most user-friendly message, but it's informative enough for a Demo app. The retry button lets them try again when they're back online. No fix needed.

### [OK] Malformed response — handled

**Where:** `src/lib/api.ts` (lines 28-36)

```ts
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

If Unsplash returns a 200 but the JSON body is malformed — e.g., a missing `urls.regular` on one result, or `results` is absent entirely — the `.map()` will throw a `TypeError`. This throw propagates to the hook's `.catch()`, which sets the error state. The user sees the error message with whatever the TypeError says. Not pretty, but the app doesn't crash or render broken images.

---

## 4. Accessibility

### [MEDIUM] Images with null alt_description get empty alt text

**Where:** `src/lib/api.ts` (line 31), `src/components/ImageCard.tsx` (line 13)

```ts
// api.ts:31
alt: r.alt_description ?? '',
```

```tsx
// ImageCard.tsx:13
alt={image.alt}
```

**The problem:** When Unsplash returns `null` for `alt_description`, the `?? ''` fallback produces an empty string. The `<img alt="" />` is treated as decorative by screen readers — the image is silently skipped. Since these images are content (the primary purpose of the page), they should have meaningful alt text.

**Real-world consequence:** A screen reader user exploring a mood hears: "Photo by Alessio Soggetti. Photo by Annie Spratt." The images themselves are never described. They only know who took the photo, not what it shows.

**Fix:** Add a meaningful fallback for the alt text chain:

```ts
// api.ts — replace line 31
alt: r.alt_description || r.description || `${mood} mood image`,
```

Unsplash's `description` field is sometimes populated when `alt_description` isn't (it's a longer, user-written caption). If both are null/empty, fall back to a generated label that at least mentions the mood. This ensures every image has non-empty, non-null alt text.

Note: the `mood` variable is available in scope — it's the parameter passed to `fetchMoodImages`. The alt text becomes contextually relevant (e.g., "calm mood image" for the calm mood's results).

### [OK] Keyboard navigation — native `<button>` works

**Where:** `src/components/MoodButton.tsx` (line 13)

```tsx
<button
  className={...}
  onClick={() => onSelect(mood)}
>
  {mood}
</button>
```

The mood picker uses native `<button>` elements. These are keyboard-accessible by default: Tab moves focus between them, Enter and Space activate them. No `tabIndex` hacks, no `div onClick` anti-patterns. Focus rings are not suppressed by any CSS overrides — browsers show their default focus indicator. ✓

### [OK] Attribution links — `noopener` is set

**Where:** `src/components/ImageCard.tsx` (lines 22-23)

```tsx
<a
  href={image.authorUrl}
  target="_blank"
  rel="noopener noreferrer"
```

`target="_blank"` opens links in a new tab. Without `rel="noopener noreferrer"`, the new tab's page can access the parent window via `window.opener`, which is a phishing vector (the child page can redirect the parent to a malicious URL). Both attributes are present. ✓

### [MEDIUM] No aria-live announcements for state changes

**Where:** `src/App.tsx` (lines 34-45), `src/components/SkeletonGrid.tsx`, `src/components/ErrorState.tsx`

```tsx
// App.tsx:34-45 — state transitions happen, but nothing announces them
{state.status === 'idle' && (...)}
{state.status === 'loading' && <SkeletonGrid />}
{state.status === 'success' && <ImageGrid images={state.images} />}
{state.status === 'error' && <ErrorState message={state.message} onRetry={retry} />}
```

**The problem:** When `state.status` changes (idle → loading → success, or loading → error), React swaps the DOM content. A sighted user sees the change visually. A screen reader user — who relies on the screen reader to announce changes — hears nothing. The skeleton, the images, and the error message all appear silently.

**Real-world consequence:** A screen reader user clicks `calm`. They hear... nothing. They don't know the images are loading. They don't know when the images arrive. They have to manually navigate through the page to discover the new content.

**Fix:** Add an `aria-live="polite"` container around the grid area in `App.tsx`:

```tsx
// App.tsx:33 — replace the plain <div> with an aria-live region
<div className="mt-8" aria-live="polite" aria-atomic="true">
  {state.status === 'idle' && (...)}
  {state.status === 'loading' && (
    <>
      <span className="sr-only">Loading images...</span>
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
</div>
```

`aria-live="polite"` tells screen readers to announce changes to this region after the current task finishes (not interrupting). `aria-atomic="true"` tells them to read the entire content of the region, not just the changed part. The `sr-only` spans (Tailwind's screen-reader-only class) add invisible announcements that screen readers pick up without cluttering the visual UI.

The error state already includes visible text ("Couldn't load images."), so it announces itself naturally without needing an `sr-only` span.

### [MEDIUM] Skeleton shimmer doesn't respect reduced motion

**Where:** `src/components/SkeletonGrid.tsx` (lines 13, 28)

```tsx
// SkeletonGrid.tsx:13, 28
<div className="aspect-[4/3] bg-outline-variant animate-pulse" />
```

**The problem:** `animate-pulse` is a continuous opacity oscillation. For users with vestibular disorders (motion sensitivity, vertigo), any persistent animation — even a subtle pulse — can trigger dizziness, nausea, or disorientation.

**Real-world consequence:** The skeleton shimmer, while subtle to most people, can make the app physically uncomfortable for some users during the loading phase.

**Fix:** Disable the animation when the user has `prefers-reduced-motion` set in their OS. With Tailwind's `motion-reduce:` prefix:

```tsx
<div className="aspect-[4/3] bg-outline-variant animate-pulse motion-reduce:animate-none" />
```

Tailwind 3.4+ includes the `motion-reduce` variant. It adds `@media (prefers-reduced-motion: reduce)` around the generated CSS. When the OS-level reduced motion setting is on, the skeleton becomes a static rectangle instead of pulsing. The loading state is still visible, just without the animation.

### [LOW] No semantic grouping for mood buttons

**Where:** `src/components/MoodRow.tsx` (line 13)

```tsx
<div className="flex flex-wrap justify-center gap-2">
  {MOODS.map((mood) => (...))}
</div>
```

**The situation:** The five mood buttons are in a plain `<div>`. They could be in a `<nav>` (since they navigate between content states) or have `role="group"` with an `aria-label` (to identify the group to screen readers). Neither is present.

**Why it's LOW:** The buttons are clearly labelled ("calm", "loud", etc.), the page is small, and the page structure is simple. A screen reader user can discover the buttons by tabbing through them. The lack of grouping doesn't block any functionality — it just doesn't offer the shortcut of jumping to the group by its role. Not worth fixing at this scale, but noted.

---

## 5. Performance

### [OK] Bundle size is healthy

**Build output:**

```
dist/assets/index-sCe9ReMP.js   149.16 kB │ gzip: 48.04 kB
dist/assets/index-CSynwqjg.css   10.41 kB │ gzip:  2.82 kB
dist/index.html                   0.74 kB │ gzip:  0.40 kB
```

48KB gzipped JavaScript and 2.8KB gzipped CSS is **well within a healthy range** for a React + Tailwind app. React and ReactDOM alone account for roughly 40KB of the JS bundle — the app's own code adds under 10KB. The CSS is minimal because Tailwind tree-shakes unused classes. No stray libraries, no unminified output. ✓

### [LOW] No `decoding="async"` on images

**Where:** `src/components/ImageCard.tsx` (line 11)

```tsx
<img
  src={image.url}
  alt={image.alt}
  loading="lazy"
  className="w-full h-full object-cover"
/>
```

**The suggestion:** Add `decoding="async"` to the `<img>` tag. This tells the browser to decode the image off the main thread, preventing the image's decompression from janking the page during render.

```tsx
<img
  src={image.url}
  alt={image.alt}
  loading="lazy"
  decoding="async"
  className="w-full h-full object-cover"
/>
```

**Why it's LOW:** For five images on a fast connection, the main-thread decode time is negligible (a few milliseconds). The `decoding` hint is a best-practice polish, not a fix for a measurable problem. Include it for correctness, not for performance.

### [OK] Whole-app re-renders on mood change — expected

**Where:** `src/App.tsx` (lines 10, 34-45)

Every `setState` call in `useMoodFetch` triggers a re-render of `App`, which re-renders `MoodRow`, `ImageGrid`/`SkeletonGrid`/`ErrorState`, and every child. At five image cards, this is not a performance concern — React reconciles the virtual DOM in under a millisecond for this component count.

No `React.memo` is needed. Adding it would add conceptual complexity (and the risk of stale memoization) for zero perceptible improvement. Revisit if the app grows beyond ~50 cards.

---

## Prioritized Fix List

| Priority | Finding | File | What to change | Effort |
|---|---|---|---|---|
| 1 | Alt text fallback | `src/lib/api.ts:31` | Change `r.alt_description ?? ''` to `r.alt_description \|\| r.description \|\| \`${mood} mood image\`` | 2 min |
| 2 | Reduced motion respect | `src/components/SkeletonGrid.tsx:13,28` | Add `motion-reduce:animate-none` to the `animate-pulse` divs | 1 min |
| 3 | Rate limit message | `src/lib/api.ts:23-25` | Add 429/403 check with human-readable message | 3 min |
| 4 | Aria-live announcements | `src/App.tsx:33` | Wrap grid area in `aria-live="polite" aria-atomic="true"` with `sr-only` announcers | 5 min |
| 5 | Empty results guard | `src/components/ImageGrid.tsx` | Add `images.length === 0` check with "No images found" message | 3 min |
| 6 | Fetch timeout | `src/hooks/useMoodFetch.ts:26` | Add 10-second `AbortController` timeout with `timeoutRef` | 10 min |
