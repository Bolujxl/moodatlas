# How Mood Atlas Works — A Walkthrough

This is a tour of every file in Mood Atlas, in the order the code actually runs. It's written for someone who's comfortable opening a file but not quite sure what every line does yet. Read top to bottom — each section builds on the last.

If you get lost, skip to the very end. There's a recap of the four spots where almost everyone trips up on their first read.

---

## `src/vite-env.d.ts` — TypeScript's Permission Slip

```ts
/// <reference types="vite/client" />
```

**What this file's job is:** Tell TypeScript to stop complaining when we import things it doesn't natively understand — like `.svg` files, `.css` files, and `import.meta.env`.

This is a one-line file. A single line, but without it, the project wouldn't compile.

The `/// <reference ... />` comment is a **triple-slash directive**. Think of it as a handshake: Vite published a set of TypeScript definitions that describe every special import it supports. The reference directive says "TypeScript, before you check my code, read those definitions too."

After this line, TypeScript knows:
- `import logo from '/logo.svg'` is fine — SVG imports produce a string (the processed URL).
- `import './index.css'` is fine — CSS imports have no value, they're side-effects.
- `import.meta.env.VITE_UNSPLASH_ACCESS_KEY` exists and is `string | undefined`.

Without these definitions, TypeScript would error on every one of those lines. The file itself does nothing at runtime. It's purely a conversation between you and the TypeScript compiler.

---

## `src/types.ts` — The Shapes Our Data Must Follow

```ts
export type Mood = 'calm' | 'loud' | 'warm' | 'lonely' | 'bright';
```

**What this file's job is:** Define the three core shapes (types) every other file agrees on. No logic, no functions, no UI — just the blueprints.

The first line defines a **union type** called `Mood`. The name comes from set theory — a "union" is the combination of several things. Here the union is: `Mood` can be exactly one of five words. Nothing else.

```ts
export type ImageResult = {
  id: string;
  url: string;
  alt: string;
  authorName: string;
  authorUrl: string;
  width: number;
  height: number;
};
```

The second type is a big one. `ImageResult` describes what every image card needs to render. Seven fields, each with a type annotation:

- `id` — a unique label from Unsplash, so React knows which card is which.
- `url` — the actual image address. This is what `<img src={url}>` uses.
- `alt` — the description of the image (empty string if Unsplash didn't provide one).
- `authorName` — the photographer's name, for credit.
- `authorUrl` — the link to their Unsplash profile.
- `width` and `height` — the image's original dimensions. Even though the current layout makes every card the same aspect ratio (`4/3`), these fields are kept for future flexibility. They cost nothing to store.

```ts
export type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; images: ImageResult[] }
  | { status: 'error'; message: string };
```

This is the most important type in the project — the **discriminated union**. Four shapes, one per possible state the app can be in:

- `idle` — the user hasn't clicked anything yet. No data, no error, no loading.
- `loading` — a fetch is in the air. Images haven't arrived yet.
- `success` — images arrived. The `images` array is guaranteed to exist *only* in this branch.
- `error` — the fetch failed. A `message` string explains why, and only this branch has it.

The `status` field is the **discriminant** — the field that tells TypeScript which branch you're in. When you write `if (state.status === 'success')`, TypeScript narrows the type inside that block so `state.images` is available. Try to read `state.images` when `status` is `'error'`, and TypeScript refuses to compile. This is the type system doing bug prevention at write-time.

---

## `src/lib/moodQueries.ts` — Mood Words → Search Terms

```ts
import type { Mood } from '../types';

export const MOOD_QUERIES: Record<Mood, string> = {
  calm: 'serene minimal misty',
  loud: 'vibrant neon crowd',
  warm: 'golden sunset cozy',
  lonely: 'empty solitude fog',
  bright: 'sunlit airy white',
};
```

**What this file's job is:** Translate our simple mood names into rich search phrases for Unsplash.

The `import type` on line 1 is special — it imports the shape of `Mood` for compile-time checking only, but doesn't bring any runtime code. After compilation, this import vanishes. It's a hint to both the bundler and the next developer: "I only need the type, not the value."

`Record<Mood, string>` means "an object where every key is a `Mood` and every value is a `string`." TypeScript enforces that all five moods appear — forget one, and the compiler says no. Add a sixth key that isn't a `Mood`, same result. The type is a checklist.

Each value is three words, space-separated. Why three? Unsplash's search ranks images by how well they match the full query string. `calm` alone returns generic stock photos of people meditating. `serene minimal misty` returns moody landscapes with negative space, soft whites, and fog — images that *feel* calm. One word is a label; three words are a vibe. The aesthetics matter because this app is for designers doing visual research.

The function is a lookup table. No logic, no conditionals — just five rows of data. That's intentional. If we added a sixth mood later, we'd only touch two files: this one (new query) and `types.ts` (new union member).

---

## `src/lib/layout.ts` — The Stagger Rhythm

```ts
export const STAGGER_OFFSETS_TOP = [0, 24, 8];
export const STAGGER_OFFSETS_BOTTOM = [0, 24];
```

**What this file's job is:** Hold the numbers that give our grid its musical offset pattern, split into a top row and a bottom row so each row can rest at its own baseline.

Two arrays now, not one. When the grid was refactored to center the bottom row, the single array `[0, 24, 8, 0, 24]` was split in two:

- `STAGGER_OFFSETS_TOP` covers the three cards in the top row: card 1 at baseline (0px), card 2 dropped 24px, card 3 nudged 8px.
- `STAGGER_OFFSETS_BOTTOM` covers the two cards in the centered bottom row: card 4 at baseline (0px), card 5 dropped 24px.

The bottom row's offsets restart at 0. The eye reads the bottom row as a fresh visual line, not a continuation of the top row's rhythm. Continuing the offset from where card 3 left off (+8) would make the bottom row feel forced.

Two lines, two arrays, imported by both `ImageGrid` and `SkeletonGrid`. Change one number here and both grids follow — same single source of truth principle as before, just split into top and bottom.

---

## `src/lib/api.ts` — The Phone Call to Unsplash

```ts
import type { Mood, ImageResult } from '../types';
import { MOOD_QUERIES } from './moodQueries';

const UNSPLASH_URL = 'https://api.unsplash.com/search/photos';
const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
```

**What this file's job is:** Go get five images from Unsplash for a given mood, and hand them back in our format.

Those first four lines set the stage. `UNSPLASH_URL` is the address we'll call — Unsplash's search endpoint. `ACCESS_KEY` reads from a special file in your project root called `.env` (which is gitignored — it never leaves your computer). `import.meta.env` is Vite's way of exposing environment variables to the frontend. Any variable prefixed with `VITE_` is available here.

If the `.env` file has `VITE_UNSPLASH_ACCESS_KEY=p9x8...`, then at build time Vite replaces this line with the actual key. At runtime, it's just a string.

```ts
export async function fetchMoodImages(
  mood: Mood,
  signal: AbortSignal,
): Promise<ImageResult[]> {
```

The function signature tells us: "Give me a mood and an abort signal, and I'll give you back a promise that eventually resolves to an array of `ImageResult` objects."

`async` means this function can use `await` inside it. `Promise<ImageResult[]>` means it doesn't return the images right now — it returns a *promise* that will hand over the images when they're ready. A promise is like a ticket at a deli counter: you don't get your sandwich immediately, but you get a number, and when your number is called, the sandwich is there.

`AbortSignal` is the cancel button. Don't worry about it yet — we'll spend a lot of time on it in the hook. For now: it's a flag that says "actually, never mind."

```ts
  if (!ACCESS_KEY) {
    throw new Error('Missing VITE_UNSPLASH_ACCESS_KEY — see README.');
  }
```

First thing the function does: check if the key exists. If you forgot to create `.env` or left the placeholder value, this throws immediately. A thrown `Error` inside an async function means the returned promise rejects — which our hook catches and turns into the error state on screen. Better to fail loudly here than to make a request that Unsplash will reject with a confusing 401.

```ts
  const query = MOOD_QUERIES[mood];
  const url = `${UNSPLASH_URL}?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;
```

Two lines that build the full URL. `MOOD_QUERIES[mood]` looks up the three-word phrase for this mood (e.g. clicking `warm` pulls out `'golden sunset cozy'`). Then we glue it into a URL string using a **template literal** — the backtick syntax with `${...}` holes you can fill.

`encodeURIComponent(query)` is important. If we just dropped `'golden sunset cozy'` into the URL raw, the spaces would break things. `encodeURIComponent` turns spaces into `%20`, so the final URL reads `...?query=golden%20sunset%20cozy&per_page=5&orientation=landscape`. Every browser and server understands this encoding.

The query parameters are:
- `query` — the mood's search phrase.
- `per_page=5` — we always want exactly 5 images.
- `orientation=landscape` — horizontal images fill the card shape better.

```ts
  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
    signal,
  });
