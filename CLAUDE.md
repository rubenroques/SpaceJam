# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Project Space Jam": a browser game in one shared, procedural 2D universe, drawn with Paper.js. Planets, regions, names, stars and sounds are computed from the universe name and integer sector coordinates, so every browser sees the same universe without a server. Each player (pilot) starts at a different place and has a ship generated from the pilot id. There is no multiplayer: scores and collected energy are local.

## Running

```sh
python3 serve.py                      # serves the repo root on http://localhost:8080/
open "http://localhost:8080/?pilot=test&at=100,200"
```

- Serve over HTTP. From `file://` the browser cannot fetch `js/script.js` (PaperScript loaded with `src`) and the canvas stays black.
- `serve.py` uses only the Python standard library. No venv is necessary.
- CDN scripts: Paper.js 0.12.18 and seedrandom 3.0.5 (unpkg), ZzFXMicro 1.4.0 (jsdelivr). ZzFX is optional: without it the game runs with no sound.
- There is no build step, no package.json, no test suite and no linter. Check a change in the browser console. `window.spacejam.info()` returns the state; `window.spacejam.restart()` and `window.spacejam.shiftOrigin(sx, sy)` exist for tests.

| Parameter   | Effect |
|-------------|--------|
| `universe`  | Universe name, default `spacejam-1`. `seed` is an old alias. Another name is a different universe. |
| `pilot`     | Pilot id. Default: a random id stored in localStorage (`spacejam.pilot`). Sets the home sector and the ship. |
| `at`        | `sx,sy`: start in this sector (or the nearest one with a clear centre) instead of the pilot's home. |
| `zoomLevel` | Start zoom, default 1.2, minimum 0.6. |
| `showGrid`  | `true` draws the sector borders. |
| `still`     | `1` freezes moons and pulses, for pixel-exact tests. |

Controls: W or up thrust, A/D or left/right turn, R restart after a crash, `+`/`-` zoom, M sound, L copy a link to the current sector.

## Architecture

### Two files, two languages

- `js/helpers.js` is plain JavaScript, loaded as a normal script. It holds the universe generation (pure functions of numbers), the star tiles, the ship design, sound, localStorage and the DOM HUD. Put number-heavy code here: PaperScript turns every `+ - * /` into a function call. It runs in Node too: `Math.seedrandom = require('seedrandom'); vm.runInThisContext(fs.readFileSync('js/helpers.js', 'utf8'))`.
- `js/script.js` is PaperScript, loaded as `type="text/paperscript"`. It draws the data and runs the game.
  - **ES5 only.** paper-full.js parses PaperScript with acorn at `ecmaVersion: 5`. One `let`, `const`, arrow function or template literal gives a parse error and a black canvas.
  - Arithmetic on Paper.js objects is vector math (`pos - origin` is a Point).
  - Paper.js injects `view`, `project`, `Point`, `Path`, `Group`, `Layer`, `Color`. The top-level `onFrame`, `onKeyDown` and `onKeyUp` are event handlers because of their names.
  - PaperScript runs in its own PaperScope, so the global `paper.view` is null. From outside, use `window.spacejam`, or `Object.values(paper.PaperScope._scopes).find(s => s.view)`.

### Determinism: the rules that keep the universe shared

- Content is a function of `(UNIVERSE, sx, sy)` only. Get numbers from `streamFor(universe, kind, x, y)`, with one `kind` per feature: `planets`, `look`, `energy`, `region`, `name`, `stars`. A new feature gets a new `kind`, so it does not change the numbers of the old ones. Never use `Math.random` for content; it is allowed only for effects (sparks; ZzFX uses it internally).
- Keep the number of draws per item fixed. The `planets` stream takes 3 numbers per try, also for a rejected try. Each planet takes `LOOK_SLOTS` (8) numbers from `look`: 0-2 colour, 3 atmosphere, 4-5 ring, 6-7 moons. All 8 are in use, so a new planet detail needs a new stream kind. Changing `LOOK_SLOTS` changes every planet. In `regionInfo`, add new draws at the end only.
- Any change to these rules changes the universe for every player. Treat that as a new universe version and change the default name (`spacejam-1`).
- The ship design depends only on the pilot (`'ship:' + pilot`), not on the universe.

### World, sectors and the floating origin

- `SECTOR_SIZE` is 400 units. World coordinates are JS doubles; home sectors are within `SPAWN_RANGE` (1,000,000) sectors of (0, 0), so coordinates reach about 4e8.
- The canvas draws in 32-bit floats, and shapes break far from (0, 0) (visible at 5,000,000 units). So Paper.js items use coordinates relative to `origin`, a sector corner near the ship. `pos` is the ship in world coordinates, and `pos - origin` is the view centre. When the ship is more than `REBASE_DISTANCE` (20,000) from the origin, `setOrigin()` moves every sector group and spark by a whole number of sectors. **Anything new that lives in Paper.js coordinates must also be moved in `setOrigin()`.**
- Each sector is one `Group` with `applyMatrix: false`. Its children use sector-local coordinates (0..400), and the group is translated to `sx * SECTOR_SIZE - origin.x`. State: `sectors["sx,sy"] = { sx, sy, data, group, energy, moons }`.
- `updateSectors()` loads the sectors that the view can show (radius from `view.bounds`) and unloads the ones more than one sector further. It does work only when the ship's sector or the radius changes.
- Planets stay fully inside their sector and do not overlap. So collisions check only the 3x3 sectors around the ship, in sector-local numbers. Atmospheres, rings and moons are decoration and do not collide.

### Regions

`regionAt()` gives Voronoi cells over blocks of `REGION_CELL` (12) x 12 sectors. A region has one colour tone (hue, spread, saturation, brightness), a planet density and size, an energy richness, a light direction and a generated name. About 15% of regions are almost empty voids. The region also sets the energy colour (opposite hue), the page background tint and the note of its sounds (pentatonic step from the hue).

### Game loop

- `onFrame` uses `event.delta` (capped at 0.05 s), so speed does not depend on the frame rate. The ship turns and thrusts with inertia and drag. Thrust burns fuel, energy adds score and fuel. A crash, or no fuel with almost no speed, ends the run.
- The start point comes from `homeSector()` (pilot hash or `?at=`) and `findSpawn()`: a square spiral to the first sector whose centre is at least 110 units from every planet. The universe is never changed for a pilot; only the start point moves.
- `restart()` unloads everything and rebuilds at the same spawn. With `?still=1`, the first frame after a restart is pixel-identical to the first frame after load.

### Paper.js traps

- Items that get `rotation` or `scaling` set each frame need `applyMatrix: false`, or the transform adds up. The ship group also has `pivot: [0, 0]`, so `position` is the hull origin.
- A radial gradient's size is the distance from `origin` to `destination` (see `drawPlanet`).
- `view.zoom` below 0.6 loads many sectors. `MIN_ZOOM` keeps the item count low.
