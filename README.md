# Mood Atlas

A single-page React app for visual research. Pick a mood from five options — calm, loud, warm, lonely, bright — and the page fills with five fresh images matching that mood, pulled live from the Unsplash API. Built with React, TypeScript, Vite, and Tailwind CSS.

## Setup

```bash
npm install
cp .env.example .env
```

Get a free Unsplash Access Key at [https://unsplash.com/developers](https://unsplash.com/developers), paste it into `.env` as `VITE_UNSPLASH_ACCESS_KEY`, then:

```bash
npm run dev
```

## API Usage

The app calls the Unsplash API once per first-time mood click. Subsequent clicks on the same mood return instantly from an in-memory cache. Rapidly clicking different moods cancels in-flight requests so stale data never paints.

## Attribution

Photographer attribution is displayed on every image card with a link to the photographer's Unsplash profile, including UTM parameters as required by Unsplash's API terms.