```

Now the actual phone call. `fetch` is the built-in browser function for making HTTP requests. Think of it as: you dial a URL, wait for the other end to pick up, and get back a response.

The second argument to `fetch` is an **options object** with two important things:

**`headers`** — extra information you send with the request, like writing a subject line on an envelope. The `Authorization` header is your wristband. Unsplash's server only talks to callers who identify themselves. Without it, you get a 401 (not authorized — the server hangs up on you).

**`signal`** — the abort signal from the hook. If the hook cancels this request before it finishes, `fetch` notices the signal was aborted and throws an `AbortError`. More on this in the hook.

```ts
  if (!response.ok) {
    if (response.status === 429 || response.status === 403) {
      throw new Error('Rate limit reached — please wait an hour and try again.');
    }
    throw new Error(`Unsplash returned ${response.status}`);
  }
```

This line surprises a lot of beginners. `fetch` is *weird* about errors. If the server sends back a 404 (not found) or 500 (server broke), `fetch` doesn't throw an error — the promise resolves normally. You have to check `response.ok` yourself.

`response.ok` is a boolean that's `true` for status codes 200-299 and `false` for everything else.

The app now handles rate limits specially. Unsplash's Demo tier allows 50 requests per hour. When that cap is hit, the API returns HTTP 429 (or sometimes 403). Without the extra check, the user would see a cryptic "Unsplash returned 429" with no idea what it means or what to do. The app now recognizes those status codes and throws a human-readable message: "Rate limit reached — please wait an hour and try again." The user sees that on screen and knows exactly what happened.

```ts
  const data = await response.json();
```

`response.json()` reads the response body and parses it from text into a JavaScript object. The response comes over the network as a long string of JSON. `json()` translates that string into something you can index with dots and brackets (`data.results[0].urls.regular`).

This is also `await`-ed because parsing a large JSON body takes a moment. Without the `await`, `data` would be a Promise, not the actual object.

```ts
  return data.results.map((r: any) => ({
    id: r.id,
    url: r.urls.regular,
    alt: r.alt_description || r.description || `${mood} mood image`,
    authorName: r.user.name,
    authorUrl: `${r.user.links.html}?utm_source=mood_atlas&utm_medium=referral`,
    width: r.width,
    height: r.height,
  }));
