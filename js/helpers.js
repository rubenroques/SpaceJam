function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)", "i"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

// ---- Universe generation (plain JS, no Paper.js) ----
// Everything here is a pure function of the universe name and integer coordinates,
// so every browser computes the same universe. Do not use Math.random here.

var SECTOR_SIZE = 400;      // world units per sector side
var SPAWN_RANGE = 1000000;  // new pilots start within this many sectors of (0, 0)

// One random stream per feature and place. A new feature uses a new `kind`,
// so it never changes the numbers that older features get.
function streamFor(universe, kind, x, y) {
    return new Math.seedrandom(universe + ':' + kind + ':' + x + ':' + y);
}

function dist(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
}

// Fast integer hash of (seed, x, y) to 0..1. For values that need no stream.
function hash2(seed, x, y) {
    var h = Math.imul(2166136261 ^ seed, 16777619);
    h = Math.imul(h ^ x, 16777619);
    h = Math.imul(h ^ y, 16777619);
    h ^= h >>> 13; h = Math.imul(h, 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

function hashString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h | 0;
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function pick(rnd, list) { return list[Math.floor(rnd() * list.length)]; }

// ---- Names ----
var NAME_ONSET = ['', '', 'b', 'c', 'd', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'z',
                  'th', 'kr', 'dr', 'st', 'vr', 'sh', 'qu', 'x', 'br', 'tr'];
var NAME_VOWEL = ['a', 'e', 'i', 'o', 'u', 'a', 'e', 'o', 'ae', 'ia', 'io', 'y', 'ou', 'ei'];
var NAME_CODA = ['', '', '', 'n', 'r', 's', 'l', 'x', 'th', 'm', 'sk', 'nd'];

function makeName(rnd) {
    var n = 2 + Math.floor(rnd() * 2), s = '';
    for (var i = 0; i < n; i++) {
        s += pick(rnd, NAME_ONSET) + pick(rnd, NAME_VOWEL);
        if (i == n - 1) s += pick(rnd, NAME_CODA);
    }
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---- Regions ----
// A region is a Voronoi cell: each block of REGION_CELL x REGION_CELL sectors has one
// site point; a sector belongs to the nearest site. Each region has one colour tone,
// a density, a planet size and an energy richness.
var REGION_CELL = 12;
var regionCache = {};

function regionAt(universe, sx, sy) {
    var seed = hashString(universe);
    var px = sx + 0.5, py = sy + 0.5;
    var cx = Math.floor(px / REGION_CELL), cy = Math.floor(py / REGION_CELL);
    var bestD = Infinity, bx = 0, by = 0;
    for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
            var gx = cx + dx, gy = cy + dy;
            var siteX = (gx + 0.15 + 0.7 * hash2(seed, gx, gy)) * REGION_CELL;
            var siteY = (gy + 0.15 + 0.7 * hash2(seed ^ 0x5bd1e995, gx, gy)) * REGION_CELL;
            var d = (siteX - px) * (siteX - px) + (siteY - py) * (siteY - py);
            if (d < bestD) { bestD = d; bx = gx; by = gy; }
        }
    }
    return regionInfo(universe, bx, by);
}

function regionInfo(universe, gx, gy) {
    var key = universe + ':' + gx + ',' + gy;
    if (regionCache[key]) return regionCache[key];
    var r = streamFor(universe, 'region', gx, gy);
    var density = r() < 0.15 ? 0.1 : 0.35 + r() * 0.65;   // some regions are almost empty
    var region = {
        id: gx + ',' + gy,
        hue: r() * 360,
        spread: 6 + r() * 22,            // hue variation of the planets, in degrees
        saturation: 0.3 + r() * 0.5,
        brightness: 0.55 + r() * 0.4,
        density: density,
        size: 0.6 + r() * 0.9,
        richness: 0.5 + r() * 1.5
    };
    var kind = density < 0.2 ? 'Void' : density > 0.85 ? 'Cluster' : pick(r, ['Reach', 'Expanse', 'Drift', 'Belt', 'Deep']);
    region.name = makeName(streamFor(universe, 'name', gx, gy)) + ' ' + kind;
    region.light = r() * 360;            // direction of the light on the planets, in degrees
    if (Object.keys(regionCache).length > 500) regionCache = {};
    regionCache[key] = region;
    return region;
}

// Planets and energy of one sector, in sector-local units (0..SECTOR_SIZE). No drawing.
// Each planet stays fully inside its sector, so planets of different sectors never overlap.
var LOOK_SLOTS = 8;   // numbers reserved per planet in the 'look' stream (see below)

function sectorData(universe, sx, sy) {
    var region = regionAt(universe, sx, sy);
    var rnd = streamFor(universe, 'planets', sx, sy);
    var tries = Math.floor(rnd() * 13 * region.density);
    var planets = [];
    for (var i = 0; i < tries; i++) {
        // Always take 3 numbers per try, so a rejected try does not shift the next ones.
        var r = Math.min(70, (2 + rnd() * 36) * region.size);
        var x = r + rnd() * (SECTOR_SIZE - 2 * r);
        var y = r + rnd() * (SECTOR_SIZE - 2 * r);
        var free = planets.every(function (p) { return dist(p.x, p.y, x, y) > p.r + r + 8; });
        if (free) planets.push({ x: x, y: y, r: r });
    }

    // Look of each planet: always LOOK_SLOTS numbers per planet, so a new visual detail
    // can use a free slot without changing the colours of the other planets.
    var look = streamFor(universe, 'look', sx, sy);
    planets.forEach(function (p) {
        var v = [];
        for (var k = 0; k < LOOK_SLOTS; k++) v.push(look());
        p.hue = (region.hue + (v[0] * 2 - 1) * region.spread + 360) % 360;
        p.saturation = clamp01(region.saturation + (v[1] - 0.5) * 0.25);
        p.brightness = clamp01(region.brightness + (v[2] - 0.5) * 0.25);
        p.look = v;
    });

    var e = streamFor(universe, 'energy', sx, sy);
    var energy = [];
    var count = Math.min(4, Math.floor(e() * 3 * region.richness));
    for (var j = 0; j < count; j++) {
        var ex = 10 + e() * (SECTOR_SIZE - 20), ey = 10 + e() * (SECTOR_SIZE - 20);
        var clear = planets.every(function (p) { return dist(p.x, p.y, ex, ey) > p.r + 16; });
        if (clear) energy.push({ x: ex, y: ey, id: sx + ',' + sy + ':' + j });
    }
    return { region: region, planets: planets, energy: energy };
}

// The pilot's home sector: from ?at=sx,sy, or from the pilot id.
function homeSector(universe, pilot, at) {
    if (at) {
        var parts = at.split(',');
        return { x: Math.floor(+parts[0]) || 0, y: Math.floor(+parts[1]) || 0 };
    }
    var r = new Math.seedrandom(universe + ':spawn:' + pilot);
    return {
        x: Math.floor((r() * 2 - 1) * SPAWN_RANGE),
        y: Math.floor((r() * 2 - 1) * SPAWN_RANGE)
    };
}

// The world point where the pilot starts: the centre of the first sector, in a square
// spiral around `home`, that has no planet near its centre. Planets of other sectors are
// at least SECTOR_SIZE / 2 from that centre, so only this sector is checked. The universe is never changed
// for a pilot; only the start point moves.
function findSpawn(universe, home) {
    var c = SECTOR_SIZE / 2;
    for (var ring = 0; ring < 30; ring++) {
        for (var dx = -ring; dx <= ring; dx++) {
            for (var dy = -ring; dy <= ring; dy++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) != ring) continue;
                var sx = home.x + dx, sy = home.y + dy;
                var planets = sectorData(universe, sx, sy).planets;
                // 110 units free: room to turn before the first planet.
                if (planets.every(function (p) { return dist(p.x, p.y, c, c) > p.r + 110; })) {
                    return { x: sx * SECTOR_SIZE + c, y: sy * SECTOR_SIZE + c };
                }
            }
        }
    }
    return { x: home.x * SECTOR_SIZE + c, y: home.y * SECTOR_SIZE + c };
}

