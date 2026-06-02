# Mood Atlas — Tinker Lab

This is a hands-on experimentation journal built on top of the walkthrough (`01-explanation.md`), the principles breakdown (`02-principles.md`), and the audit (`03-audit.md`). The first three docs tell you how the code works, why it's written that way, and what's fragile about it. This one is about **trying things and watching what happens** — opening the browser's DevTools, clicking buttons, reading the Network tab, and mapping real behavior back to specific lines in the source.

Each experiment describes what I did, what I expected, what actually happened, which lines of code explain the behavior, and what else you could try next.

---

## Experiment 1 — Spam-Clicking the Same Mood

### What I did

Opened the app, opened the Network tab in DevTools (filtered to `unsplash` so I only see API calls), and clicked the `calm` button five times in rapid succession.

### What I expected

Maybe five identical fetch requests? Maybe some would get blocked? I wasn't sure.

### What actually happened

The app made **exactly one fetch request** to the Unsplash API. Not five. Not one that was cancelled and restarted. One. The five images loaded once and displayed in the grid. Every subsequent click did absolutely nothing — no new request appeared in the Network tab, no flicker, the images stayed put.

### The line that explains it

The spam guard lives on a single line inside `src/hooks/useMoodFetch.ts`. The function `selectMood` starts with this check:

```ts
// src/hooks/useMoodFetch.ts — line 14
if (mood === currentMood && state.status !== 'error') return;
```

Here's what happens when I click `calm` five times:

**First click:** `mood` is `'calm'`, `currentMood` is `null` (nothing selected yet). `'calm' === null` is false, so the guard lets it through. The function sets `currentMood` to `'calm'`, checks the cache (empty), starts a fetch, and sets `state` to `'loading'`.

**Second click:** `mood` is `'calm'`, `currentMood` is now `'calm'` (set by the first click). `'calm' === 'calm'` is true. `state.status` is `'loading'`, which is not `'error'`. Both conditions are true — the guard hits `return`. The click is silently swallowed. No fetch. No state change. Nothing.

**Third, fourth, fifth clicks:** Same as the second. The guard catches them all.

### Why this is the right behavior