```

The final step: reshaping. Unsplash's response is a big object with layers of nested data. Under `data.results`, each image has dozens of fields: different sizes, exif data, tags, collections, sponsorship info. We only need seven things.

`.map()` visits every element of `data.results` and calls a function on it. Our function picks seven fields out of the Unsplash result and returns a small, clean object matching our `ImageResult` type.

`(r: any)` — the Unsplash response object is `any` because we haven't written a full type for it. We could, but for a single endpoint in a small app, it's wasted effort. The `.map()` produces typed `ImageResult` objects, so from here on, everything is type-safe.

The `alt` field uses a three-stage fallback chain: `r.alt_description || r.description || \`${mood} mood image\``. Unsplash's `alt_description` is an AI-generated short description — it's usually populated but sometimes null. The `description` field is a longer, user-written caption — sometimes present when `alt_description` isn't. If both are empty, the fallback generates a contextual label like "calm mood image." This ensures every image has non-empty alt text for screen readers. Using `||` (logical OR) instead of `??` (nullish coalescing) means an empty string `""` also triggers the fallback — better to say "calm mood image" than nothing at all.

The `authorUrl` has UTM parameters appended: `?utm_source=mood_atlas&utm_medium=referral`. Unsplash's API terms *require* this for attribution. It tells Unsplash that the traffic came from our app, so they can track usage. It doesn't change the link destination — it still goes to the photographer's profile — but it adds invisible tracking tags.

---

## `src/hooks/useMoodFetch.ts` — The Brain of the App

```ts
import { useState, useRef, useCallback } from 'react';
import type { Mood, ImageResult, FetchState } from '../types';
import { fetchMoodImages } from '../lib/api';

type Cache = Partial<Record<Mood, ImageResult[]>>;
```

**What this file's job is:** Manage everything about selecting a mood and getting its images: picking a mood, caching results, cancelling stale requests, blocking spam clicks, and retrying on failure. This is the file that does the most with the fewest lines.

The `Cache` type on line 5 is a helper. `Record<Mood, ImageResult[]>` means "an object where every key is a Mood and every value is an array of ImageResults." `Partial<...>` makes all keys optional — so `{}` is a valid Cache, `{ calm: [...images] }` is valid, but accessing `cache['lonely']` might give you `undefined`. This matches how a real cache works: some moods have been fetched, some haven't.

```ts
export function useMoodFetch() {
  const [currentMood, setCurrentMood] = useState<Mood | null>(null);
  const [state, setState] = useState<FetchState>({ status: 'idle' });
  const cacheRef = useRef<Cache>({});
  const abortRef = useRef<AbortController | null>(null);
```

Four pieces of state, but they're stored in two different kinds of box.

**`useState`** is for things that should update the screen when they change. `currentMood` tells the buttons which one is selected. `state` tells `App.tsx` whether to show skeletons, images, or an error. When either changes, React re-renders the component.

**`useRef`** is for things that survive between renders but should NOT trigger a re-render when they change. Think of it like a drawer in the back room versus a shelf in the shop window. Customers (the UI) should see what's on the shelf. The drawer holds things the shopkeeper needs, but changing them doesn't affect the display.

- `cacheRef` holds our cache of fetched images. When calm's images arrive, we store them here. If we used `useState` for this, every cache write would trigger a re-render — unnecessary, because the cache itself doesn't appear on screen, only the current mood's images do.
- `abortRef` holds the current AbortController. We need to reach into it later to cancel a request, but changing it shouldn't flash the screen.

(The jargon: `useRef` returns an object with a `.current` property. The object itself is the same on every render; only `ref.current` changes. `useState` returns a tuple of `[value, setter]` where calling the setter schedules a re-render.)

```ts
  const selectMood = useCallback((mood: Mood) => {
    if (mood === currentMood && state.status !== 'error') return;
```

The spam guard. `selectMood` is the core function — every mood click calls it.

Line 14 says: "If the user clicked the same mood that's already selected, AND the state isn't an error, do nothing."

The `state.status !== 'error'` escape is crucial. Without it, if `calm` failed to load, the retry button wouldn't work — clicking `calm` again would be swallowed by the spam guard. But if `calm` *is* in error state, we want to allow a re-click (which triggers a fresh fetch, equivalent to retry from the button itself).

```ts
    setCurrentMood(mood);
```

Record which mood is selected. This triggers a re-render so the correct button lights up as "selected."

```ts
    const cached = cacheRef.current[mood];
    if (cached) {
      setState({ status: 'success', images: cached });
      return;
    }
```

The cache check. Before making any network call, we check if we've already fetched this mood, using `cacheRef.current[mood]`.

If found (a **cache hit**): update the screen instantly with the cached images, and `return` immediately — no fetch happens. The user clicks `calm`, then `loud`, then `calm` again. The second calm is instant and free. Without this, every re-click would make another API call, burning through Unsplash's rate limit and making the user wait for data they already have.

If not found (a **cache miss**): we fall through to the lines below.

```ts
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
```

Now we get to the abort controller — the most important mechanics in the file.

Imagine this scenario: you click `calm`, which starts a fetch. Before the first fetch finishes, you click `loud`. Two things must happen:
1. The old `calm` fetch should be told to stop.
2. A new `loud` fetch should start.

Line 24 tells the old fetch: "never mind, stop what you're doing." `abortRef.current?.abort()` cancels the previously running request. The `?.` (optional chaining) handles the first-ever click, when `abortRef.current` is `null` — it safely does nothing.

Line 25-26 creates a fresh new AbortController for the upcoming fetch and stores it in the ref. Each fetch gets its own controller, so when this fetch is later abandoned for another mood, there's a handle to pull.