// ---- Ship ----
// The ship belongs to the pilot (same ship in every universe). Nose points to +x.
// The hull is mirrored on the x axis; x goes down from nose to tail, so it never crosses itself.
function shipDesign(pilot) {
    var r = new Math.seedrandom('ship:' + pilot);
    var len = 15 + r() * 6;
    var nose = len * 0.55, tail = -len * 0.45;
    var n = 2 + Math.floor(r() * 2);
    var upper = [];
    for (var i = 1; i <= n; i++) {
        var x = nose - (nose - tail) * (i / (n + 1)) + (r() - 0.5) * 2;
        upper.push([x, -(2.5 + r() * 5.5)]);
    }
    var tailHalf = 2 + r() * 4.5, notch = r() * 4;
    var points = [[nose, 0]].concat(upper, [[tail, -tailHalf], [tail + notch, 0], [tail, tailHalf]],
        upper.slice().reverse().map(function (p) { return [p[0], -p[1]]; }));
    return {
        points: points,
        tail: tail + notch,
        hue: r() * 360,
        flameHue: 15 + r() * 45,
        cockpitAt: nose * 0.35
    };
}

// ---- Browser storage (wrapped: it can be blocked) ----
function randomPilotId() { return Math.random().toString(36).slice(2, 10); }
function loadPilot() {
    try {
        var id = localStorage.getItem('spacejam.pilot');
        if (!id) { id = randomPilotId(); localStorage.setItem('spacejam.pilot', id); }
        return id;
    } catch (e) { return randomPilotId(); }
}
function loadBest() { try { return +localStorage.getItem('spacejam.best') || 0; } catch (e) { return 0; } }
function saveBest(v) { try { localStorage.setItem('spacejam.best', v); } catch (e) {} }

