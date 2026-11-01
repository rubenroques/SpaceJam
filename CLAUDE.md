# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Project Space Jam": a browser toy that draws an infinite, seeded, procedurally generated 2D space map on a full-screen canvas with Paper.js. The player (red dot) moves through square sectors of randomly placed planets.

## Running

```sh
python3 serve.py                      # serves the repo root on http://localhost:8080/
open "http://localhost:8080/?seed=42&showGrid=false&zoomLevel=2"
```

- Serve over HTTP. Do not open `index.html` from `file://`: the browser fetches `js/script.js` (PaperScript loaded with `src`) by XHR, which fails on `file://` and leaves a black canvas.
- `serve.py` uses only the Python standard library. No venv is necessary.
- Paper.js 0.12.18 and seedrandom 3.0.5 load from unpkg, so the page needs network access.
- There is no build step, no package.json, no test suite, no linter, and no git repository. To check a change, reload the page and read the browser console.

URL parameters (parsed in `js/script.js` with `getParameterByName`):

| Parameter   | Values         | Default when absent                        |
|-------------|----------------|--------------------------------------------|
| `seed`      | any string     | current timestamp, so each load is a new map |
| `showGrid`  | `true`/`false` | `true` (draws the sector borders)          |
| `zoomLevel` | number         | `1.2` (the `initialZoom = 2.6` assignment is dead, it is always overwritten) |

Controls: arrows or WASD move, mouse click sets a destination, `c` stops, `+`/`-` zoom, space sets the destination to (0,0). The start position is random up to 5,000,000 units from the origin, so space starts a very long trip.

## Architecture

### Two script kinds

`index.html` loads `js/helpers.js` as plain JavaScript (it defines the global `getParameterByName`) and `js/script.js` as `type="text/paperscript"` bound to `#myCanvas`. PaperScript is not plain JS:

- Paper.js injects globals: `view`, `Point`, `Path`, `Rectangle`, `Color`.
- Arithmetic operators on Paper.js objects are vector math. `destination - view.center` and `direction * movementSpeed` return Points, not NaN.
- The top-level functions `onFrame`, `onMouseUp`, `onKeyDown` and `onKeyUp` become event handlers because of their names. Do not rename them.
- Key names come from Paper.js (`up`, `down`, `left`, `right`, `space`, letters).

Put code that does not need Paper.js in `helpers.js`.

### Determinism (easy to break)

The map must be the same for the same `seed`. Two RNGs control it:

1. The global `rng = new Math.seedrandom(seed)`. Its call order is fixed: one `random()` call for the unused global `planetsSize`, then two calls for the start position. If you remove or add a global `random()` call before the start position is set, every seed gets a different start position.
2. One RNG per sector: `seedrandom(convertCoordinateToSeed(worldX, worldY, seed))`. A sector that is unloaded and loaded again is the same, because its seed depends only on its coordinates and `seed`. If you change the number or order of `random()` calls in `PlanetarySystem` or `drawPlanets`, every existing seed gives a different map.

`convertCoordinateToSeed` uses `^`, which converts each operand to a 32-bit integer. A non-numeric `seed` (for example `?seed=abc`) becomes 0, so all non-numeric seeds give the same sector contents and only the start position changes. Numeric seeds work as expected.

### Sector streaming

The world is a grid of `SECTOR_SIZE` (400) squares, stored in `activeSectors` with `"x,y"` keys. Each sector holds one `PlanetarySystem` (border rectangle plus planets). `onFrame` calls `updateVisibleSectors` on every frame: it generates the missing sectors within `LOAD_DISTANCE` (2, so a 5x5 block) and removes the sectors farther than `UNLOAD_DISTANCE` (4, Chebyshev distance) from the player's sector.

Movement: the camera moves toward the `destination` point at 2 units per frame. Keys move `destination`, they do not move the view directly. `setViewCenter` moves the view and the player dot together.

### Known traps in `js/script.js`

- The `setViewCenter` call that sets the random start position runs before `player` is declared. This works only because of `var` hoisting and the `player != undefined` check. Do not reorder these lines without care.
- In `drawPlanets`, the inner `var intersections` in the `forEach` callback hides the outer counter. The outer counter stays 0, so every planet goes into `this.planets`, also planets that `planet.remove()` took off the canvas. Also, `getIntersections` finds only outline crossings, so a planet fully inside another one is kept.
- `PlanetarySystem = function(arguments)` uses `arguments` as a parameter name and hides the built-in `arguments` object.
- Unused code: `Galaxy` (it reads `arguments.randomGenerator`, which is always undefined), `checkIfNeedToDraw`, `getPlanetarySystem`, the global `planetsSize`, and `detailLevel` and `center` on `PlanetarySystem`.
