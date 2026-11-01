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

// Planets and energy of one sector, in sector-local units (0..SECTOR_SIZE). No drawing.
// Each planet stays fully inside its sector, so planets of different sectors never overlap.
function sectorData(universe, sx, sy) {
    var rnd = streamFor(universe, 'planets', sx, sy);
    var tries = Math.floor(rnd() * 13);
    var hue = rnd() * 360;
    var planets = [];
    for (var i = 0; i < tries; i++) {
        // Always take 3 numbers per try, so a rejected try does not shift the next ones.
        var r = 2 + rnd() * 36;
        var x = r + rnd() * (SECTOR_SIZE - 2 * r);
        var y = r + rnd() * (SECTOR_SIZE - 2 * r);
        var free = planets.every(function (p) { return dist(p.x, p.y, x, y) > p.r + r + 8; });
        if (free) planets.push({ x: x, y: y, r: r, hue: hue });
    }

    var e = streamFor(universe, 'energy', sx, sy);
    var energy = [];
    var count = Math.floor(e() * 3);
    for (var j = 0; j < count; j++) {
        var ex = 10 + e() * (SECTOR_SIZE - 20), ey = 10 + e() * (SECTOR_SIZE - 20);
        var clear = planets.every(function (p) { return dist(p.x, p.y, ex, ey) > p.r + 16; });
        if (clear) energy.push({ x: ex, y: ey, id: sx + ',' + sy + ':' + j });
    }
    return { planets: planets, energy: energy };
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

// ---- HUD and effects (DOM only) ----
function setStarOffset(x, y) {
    var far = (-x * 0.05 % 240) + 'px ' + (-y * 0.05 % 240) + 'px';
    var near = (-x * 0.15 % 330) + 'px ' + (-y * 0.15 % 330) + 'px';
    document.body.style.backgroundPosition = [far, far, far, near, near].join(',');
}
function setText(id, text) {
    var el = document.getElementById(id);
    if (el.textContent !== text) el.textContent = text;
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
