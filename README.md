# chord-muse

`chord-muse` is a compact GitHub Pages site for guitar players who want a musically coherent random chord loop, readable fretboard diagrams, and a practice clock in the same view.

## Features

- Theory-weighted 4-chord progressions in major and natural minor keys
- Guitar-first chord cards with SVG diagrams, finger numbers, open/muted strings, and alternate voicing cycling
- Ability filters for open, barre, seventh, power, and sus/add shapes
- Global canonical vs. best-fit shape selection plus a left-handed mirror toggle
- Metronome and drum grooves for `4/4`, `3/4`, and `6/8`

## Local use

No build step is required. Open [public/index.html](/Users/aspain/Documents/git/chord-muse/public/index.html) directly in a browser or serve the `public/` directory.

## Testing

```bash
npm test
```

## Deployment

GitHub Actions publishes the `public/` directory to GitHub Pages on pushes to `main`.
