## Date
2026-11-01

### Project / Worktree / Branch
SpaceJam (rubenroques/SpaceJam) / main checkout / main (pushed to GitHub `master`)

### Goals for this session
- Write a CLAUDE.md for the old Paper.js toy (infinite seeded map, no game).
- Find the smallest way to make it look and behave like a real game.
- Make everything procedural, with one colour tone per group of sectors.
- One gigantic universe shared by all players, who start at different places.

### Achievements
- [x] Analysis with four subagents (game design, visuals, tech skeptic, builder) and a tested prototype: keep Paper.js, about 145 lines for the game loop.
- [x] `git init` on the downloaded folder; original files committed unchanged first.
- [x] Game loop: ship with inertia (frame-time based), fuel, energy pickups, crash, restart, HUD, best score.
- [x] One shared universe: fixed default universe `spacejam-1`, pilot id in localStorage, home sector from the pilot id, `?pilot=`, `?at=`, `?universe=`.
- [x] Generation split: pure data in `helpers.js` (`sectorData`, one seedrandom stream per feature), drawing in `script.js`.
- [x] Floating origin: Paper.js items drawn relative to a sector corner near the ship; rebase every 20,000 units.
- [x] Regions (Voronoi over 12x12 sectors): colour tone, density, size, light direction, generated name, background tint, "Entering" banner.
- [x] Planet looks: radial shading, atmospheres, rings in two halves, orbiting moons. Energy in the opposite hue.
- [x] Starfield tiles painted from the seed; ship generated from the pilot id with flame, trail and crash burst.
- [x] Sound with ZzFX 1.4.0: region note (pentatonic step from hue), pickup chime, crash; M mutes.
- [x] L copies a link to the current sector of the same universe.
- [x] Independent review: 7 low findings, all fixed and tested.
- [x] `tests/`: universe snapshot in Node plus headless Chromium checks, `npm test` (12 checks pass).

### Issues / Bugs Hit
- [x] Canvas draws in 32-bit floats: shapes broke at 5,000,000 units and became blobs at 100,000,000. Fixed with the floating origin.
- [x] Old seed bug: `convertCoordinateToSeed` used `^`, so every text seed gave the same planets. Fixed with string-keyed seedrandom streams.
- [x] Old overlap bug (shadowed `intersections`): removed planets stayed in the collision list. Fixed with a distance check.
- [x] Prototype `clearSpawn()` removed planets for one pilot, which breaks a shared universe. Replaced with `findSpawn()` (move the pilot, never the universe).
- [x] Review findings: bad `?zoomLevel=`/`?at=` input, no sector loading while dead, Cmd+M/Cmd+L reached game keys, double `endRun()`, tunnelling at top speed, one-sided trail.
- [ ] Origin shift changes about 34 edge pixels (float rounding in anti-aliasing). Accepted; the test allows < 0.01%.

### Key Decisions
- Keep Paper.js 0.12.18 (perf measured: 60 fps, about 1,300 items at minimum zoom). Paper.js 0.13-0.16 (Oct 2026) add nothing for games.
- Dropped the daily seed from the first plan: it would make a new universe every day.
- Ship design depends only on the pilot, not on the universe.
- Energy keeps one look (glowing pulsing dot) for readability; only its hue follows the region.
- `restart()` keeps the player's zoom on purpose.
- No multiplayer yet: the universe needs no server; live positions, shared state and a leaderboard would.

### Experiments & Notes
- PaperScript is parsed by acorn with `ecmaVersion: 5` (paper-full.js line ~15720): ES5 only in `script.js`.
- PaperScript runs in its own PaperScope: `paper.view` is null from outside; use `window.spacejam` or `paper.PaperScope._scopes`.
- `new Point({angle, length})` with a negative length gives a positive length.
- ZzFXMicro declares `zzfx`/`zzfxX` with top-level `let`; plain scripts and PaperScript can still see them.
- Headless Chromium from Playwright caps at about 60 fps; a dropped frame shows as a worst frame of 33 ms or more.

### Lessons Learned
- In a seeded world, fix the number of random draws per item (and reserve slots), or every small feature changes the whole map.
- A shared procedural world must never be edited for one player; move the player instead.
- Test the far-coordinate case early; float32 canvas precision breaks long before JS doubles do.

### Useful Files / Links
- [CLAUDE.md](../../CLAUDE.md) (determinism rules, floating origin, tests)
- [Universe generation](../../js/helpers.js)
- [Game and drawing (PaperScript, ES5)](../../js/script.js)
- [Checks](../../tests/run.js)
- [GitHub repo](https://github.com/rubenroques/SpaceJam)

### Next Steps
1. Play-test and tune thrust, drag, fuel drain, spawn clearance and default zoom.
2. Listen to the sounds and tune the ZzFX parameters.
3. Test in Firefox and Safari.
4. If multiplayer is wanted: shared discoveries keyed by sector first, then live positions filtered by nearby sectors.

### Suggested Commit Messages
**Short:**
Add a game loop with fuel, energy, crash and restart
Make one shared procedural universe with pilot spawns and a floating origin
Add regions with colour tones, planet looks, starfield, ship and sound
Add universe snapshot and headless browser tests

**Single-line:**
feat: turn Space Jam into a game in one shared procedural universe
