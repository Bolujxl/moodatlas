# Lie Detector — Four Truths and One Lie

## The Rules
Four of the five claims below are true. One is a lie about the code's logic or machinery.
Find the lie by reading the source. (Scope: machinery only — no cosmetic claims.)

## The Claims

**Claim 1.** Each mood in `moodQueries.ts` maps to three space-separated search terms rather than a single word — clicking `calm` sends the query `serene minimal misty` to Unsplash, not just `calm`. The mapping object is typed as `Record<Mood, string>`, so TypeScript enforces that every mood in the union has a corresponding query. Forgetting a mood's query is a compile error, not a runtime surprise.

**Claim 2.** The `cacheRef` in `useMoodFetch.ts` is declared with `useRef` rather than `useState`. Because `useRef` updates do not trigger re-renders, storing a newly fetched mood's images in `cacheRef.current[mood]` has no visual side effect — the component only re-renders when `setState` is called separately. If `useState` had been used for the cache, every cache write would cause the owning component to re-render unnecessarily.

**Claim 3.** When the user clicks `calm` and then quickly clicks `loud`, the `calm` fetch is aborted via `abortRef.current?.abort()`. The aborted fetch's promise rejects with an `AbortError`, which enters the `.catch` handler in `useMoodFetch`. That handler then sets the state to `{ status: 'error', message: <the abort error> }`, which briefly flashes the error screen before `loud`'s successful fetch overwrites it with the correct images.

**Claim 4.** The function `fetchMoodImages` in `api.ts` receives `signal: AbortSignal` as a parameter rather than creating its own `AbortController` internally. The controller is created inside `useMoodFetch` and its signal is passed in at call time. This design means the hook — not the API function — owns the cancellation policy, and a future caller could pass any signal it wants without modifying `api.ts`.

**Claim 5.** The `FetchState` type in `types.ts` is a discriminated union with exactly four branches, discriminated by the `status` field. In `App.tsx`, the render block checks `state.status === 'success'` before rendering the image grid, which narrows the type so `state.images` is available inside that branch only. TypeScript would refuse to compile if someone tried to access `state.images` inside the `error` branch without a prior success check.

## My Guess (engineer fills this in)
- Lie is claim #: Claim 3
- My reasoning: The catch handler in useMoodFetch does not set the state to { status: 'error', message: <the abort error> }.
- The line that proves it: 

```ts
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: err.message });
      });
```

## Cross-Check

### You guessed: Claim 3 is the lie. **Correct.**

### The lie: Claim 3

Claim 3 stated that when a fetch is aborted, the `.catch` handler sets the error state — briefly flashing the error screen before the next mood's fetch overwrites it. **This never happens.** Here's why:

```ts
// src/hooks/useMoodFetch.ts — lines 36-39
.catch((err) => {
  if (controller.signal.aborted) return;   // ← this line
  setState({ status: 'error', message: err.message });
});
```

Line 37 checks `controller.signal.aborted` **before** calling `setState`. When the `calm` fetch is aborted (because the user clicked `loud`), the aborted controller's signal reads as `aborted: true`. The `.catch` handler hits the `return` and silently exits — no error state is ever set. The error screen never flashes. The aborted fetch's rejection is swallowed on purpose, because it's not a real error; it's the app telling itself to stop.

### The truth: Claims 1, 2, 4, and 5 are all correct.

**Claim 1** — `moodQueries.ts:3-8`: each mood maps to three space-separated terms (`serene minimal misty`, `vibrant neon crowd`, etc.), and the `Record<Mood, string>` type enforces that all five moods have entries.

**Claim 2** — `useMoodFetch.ts:10`: `const cacheRef = useRef<Cache>({});` — `useRef` stores the cache without triggering re-renders on writes. `useState` would cause a re-render on every cache write, even though the screen doesn't change.

**Claim 4** — `api.ts:9`: `signal: AbortSignal` is a parameter. The controller is created at `useMoodFetch.ts:25-26` and passed in at line 30. The API function doesn't own its cancellation — the caller does.

**Claim 5** — `types.ts:13-17`: four branches discriminated by `status`. `App.tsx:40-41` checks `state.status === 'success'` before accessing `state.images`. TypeScript refuses compilation if `state.images` is accessed in the `error` branch without narrowing first.
