# Offline PuzzlePirates

## Running the game

```
npm ci
npm run dev
```

Then open http://localhost:5178. `?seed=<integer>` opens a different ocean and `?scene=deck` opens
straight onto the ship. `npm run check` runs every gate and the test suite; `npm run smoke` runs the
Playwright render smoke, which needs `npx playwright install chromium` once.
