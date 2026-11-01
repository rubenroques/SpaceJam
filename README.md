<p align="center">
<img src="https://dl.dropboxusercontent.com/s/2lclg39n4snac3f/Space_jam_logo.jpg">
</p>

Project Space Jam
-----

A browser game in one shared, procedural universe. Every planet, region, name, star and sound comes from the universe name and the sector coordinates, so every player flies in the same universe. Each pilot starts at a different place, with a ship made from the pilot id.

Fly between energy points before your fuel runs out, and do not touch a planet.

## Run

```sh
python3 serve.py
```

Then open <http://localhost:8080/>. The page must be served over HTTP.

## Controls

| Key | Action |
|-----|--------|
| W or up | Thrust |
| A/D or left/right | Turn |
| R | Restart after a crash |
| + / - | Zoom |
| M | Sound on or off |
| L | Copy a link to your current place in the universe |

URL parameters: `?universe=` (another universe), `?pilot=` (another pilot), `?at=sx,sy` (start in a sector), `?showGrid=true`.
