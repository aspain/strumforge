# chord-muse

`chord-muse` is a static guitar practice tool that now supports two delivery targets from the same repo:

- the existing public website at [adamspain.com/chord-muse](https://adamspain.com/chord-muse)
- a new iOS app built as a Capacitor wrapper around the same web app

The web UI and music logic still live in [`public/`](/Users/aspain/Documents/git/chord-muse/public). The iOS wrapper lives in [`ios/`](/Users/aspain/Documents/git/chord-muse/ios) and consumes a staged copy of the site from `dist/capacitor`.

![Chord Muse preview](public/chord-muse-preview.png)

## What changed for iOS v1

- Capacitor project config at the repo root
- Native iOS project in [`ios/`](/Users/aspain/Documents/git/chord-muse/ios)
- Offline-safe native asset staging via `npm run native:prepare`
- Local font stacks instead of Google Fonts so the installed app works fully offline
- Safe-area and smaller-iPhone layout tuning
- Audio priming and background/foreground transport recovery for iPhone reliability
- Tap-based reorder fallback on touch devices, while desktop drag reorder still works on the web

## Repo commands

- `npm test`
  Runs the existing node test suite.
- `npm run native:prepare`
  Copies [`public/`](/Users/aspain/Documents/git/chord-muse/public) to `dist/capacitor` for Capacitor.
- `npm run native:copy`
  Rebuilds the staged native web bundle and copies it into the iOS project.
- `npm run native:sync`
  Rebuilds the staged native web bundle, copies it, and updates iOS plugins and pods.
- `npm run native:open:ios`
  Runs the full native sync flow and opens the Xcode project.

## Local web testing

For normal browser testing:

```bash
npm test
cd public
python3 -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173).

Check these before touching iOS:

- generate progressions repeatedly
- toggle every shape and flavor filter
- preview individual chords
- run transport with drums-only, chords-only, and both enabled
- reorder chords and confirm playback order matches the cards

## Native development loop

When you change web files:

```bash
npm run native:copy
```

Then rebuild from Xcode.

You only need `npm run native:sync` again when:

- you add or remove Capacitor plugins
- you change `capacitor.config.ts`
- native project settings need to be refreshed

## License

Copyright (c) 2026 Adam Spain. All rights reserved.

No license is granted for use, copying, modification, or distribution of this code without prior written permission.