This is like calling a friend to ask them to look something up, then calling again about something else *before they answer*. You want to tell them "stop looking up the first thing" — otherwise they'll call you back with the wrong answer, and you'll accidentally show the user calm's images when they already asked for loud's.

```ts
    setState({ status: 'loading' });
```

Updating the screen to show skeletons. This is the moment the pulsing ghost cards appear.

But before firing the fetch, the hook sets a safety timer:

```ts
    const timedOut = { current: false };
    const timeoutId = setTimeout(() => {
      timedOut.current = true;
      controller.abort();
    }, 10_000);
```

A ten-second timeout. If the fetch hasn't completed in ten seconds, the abort controller fires — cancelling the request. The `timedOut` flag tracks *why* the abort happened, so the catch handler can tell the difference between "user changed moods" (silent abort) and "request took too long" (show an error).

The `timedOut` variable is a plain object (`{ current: false }`), not a `useRef`. It doesn't need to survive between renders — it only needs to be accessible inside the `.then` and `.catch` closures below. Creating it fresh inside `selectMood` is simpler and avoids another ref.

```ts
    fetchMoodImages(mood, controller.signal)
      .then((images) => {
        clearTimeout(timeoutId);
        if (controller.signal.aborted) return;
        cacheRef.current[mood] = images;
        setState({ status: 'success', images });
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        if (controller.signal.aborted && !timedOut.current) return;
        setState({
          status: 'error',
          message: timedOut.current
            ? 'Request timed out — please try again.'
            : err.message,
        });
      });
  }, [currentMood, state.status]);
```

The actual fetch call. `fetchMoodImages` returns a Promise. We attach two handlers:

**`.then()`** — this runs if the fetch succeeded. First thing: `clearTimeout(timeoutId)` — the fetch finished before the 10-second timer fired, so we cancel the scheduled abort. Next: check `controller.signal.aborted`. If the signal was aborted (user changed moods), bail out silently. If not: store the images in the cache and update the screen.

**`.catch()`** — this runs if the fetch failed. First thing: `clearTimeout(timeoutId)` — same as above, clean up the timer. Next: the decision. `if (controller.signal.aborted && !timedOut.current) return;` — if the signal was aborted AND it wasn't because of a timeout, bail out. That's the "user changed moods" case. If the signal was aborted BECAUSE of a timeout (`timedOut.current` is true), we don't return — we set the error state with a "timed out" message. If the error is real (network down, Unsplash 500, rate limit), we set the error state with the actual error message.

This three-way split — timeout, mood-change abort, real error — gives the user appropriate feedback for each failure mode. The skeleton doesn't spin forever. The user isn't shown a confusing "AbortError" when the network is just slow. And stale moods never overwrite the current one.

After the closing brace of `selectMood`, we see `}, [currentMood, state.status])`. This is the **dependency array** of `useCallback`. It tells React: "recreate this function only when these two values change."

What if `currentMood` weren't in the array? The spam guard `if (mood === currentMood ...)` would compare against a stale value. After clicking `calm` and then `loud`, the function would still think `currentMood` is `'calm'` and would silently swallow clicks until something forced a re-creation. The dependency array is what keeps the function aware of the present.

What if `state.status` weren't in the array? The retry escape hatch (`state.status !== 'error'`) would read a stale `state.status`. After a failed fetch, the function might still think everything is fine and block the retry.

```ts
  const retry = useCallback(() => {
    if (currentMood) {
      delete cacheRef.current[currentMood];
      selectMood(currentMood);
    }
  }, [currentMood, selectMood]);
```

The retry function. Simpler than before — two steps: delete the cache entry for the current mood (forcing a fresh fetch), then call `selectMood` with that same mood.

`if (currentMood)` — guard against retrying when nothing is selected (there will always be something selected if the error is showing, but the guard is correct practice).

Why no `setCurrentMood(null)` anymore? The spam guard at the top of `selectMood` has the `state.status !== 'error'` escape hatch. When retry runs, the state is `'error'`, so the guard's second condition fails and `selectMood` passes through on its own. The null trick was an earlier defensive measure that turned out to be unnecessary — the guard already handles it. Removing it made `retry` two lines shorter and easier to reason about.

```ts
  return { currentMood, state, selectMood, retry };
```

The hook returns four things — the entire public interface. No more, no less. `App.tsx` calls `useMoodFetch()`, destructures these four, and that's the whole data layer.

---

## `src/components/MoodButton.tsx` — One Button for One Mood

```ts
import type { Mood } from '../types';

type Props = {
  mood: Mood;
  selected: boolean;
  onSelect: (mood: Mood) => void;
};
```

**What this file's job is:** Render a single mood button that knows how to look selected or unselected, and calls a parent function when clicked.

The `Props` type describes what this component needs to work. Three things:
- `mood` — which mood word this button represents.
- `selected` — is this the currently chosen mood? The button looks different depending on this.
- `onSelect` — a function handed down from the parent. When clicked, the button calls `onSelect('calm')` or whatever its mood is.

```ts
export function MoodButton({ mood, selected, onSelect }: Props) {
  const base = 'px-5 py-2 rounded-md text-sm font-medium transition-colors';
```

The component starts by defining a `base` string — the Tailwind classes every button shares, regardless of selection state. `transition-colors` makes the colour change smooth when you select/unselect (or hover).

```ts
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
}
```

A conditional inside `className`. When `selected` is true, the button gets the filled treatment: `bg-primary` (ink-blue background) with `text-on-primary` (bone-white text). It looks solid, pressed down, current.

When `selected` is false, the button gets an outlined treatment: a thin border (`border border-outline`), transparent background, and a subtle hover (`hover:bg-surface-container` makes the button fill slightly when the mouse is over it).