Without this guard, every click on the same mood would either start a duplicate fetch (wasting Unsplash's 50-requests-per-hour quota) or — after the cache kicks in — trigger an unnecessary re-render showing the same cached images. Neither produces new images: the query hasn't changed, so Unsplash would return the same five results.

The guard also has a deliberate escape hatch: `state.status !== 'error'`. If the fetch *failed* for this mood, clicking it again *does* pass through — the guard sees `'error' === 'error'` is false and lets the retry happen. So the same button that blocks useless re-fetches also lets failed ones retry. One line, two jobs.

### What to try next

- Click `calm`, wait for it to load, then click `calm` again. The second click is a cache hit — it returns instantly from `cacheRef.current`, no fetch at all. Watch the Network tab to confirm: zero new requests.
- Force an error (disconnect your network), click `calm`, see the error screen, then click `calm` again. This time the guard lets it through because `state.status === 'error'`.

---

## Experiment 2 — Switching Moods While Loading

### What I did

Clicked `calm`, then **immediately** clicked `loud` before the calm images appeared.

### What I expected

I'd see calm's images briefly flash, then be replaced by loud's. Or maybe both sets would arrive and I'd see whichever was slower.

### What actually happened

The Network tab showed two requests: one for calm (status: **cancelled**) and one for loud (status: **200 OK**). The skeleton shimmered for a moment, then loud's five images appeared. Calm's images never appeared — not even for a split second. The cancelled request stayed cancelled; its response was discarded.

### The lines that explain it

Three pieces of code work together for this:

**Piece 1 — The abort before starting fresh (`useMoodFetch.ts:24-26`):**

```ts
abortRef.current?.abort();
const controller = new AbortController();
abortRef.current = controller;
```

When I clicked `loud`, `selectMood('loud')` ran. Before it did anything else, it called `.abort()` on the calm request's controller — telling the browser "never mind, stop that fetch." Then it created a brand new controller for loud's fetch.

**Piece 2 — The fetch function receives the signal (`api.ts:18-20`):**

```ts
const response = await fetch(url, {
  headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  signal,
});
```

The `signal` is the controller's cancellation token. When the controller was aborted in the hook, the browser cancelled the in-flight `fetch` call. The Network tab marks it as "(cancelled)."

**Piece 3 — The stale result guards (`useMoodFetch.ts:32, 37`):**

```ts
// In the .then handler (success path) — line 32
if (controller.signal.aborted) return;

// In the .catch handler (error path) — line 37
if (controller.signal.aborted) return;
```

Even if calm's fetch had managed to sneak in a response before the abort fully took effect, the `.then` handler checks `controller.signal.aborted` before updating state. Since calm's controller was aborted by loud's arrival, the check returns early — calm's images are never stored in the cache and never painted on screen.

### Why this matters

Without this abort mechanism, two fetches would race. If calm's images arrived after loud's (because the network was slower for calm's request), calm's images would **overwrite** loud's on the screen. The user clicked `loud` but sees `calm` — a stale-paint bug. The abort-controller-cancel pattern prevents the race entirely. The Rule: whichever mood was clicked last is the one that wins.

### What to try next

- Click `calm`, `loud`, `warm`, `lonely`, `bright` as fast as you can. Check the Network tab: the first four requests should all show as "cancelled," and only `bright` should complete successfully with a 200. Five clicks, one winner — exactly what should happen.
- Throttle your network to "Slow 3G" in DevTools, then repeat the fast-clicking experiment. The cancellations work the same, but you can see the requests hanging in the Network tab for longer before they're aborted.

---

## Experiment 3 — The Cache Trade-Off

### What I did

Clicked `calm` → waited for images to load → clicked `loud` → clicked `calm` again.

### What I expected

Maybe another fetch for calm? Or nothing? I wasn't sure if the cache survived after I switched away.

### What actually happened

The second `calm` click was **instant**. The images appeared immediately — no skeleton, no loading delay, and the Network tab showed **zero new requests**. The app didn't talk to Unsplash at all the second time. It returned the exact same five images from the cache.

### The lines that explain it

The cache check happens before any network call in `useMoodFetch.ts`:

```ts
// src/hooks/useMoodFetch.ts — lines 18-21
const cached = cacheRef.current[mood];
if (cached) {
  setState({ status: 'success', images: cached });
  return;
}
```

The flow goes: click `calm` → check `cacheRef.current['calm']` → found → set state to success with cached images → `return` immediately. The entire fetch machinery — building the URL, calling `fetch`, waiting for `response.json()`, mapping the results — is skipped.

### The good side

This keeps Unsplash's 50-requests-per-hour rate limit from being chewed up by re-clicks on the same mood. If a user clicks `calm`, then `loud`, then `calm` again, that's two API calls instead of three. Across five moods and multiple visits, the savings add up. The second `calm` is also perceptually instant, which makes the app feel faster.

### The trade-off

The cache lives in memory — nothing survives a page refresh. Open the app, click `calm`, close the tab, reopen it, click `calm` again — that's a fresh fetch. The old images are gone.

More importantly, the cache means you cannot get *new* images for the same mood without a full page reload. Click `calm` ten times across a single session and you'll see the same five images every time.

Is that bad? For a mood board app — maybe not. A mood board is about capturing a visual *vibe* at a moment in time. You pick a mood, you get five images that define it, and you explore it visually. If you want a different set of calm images, you could:
- Pick a different mood (each mood has different queries, e.g. `serene minimal misty` vs `empty solitude fog`).
- Refresh the page — the cache clears, and the next `calm` click fetches fresh results.
- Use the retry button after an error, which intentionally deletes the cache entry (`useMoodFetch.ts:45`) and forces a fresh fetch.

For a production app, you could add a "refresh" button next to the mood label — a small icon that deletes the cache entry for the current mood and re-fetches, without a full page reload. But that's a deliberate feature decision, and for this stage of the app, the trade-off is honest.

### What to try next

- Refresh the page between experiments to clear the cache. The cache is in-memory only — no localStorage, no sessionStorage. Watch the Network tab: every first click after a refresh is a fresh fetch.
- Click all five moods, then go back through them in reverse order. All five return from cache instantly. Zero network activity. The app feels like it's reading from a local file.

---

## Experiment 4 — The Middle-Man Function

### What I looked at

The function `fetchMoodImages` in `src/lib/api.ts`.

```ts
// src/lib/api.ts — lines 7-10
export async function fetchMoodImages(
  mood: Mood,
  signal: AbortSignal,
): Promise<ImageResult[]> {
```

This function is the middle-man — or more accurately, the translator. It stands between the app (which thinks in terms of moods and image cards) and the Unsplash API (which thinks in terms of HTTP requests and raw JSON responses).

### What it does, step by step

**Step 1 — Build the URL (`api.ts:15-16`):**

```ts
const query = MOOD_QUERIES[mood];
const url = `${UNSPLASH_URL}?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;
```

The app says "give me warm." The query lookup translates that to "golden sunset cozy." Then the function glues it into a URL that Unsplash's server understands. The app never sees the query string or the URL — it only sees the result.

**Step 2 — Make the phone call (`api.ts:18-20`):**

```ts
const response = await fetch(url, {
  headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  signal,
});
```

`fetch` is the browser's built-in way to say "go to this address and bring me back what you find." The `Authorization` header is like showing a wristband at a club — no wristband, no entry. The `signal` is the cancel button the hook can press.

**Step 3 — Check if the call worked (`api.ts:23-25`):**

```ts
if (!response.ok) {
  throw new Error(`Unsplash returned ${response.status}`);
}
```

A quirk of `fetch`: it doesn't throw on 404 or 500 errors. It returns a response object with `ok: false`. Without this manual check, the function would try to read the JSON body of a 404 page and crash with a confusing error.

**Step 4 — Translate the response (`api.ts:27-36`):**

```ts
const data = await response.json();
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

Unsplash returns a big nested object full of fields we don't need. The `.map()` strips out everything except the seven fields the app actually uses. From this point forward, every component in the app receives a clean `ImageResult` object — small, predictable, typed.

### What makes this a "middle-man"

The hook (`useMoodFetch`) doesn't call `fetch` directly. It calls `fetchMoodImages`. The hook doesn't know the Unsplash URL, the API key format, the query parameters, or the response structure. It only knows "give me a mood and a signal, and I'll give you back an array of `ImageResult`."

This separation means you could swap Unsplash for a completely different API (Pexels, a local JSON file, a database) by rewriting exactly one file: `api.ts`. Nothing else in the codebase would need to change — same function name, same parameters, same return type. The contract between the hook and the API layer is the function signature, and nothing more.

### What to try next

- Break the API call on purpose. Open `api.ts`, change line 16's `per_page=5` to `per_page=999` (Unsplash's max is 30). Click a mood. The 400 error triggers the error state. Read the exact error message on screen — it'll say "Unsplash returned 400." Then change it back.
- Remove the `Authorization` header. Click a mood. The 401 error triggers the error state — "Unsplash returned 401." The app didn't crash. The error was caught by the hook's `.catch` and displayed gracefully.

---

## Why These Behaviors Matter Together

The three experiments — spam guard, cancellation, cache — aren't independent features. They're three expressions of the same idea: **the user's last click is the only one that counts.**

The spam guard prevents the user's *repeated same-mood* clicks from doing anything wasteful. The cancellation mechanism prevents the user's *changed-mood* clicks from being overridden by stale earlier requests. The cache makes the user's *returning-to-a-previous-mood* clicks instant and free.

All three work through the same hook (`useMoodFetch.ts`), and together they ensure that the Unsplash API is called as rarely as possible, that only the most recent mood's results ever paint on screen, and that the experience feels responsive even on the 50-request-per-hour Demo tier. The fetch function (`api.ts`) is the single seam where the network boundary lives — everything else is about controlling *when* and *how often* that seam is touched.
