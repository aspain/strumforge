# chord-muse

`chord-muse` is a compact GitHub Pages site for guitar players who want a musically coherent random chord loop, readable fretboard diagrams, and a practice clock in the same view.

## Features

- Theory-weighted 4-chord progressions in major and natural minor keys
- Guitar-first chord cards with SVG diagrams, finger numbers, open/muted strings, and alternate shape cycling
- Beginner-friendly chord-shape filters for open, barre, triad, and power chords, plus optional seventh and suspended/add9 flavor
- Global canonical vs. best-fit shape selection plus a left-handed mirror toggle
- Expanded metronome and drum groove styles for `4/4`, `3/4`, and `6/8`

## Local use

No build step is required. Open [public/index.html](/Users/aspain/Documents/git/chord-muse/public/index.html) directly in a browser or serve the `public/` directory.

## Testing

```bash
npm test
```

## Deployment

GitHub Actions publishes the `public/` directory to GitHub Pages on pushes to `main`.