`onClick={() => onSelect(mood)}` — the button's job when clicked is simple: call the provided function with the mood string. The arrow function is a wrapper because `onClick` expects a function with `(event)` signature; we want to ignore the event and pass the mood instead.

The button label between the tags (`{mood}`) is just the raw mood word — `calm`, `loud`, etc. No icon, no emoji, just text. The spec deliberately avoids icons; the words themselves are the design.

---

## `src/components/MoodRow.tsx` — The Row of Five Buttons

```ts
import type { Mood } from '../types';
import { MoodButton } from './MoodButton';

const MOODS: Mood[] = ['calm', 'loud', 'warm', 'lonely', 'bright'];
```

**What this file's job is:** Arrange all five mood buttons in a horizontal row, passing down the selected mood and click handler.

`MOODS` is an array of all five possible moods. It's defined outside the component (at module scope) so it doesn't get recreated on every render. Small optimization for a small array, but the right instinct.

```ts
type Props = {
  selected: Mood | null;
  onSelect: (mood: Mood) => void;
};
```

The row only needs two props:
- `selected` — which mood is currently active (or `null` if none).
- `onSelect` — the function to call when any button is pressed. The row just passes it through to each button.

```ts
export function MoodRow({ selected, onSelect }: Props) {
  return (
    <div role="group" aria-label="Mood selection" className="flex flex-wrap justify-center gap-2">
      {MOODS.map((mood) => (
        <MoodButton
          key={mood}
          mood={mood}
          selected={mood === selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
```

A single `<div>` with `flex flex-wrap justify-center gap-2`. Let's unpack those Tailwind classes:

- `flex` turns the div into a flexbox container.
- `flex-wrap` allows buttons to wrap to the next line if the screen is too narrow (good for very small phones).
- `justify-center` centers the row horizontally.
- `gap-2` puts 8px of space between every button.

The `role="group"` and `aria-label` tell screen readers that these five buttons form a single control group labelled 'Mood selection.' A screen reader user hears 'Mood selection, group' when they land on it, instead of having to discover the buttons one by one with no context.

Inside, the `.map()` visits every mood in the `MOODS` array and returns a `<MoodButton>`. `key={mood}` tells React "calm is calm, loud is loud" — React uses keys to track which button is which across re-renders. Since moods are unique strings, they make perfect keys.

`selected={mood === selected}` — the button is selected only if its mood matches the currently active mood. This single expression replaces a 5-line `if/else` chain.

---

## `src/components/ImageCard.tsx` — One Image with Credit

```ts
import type { ImageResult } from '../types';

type Props = {
  image: ImageResult;
};
```

**What this file's job is:** Display one image with its photographer credit at the bottom.

The component receives a single `image` prop of type `ImageResult`. No `onClick`, no `key`, no callbacks — this is a pure presentational component. It takes data and turns it into pixels.

```ts
export function ImageCard({ image }: Props) {
  return (
    <div className="bg-surface-container border border-outline-variant rounded-md overflow-hidden">
      <div className="aspect-[4/3]">
        <img
          src={image.url}
          alt={image.alt}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
      </div>
```

The outer `<div>` sets up the card's visual box: a background colour from our token system (`bg-surface-container`), a subtle border (`border border-outline-variant`), rounded corners (`rounded-md`), and `overflow-hidden` to clip the image to the card's rounded shape.

Inside, a container `<div>` with `aspect-[4/3]` that forces the image area to always be 4 units wide for every 3 units tall. This is one of Tailwind's arbitrary value features — the `[]` syntax lets you write any CSS value inline. Every card gets the same shape, regardless of what Unsplash sends. A wide landscape image will crop from the sides; a tall portrait will crop from the top and bottom. `object-cover` on the image handles this cropping — it fills the box and trims what doesn't fit.

`loading="lazy"` tells the browser: "don't load this image until it's close to being visible." Since all five cards are in a grid and visible from the start, this doesn't save much here, but it's a good habit for any image component.

`decoding="async"` tells the browser to decode (decompress) the image off the main thread. This prevents image decoding from janking the page layout during render. A small polish — the difference is imperceptible for five images, but it's the correct default for any `<img>` tag.

```ts
      <div className="p-2 text-xs text-on-surface-variant">
        Photo by{' '}
        <a
          href={image.authorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-on-surface"
        >
          {image.authorName}
        </a>
      </div>
    </div>
  );
}
```

The attribution bar. `text-xs` makes it small — this is supporting information, not the star of the card. `text-on-surface-variant` gives it a muted colour that doesn't compete with the image.

`{' '}` is how JSX writes a literal space. Without it, "Photo by" and the author link would run together with no gap.

The `<a>` tag links to the photographer's Unsplash profile. `target="_blank"` opens it in a new tab. `rel="noopener noreferrer"` is a security measure: it prevents the new tab from accessing the original window's JavaScript context and doesn't send a `Referer` header.

`underline hover:text-on-surface` — the link is underlined by default, and on hover the text colour shifts from the muted variant to the full `on-surface`, giving a subtle "I'm clickable" feedback.

---

## `src/components/ImageGrid.tsx` — Five Cards in a Centered Staggered Grid

```ts
import type { ImageResult } from '../types';
import { ImageCard } from './ImageCard';
import { STAGGER_OFFSETS_TOP, STAGGER_OFFSETS_BOTTOM } from '../lib/layout';
```

**What this file's job is:** Arrange five image cards in a 6-column grid where the top row fills the full width and the bottom two cards are centered with equal empty space on either side. Each card is nudged vertically using the stagger offsets.