// ---- Starfield (DOM background) ----
// Three tiles painted from the universe seed. Each layer moves at its own speed (parallax).
// Tile sizes have no common factor, so the repeats do not line up.
var STAR_LAYERS = [
    { size: 512, count: 110, maxR: 0.8, speed: 0.04 },
    { size: 709, count: 50, maxR: 1.2, speed: 0.1 },
    { size: 997, count: 22, maxR: 1.8, speed: 0.2 }
];

function paintStars(universe) {
    var dpr = window.devicePixelRatio || 1;
    var images = STAR_LAYERS.map(function (layer, i) {
        var rnd = streamFor(universe, 'stars', i, 0);
        var c = document.createElement('canvas');
        c.width = c.height = Math.round(layer.size * dpr);
        var g = c.getContext('2d');
        g.scale(dpr, dpr);
        for (var k = 0; k < layer.count; k++) {
            var x = rnd() * layer.size, y = rnd() * layer.size;
            var r = 0.3 + rnd() * layer.maxR;
            var warm = rnd() < 0.25;
            var hue = warm ? 20 + rnd() * 40 : 200 + rnd() * 40;
            g.fillStyle = 'hsla(' + hue + ', 70%, ' + (80 + rnd() * 20) + '%, ' + (0.35 + rnd() * 0.65) + ')';
            // Draw the wrapped copies too, so a star on a tile edge has no seam.
            for (var ox = -1; ox <= 1; ox++) {
                for (var oy = -1; oy <= 1; oy++) {
                    g.beginPath();
                    g.arc(x + ox * layer.size, y + oy * layer.size, r, 0, Math.PI * 2);
                    g.fill();
                }
            }
        }
        return 'url(' + c.toDataURL() + ')';
    });
    document.body.style.backgroundImage = images.join(',');
    document.body.style.backgroundSize = STAR_LAYERS.map(function (l) { return l.size + 'px ' + l.size + 'px'; }).join(',');
}

function setStarOffset(x, y) {
    document.body.style.backgroundPosition = STAR_LAYERS.map(function (l) {
        return (-x * l.speed % l.size) + 'px ' + (-y * l.speed % l.size) + 'px';
    }).join(',');
}

// ---- HUD and effects (DOM only) ----
function setText(id, text) {
    var el = document.getElementById(id);
    if (el.textContent !== text) el.textContent = text;
}
// Region change: name in the HUD, a banner, and the background takes the region's tone.
function showRegion(region) {
    setText('region', region.name);
    document.body.style.backgroundColor = 'hsl(' + Math.round(region.hue) + ', 45%, 6%)';
    var b = document.getElementById('banner');
    b.textContent = 'Entering ' + region.name;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
function updateHud(score, best, fuel) {
    setText('score', String(score));
    setText('best', String(best));
    document.getElementById('fuel').style.width = Math.max(0, fuel) + '%';
}
function showGameOver(on) {
    document.getElementById('over').hidden = !on;
    var flash = document.getElementById('flash');
    if (!on) { flash.style.opacity = 0; return; }
    var c = document.getElementById('myCanvas');
    c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
    flash.style.transition = 'none'; flash.style.opacity = 0.5;
    setTimeout(function() { flash.style.transition = ''; flash.style.opacity = 0; }, 30);
}
