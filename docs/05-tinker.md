# Mood Atlas — Tinker process

## Experiment: Spam-Clicking a Mood Button

Opened the app, opened the Network tab in DevTools (filtered to `unsplash`), and clicked the `calm` button five times in quick succession.

The app made **exactly one fetch request** to the Unsplash API. Not five. One. The five images loaded and displayed in the grid. Every click after the first did nothing — no new request, no flicker, no state change.

This is the line that stops the spam:

```ts
// src/hooks/useMoodFetch.ts — line 14
if (mood === currentMood && state.status !== 'error') return;
```

First click: `currentMood` is `null`, so the guard lets it through. `currentMood` gets set to `'calm'`, the fetch starts.

Every click after: `currentMood` is already `'calm'`, `state.status` is `'loading'` or `'success'` (not `'error'`), so the guard hits `return` immediately. The click is swallowed.

The `state.status !== 'error'` part is the deliberate escape — if the fetch failed, clicking the same mood again passes through and retries.

---

## Experiment: The Fetch Function as Middle-Man

The actual call to Unsplash lives in `src/lib/api.ts`:

```ts
// src/lib/api.ts — lines 18-20
const response = await fetch(url, {
  headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  signal,
});
```

This function stands between the app (which thinks in terms of moods) and the Unsplash API (which thinks in terms of URLs, headers, and JSON). The app says "give me calm images." The function builds the URL, attaches the API key, calls Unsplash, checks if the response was successful, and reshapes the raw JSON into the clean `ImageResult` objects the rest of the app uses.

The hook (`useMoodFetch`) never calls `fetch` directly. It calls `fetchMoodImages`. The hook doesn't know the Unsplash URL, the query parameters, or the response shape. It only knows the function name and its return type. This is why swapping Unsplash for a different API would only require rewriting this one file — the contract between the hook and the API layer is the function signature, nothing more.

---

## Experiment: The Cache

Clicked `calm` → waited for images → clicked `loud` → clicked `calm` again.

The second `calm` was instant. Zero network activity. The images appeared immediately from memory — no skeleton, no loading.

```ts
// src/hooks/useMoodFetch.ts — lines 18-21
const cached = cacheRef.current[mood];
if (cached) {
  setState({ status: 'success', images: cached });
  return;
}
```

The cache check happens before any network call. If `cacheRef.current['calm']` exists, the function sets state to success with the cached images and returns. The entire fetch — building the URL, calling `fetch`, parsing `response.json()` — is skipped. I went back through all five moods after fetching them once, and every one returned from cache instantly.

This is good: it reduces API calls against Unsplash's 50-requests-per-hour Demo tier and makes re-visiting a mood feel instant.

But it's also a trade-off: you can't get fresh images for the same mood without a page refresh. The cache lives in memory — nothing persists to disk or localStorage. Click `calm` ten times in one session and you'll see the same five images every time. If you want a different set, you refresh the page or pick a different mood.

For a mood board app, this trade-off is honest. A mood board captures a visual vibe at a moment. If you need different images for the same vibe, the queries already vary across moods — `serene minimal misty` (calm) and `empty solitude fog` (lonely) pull different aesthetics even if the emotional territory overlaps. A future stage could add a refresh button that clears the cache for the current mood and re-fetches, but that's a feature decision, not a missing feature.