The third import — `STAGGER_OFFSETS_TOP` and `STAGGER_OFFSETS_BOTTOM` — are those two arrays from `lib/layout.ts`. Both `ImageGrid` and `SkeletonGrid` import from the same source.

```ts
type Props = {
  images: ImageResult[];
};

export function ImageGrid({ images }: Props) {
  if (images.length < 5) {
    return (
      <p className="text-center text-on-surface-variant py-16">
        Not enough images found for this mood. Try another.
      </p>
    );
  }
```

Before rendering the grid, the component checks if enough images were returned. If Unsplash returns fewer than 5 results (edge case, but possible), the grid would have empty slots. Instead of showing a broken layout, the component shows a friendly message and exits early. No blank screen, no silent failure.

```ts
  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
```

The container is a 6-column CSS Grid that becomes a single column on mobile:
- `grid-cols-1` — on the smallest screens: one column. Cards stack vertically.
- `lg:grid-cols-6` — at the `lg` breakpoint (1024px+): six equal columns.

There is no `md` intermediate breakpoint. The grid jumps straight from single column to full 6-column at `lg`. The bottom-row centering trick only works in the 6-column structure, and an intermediate 2-column layout would need its own positioning logic — the complexity isn't worth it for a viewport range most users never sit in.

```ts
      <div
        className="lg:col-span-2 lg:mt-[var(--stagger)]"
        style={{ '--stagger': `${STAGGER_OFFSETS_TOP[0]}px` } as React.CSSProperties}
      >
        <ImageCard image={images[0]} />
      </div>
      <div
        className="lg:col-span-2 lg:mt-[var(--stagger)]"
        style={{ '--stagger': `${STAGGER_OFFSETS_TOP[1]}px` } as React.CSSProperties}
      >
        <ImageCard image={images[1]} />
      </div>
      <div
        className="lg:col-span-2 lg:mt-[var(--stagger)]"
        style={{ '--stagger': `${STAGGER_OFFSETS_TOP[2]}px` } as React.CSSProperties}
      >
        <ImageCard image={images[2]} />
      </div>
```

The top row — three cards, each spanning 2 of the 6 columns. Cards 1, 2, and 3 fill columns 1-2, 3-4, and 5-6 respectively. Each gets its stagger offset from `STAGGER_OFFSETS_TOP`: 0px, 24px, and 8px.

Unlike the earlier version, these cards are NOT rendered with `.map()`. Each card is explicitly written out with its own `<div>`. This is because the bottom row uses `col-start-2` placement on card 4, and a generic `.map()` can't customize individual card positions. Explicit rendering gives each card the flexibility it needs.

The stagger offset works via CSS custom properties, same as before: the offset number becomes a `--stagger` CSS variable, which Tailwind's `lg:mt-[var(--stagger)]` reads as `margin-top`. Only at `lg:` and above — below that, the offset is zero.

```ts
      <div
        className="lg:col-span-2 lg:col-start-2 lg:mt-[var(--stagger)]"
        style={{ '--stagger': `${STAGGER_OFFSETS_BOTTOM[0]}px` } as React.CSSProperties}
      >
        <ImageCard image={images[3]} />
      </div>
      <div
        className="lg:col-span-2 lg:mt-[var(--stagger)]"
        style={{ '--stagger': `${STAGGER_OFFSETS_BOTTOM[1]}px` } as React.CSSProperties}
      >
        <ImageCard image={images[4]} />
      </div>
    </div>
  );
}
```

The bottom row — two cards, centered. Card 4 uses `lg:col-start-2` to skip column 1 and start at column 2, spanning columns 2-3. Card 5 follows naturally into columns 4-5. Column 1 and column 6 are left empty — equal empty space on either side, true centering.

The offsets come from `STAGGER_OFFSETS_BOTTOM`: card 4 at 0px (baseline), card 5 at 24px (dropped). Restarting at 0 gives the bottom row its own rhythm instead of continuing the top row's pattern.

---

## `src/components/SkeletonGrid.tsx` — Ghost Cards While Loading

```ts
import { STAGGER_OFFSETS_TOP, STAGGER_OFFSETS_BOTTOM } from '../lib/layout';
```

**What this file's job is:** Show five pulsing ghost cards in the exact same positions as the real image grid — same 6-column structure, same centered bottom row, same stagger offsets — so the screen doesn't jump when the real images arrive.

```ts
export function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
```

Same container as `ImageGrid`. `grid-cols-1 lg:grid-cols-6`. If these two containers ever got different classes, the layout would jump when images loaded.

```ts
      {STAGGER_OFFSETS_TOP.map((offset, i) => (
        <div
          key={i}
          className="lg:col-span-2 lg:mt-[var(--stagger)]"
          style={{ '--stagger': `${offset}px` } as React.CSSProperties}
        >
```

The top three skeletons, mapped from `STAGGER_OFFSETS_TOP`. Each spans 2 columns and gets its stagger offset — same pattern as the image grid's top row. The `.map()` works here because all three top-row skeletons share identical layout rules (just different offsets). The image grid uses explicit cards instead of `.map()` because card 4 needs `col-start-2` — but the skeleton grid uses a conditional in its `.map()` instead.

```ts
          <div className="bg-surface-container border border-outline-variant rounded-md overflow-hidden">
            <div className="aspect-[4/3] bg-outline-variant animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
      ))}
```

Each skeleton is a rectangle with `aspect-[4/3]` matching the real card's shape. `bg-outline-variant` gives it the muted neutral from our token system. `animate-pulse` is Tailwind's built-in pulse: a smooth opacity oscillation that signals "something is coming."

The new addition: `motion-reduce:animate-none`. This disables the pulse animation when the user has `prefers-reduced-motion` enabled in their OS. Some users experience dizziness or nausea from persistent animations — the skeleton becomes a static loading bar for them. The visual feedback is still there (a coloured rectangle where an image will be), just without the motion.

```ts
      {STAGGER_OFFSETS_BOTTOM.map((offset, i) => (
        <div
          key={i + 3}
          className={[
            'lg:col-span-2 lg:mt-[var(--stagger)]',
            i === 0 ? 'lg:col-start-2' : '',
          ].join(' ')}
          style={{ '--stagger': `${offset}px` } as React.CSSProperties}
        >
```

The bottom two skeletons, mapped from `STAGGER_OFFSETS_BOTTOM`. The first one (`i === 0`) gets `lg:col-start-2` — the same centering trick as the image grid. The second follows naturally. `key={i + 3}` keeps the keys unique across both maps (0, 1, 2 from top, then 3, 4 from bottom — React needs unique keys across siblings).

```ts
          <div className="bg-surface-container border border-outline-variant rounded-md overflow-hidden">
            <div className="aspect-[4/3] bg-outline-variant animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

Same skeleton shape, same `motion-reduce:animate-none`. When the fetch succeeds and state switches from `loading` to `success`, React unmounts every skeleton and mounts every real image card in the same positions. The layout never shifts — the skeleton occupied the exact space the images will fill.

---

## `src/components/ErrorState.tsx` — When Things Go Wrong

```ts
type Props = {
  message: string;
  onRetry: () => void;
};
```

**What this file's job is:** Show the user that something went wrong, say what happened, and give them a button to try again.

Two props: the `message` from the caught error, and an `onRetry` function. No image data, no mood references — this component doesn't know what mood was being fetched. It only knows "here's what went wrong, here's how to try again."

```ts
export function ErrorState({ message, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
```

Centered vertically in a column. `py-16` gives generous top and bottom padding so the error sits in the same spatial position the grid would, preventing the page height from collapsing.

```ts
      <p className="text-on-background text-base">Couldn't load images.</p>
```

The primary message is calm and short. No exclamation marks. No red text. No "ERROR: Failed to fetch." The audience is a designer doing visual research — a screaming error breaks the mood and feels accusatory. "Couldn't load images." is factual, quiet, and respectful.

```ts
      <p className="text-on-surface-variant text-sm">{message}</p>
```

The technical detail — the actual error message from the catch block. This is smaller (`text-sm`) and muted (`text-on-surface-variant`) because it's secondary information. If Unsplash returned a 500, it'll say "Unsplash returned 500." If the API key is missing, it'll say "Missing VITE_UNSPLASH_ACCESS_KEY." The developer might read it; the designer probably won't need to.

```ts
      <button
        className="mt-2 px-5 py-2 rounded-md bg-tertiary text-on-tertiary text-sm font-medium hover:bg-tertiary/90 transition-colors"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}
```

The retry button. `bg-tertiary text-on-tertiary` gives it the vermillion colour from our token system — the "warm accent," which visually communicates "try again" better than the primary ink-blue or the neutral surfaces would.

`hover:bg-tertiary/90` slightly darkens the button on hover (the `/90` means 90% opacity over the surface behind it). `transition-colors` smooths this change. `onClick={onRetry}` calls the retry function from the hook, which deletes the cache entry and re-fetches.

The button does not say "Retry calmed" — it's generic. The error component doesn't know the mood. The hook's retry function knows what mood to retry because `currentMood` is stored there.

---

## `src/main.tsx` — React's Starting Gate

```ts
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
```

**What this file's job is:** The first code that runs. It finds the empty `<div id="root">` in `index.html`, fills it with our React app, and imports the global CSS so Tailwind's classes actually render.

`import './index.css'` — unlike the other imports, this one has no `from`. It's a **side-effect import**: we're not using anything from that file as a value. We're telling the bundler "include this CSS in the page." Without this line, Tailwind classes would be invisible.

```ts
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Three things happen in this line, read from the inside out:

1. `document.getElementById('root')!` finds the `<div id="root">` from `index.html`. The `!` (non-null assertion) tells TypeScript "I know this element exists, don't worry about it being null."

2. `createRoot(...)` creates a React root — the container that owns everything inside it. React 18 introduced `createRoot` to enable concurrent features. In older React, this was `ReactDOM.render()`. Same idea, newer API.

3. `.render(<StrictMode><App /></StrictMode>)` actually renders the app. `<StrictMode>` is a development-only wrapper that catches common mistakes: using legacy APIs, having impure renders, missing cleanup. It double-invokes certain functions during development to surface bugs early. In production builds, it does nothing — stripped out by the compiler.

That's it. Ten lines, no routing, no providers, no setup beyond finding the root element and rendering `<App />`. The entire app is a tree of components under that single root call.

---

## `src/App.tsx` — The Whole Page Stitched Together

```ts
import { useMoodFetch } from './hooks/useMoodFetch';
import { MoodRow } from './components/MoodRow';
import { ImageGrid } from './components/ImageGrid';
import { SkeletonGrid } from './components/SkeletonGrid';
import { ErrorState } from './components/ErrorState';
import logoDark from '/logo-dark.svg';
import logoLight from '/logo.svg';
```

**What this file's job is:** Combine the header, the mood buttons, and the four possible grid states into a single page. This is the orchestration layer — it doesn't do the fetching, caching, or rendering of individual cards. It just decides *which* component to show, based on the current state.

The SVG imports (`logoDark`, `logoLight`) are Vite-processed URLs. During build, Vite copies the SVG files into the output and replaces these imports with the final asset path. The type of each import is `string` — the URL.

```ts
function App() {
  const { currentMood, state, selectMood, retry } = useMoodFetch();
```

A single hook call. The app destructures four things from the hook's return value:
- `currentMood` — which mood, if any, is active (passed to `MoodRow`).
- `state` — the `FetchState` discriminated union (used in the render switch below).
- `selectMood` — the function called when a mood button is clicked.
- `retry` — the function called when the retry button is clicked.

That's the entire state surface area. No context providers, no reducers, no prop drilling beyond one level.

```ts
  return (
    <div className="min-h-screen bg-background text-on-background">
```

The outer wrapper. `min-h-screen` makes the page at least as tall as the viewport, so the background colour fills the screen even when the content is short. `bg-background text-on-background` sets the page's background and default text colour from our token system.

```ts
      <header className="px-6 py-6 max-w-5xl mx-auto flex items-start gap-3">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcSet={logoDark} />
          <img
            className="w-9 h-9 flex-shrink-0 mt-0.5"
            src={logoLight}
            alt="Mood Atlas logo"
          />
        </picture>
```

The header. Left-aligned with logo + title side by side.

The `<picture>` element is how we swap the logo for light vs dark mode *without JavaScript*. It works natively in the browser:
- If the user's OS is in dark mode (`prefers-color-scheme: dark`), the `<source>` tag matches and the browser uses `logoDark` (a light-on-dark SVG).
- Otherwise, the browser falls back to the `<img>` tag, which uses `logoLight` (a dark-on-light SVG).

The `<picture>` + `<source>` approach is deliberate — it uses the OS-level media query, not React or Tailwind's `dark:` class system. The app follows the OS; there's no theme toggle to build or maintain.

`w-9 h-9` makes the logo 36x36 pixels. `flex-shrink-0` prevents it from squishing if the title is very long (it won't be, but good practice). `mt-0.5` gives it a 2px nudge downward to optically align with the text baseline.

```ts
        <div>
          <h1 className="text-3xl font-medium text-on-background">Mood Atlas</h1>
          <p className="text-on-surface-variant text-sm mt-0.5">
            Pull five images by mood
          </p>
        </div>
      </header>
```

Title and subtitle in a `<div>` stacked vertically. The title is large (`text-3xl`), semi-bold (`font-medium`), full-contrast colour. The subtitle is small (`text-sm`), muted (`text-on-surface-variant`), and sits 2px below the title.

```ts
      <main className="px-6 py-8 max-w-5xl mx-auto">
        <MoodRow selected={currentMood} onSelect={selectMood} />

        <div className="mt-8" aria-live="polite" aria-atomic="true">
          {state.status === 'idle' && (
            <p className="text-center text-on-surface-variant py-16">
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
        </div>
      </main>
    </div>
  );
}

export default App;
```

The grid container now has `aria-live="polite"` and `aria-atomic="true"`. `aria-live="polite"` tells screen readers to announce changes to this region after the current task finishes — not interrupting whatever the user is doing. `aria-atomic="true"` tells them to read the entire region's content, not just the changed part.

The `loading` and `success` branches each have an invisible `<span>` with `className="sr-only"` — Tailwind's screen-reader-only class that hides content visually but keeps it accessible to assistive technology. When the skeleton appears, a screen reader announces "Loading images…" When images load, it announces "Five images loaded." Without these, a screen reader user would click a mood and hear nothing — they'd have to manually navigate the page to discover whether anything changed.

The `error` branch doesn't need an `sr-only` span — the `ErrorState` component's visible text ("Couldn't load images.") is already announced by the screen reader when the region updates.

---

## Where Beginners Usually Get Stuck

### 1. The `fetch` function (`src/lib/api.ts`)

`fetch` does NOT throw on 404 or 500. The promise resolves successfully. You MUST check `response.ok` yourself, or your code will try to parse an error page as JSON and crash somewhere downstream with an unhelpful error. This is the single most common footgun with native `fetch`.

Also: `response.json()` translates the raw network response into a JavaScript object. Without it, you're staring at a string. The `await` before it means "wait for the parsing to finish." Without `await`, you'd get a Promise, not the data.

### 2. The abort controller (`src/hooks/useMoodFetch.ts`)

The abort controller prevents two requests from racing each other. When the user clicks `calm` then `loud` quickly, the `calm` request gets aborted. But the aborted request's `.catch` handler still runs — which is why `if (controller.signal.aborted) return;` is in both the `.then` and `.catch`. Without those checks, the aborted calm request would set the error state and overwrite loud's successful result, or loud's error would overwrite calm's success.

The abort controller is a one-shot object. After calling `.abort()`, you can't reuse it — you must create a new one for the next fetch. That's why `abortRef.current = controller` is inside the `selectMood` function, not in a `useEffect`.

### 3. `useRef` vs `useState` (`src/hooks/useMoodFetch.ts`)

`useState` triggers a re-render when the value changes. Use it for things the user sees: the selected mood, the loading state, the images on screen.

`useRef` stores a value that survives between renders but does NOT trigger a re-render when it changes. Use it for things in the background: the image cache, the abort controller.

If we used `useState` for the cache, every time we stored a new mood's images, the app would re-render — and the screen wouldn't change because the visual state (which images are *shown*) didn't change. Unnecessary renders, zero benefit.

### 4. The discriminated union (`src/types.ts` → `src/App.tsx`)

`FetchState` has four shapes. TypeScript enforces that you can only access `images` when `status === 'success'`. This is more than a convention — it's compile-time safety. If a new team member adds a branch that reads `state.images` without the success check, TypeScript won't let them commit.

The four-branch switch in `App.tsx` is the visual result. No boolean soup. No `isLoading && !error && data` where you might accidentally render two things. One state, one branch. The type system and the render logic agree.
