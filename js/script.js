// Project Space Jam: one shared, procedural universe.
// PaperScript: ES5 only (paper-full.js parses it with acorn, ecmaVersion 5).
// The universe data comes from helpers.js (plain functions of numbers); this file draws it
// and runs the game.

//==============================================
//=========          Settings          =========
//==============================================
// The universe is the same for every player. ?universe= (or the old ?seed=) makes a separate one.
var UNIVERSE = getParameterByName('universe') || getParameterByName('seed') || 'spacejam-1';
var showGrid = getParameterByName('showGrid') == 'true';
var STILL = getParameterByName('still') == '1';   // tests: freeze moons and pulses
var MIN_ZOOM = 0.6;
var zoomParam = getParameterByName('zoomLevel');
view.zoom = zoomParam ? Math.max(MIN_ZOOM, +zoomParam) : 1.2;

var SHIP_RADIUS = 6;
var ENERGY_RADIUS = 14;   // pickup distance
var REBASE_DISTANCE = 20000;  // move the origin when the ship is this far from it

// The pilot decides where you start. ?pilot= and ?at=sx,sy override it.
var pilot = getParameterByName('pilot') || loadPilot();
var spawn = findSpawn(UNIVERSE, homeSector(UNIVERSE, pilot, getParameterByName('at')));
paintStars(UNIVERSE);

//==============================================
//=========         Game state         =========
//==============================================
// World coordinates are JS doubles and can be very large. Paper.js items use coordinates
// relative to `origin` (a sector corner near the ship), because the canvas draws in 32-bit
// floats and shapes break far from (0, 0).
var origin = sectorCorner(spawn.x, spawn.y);
var pos = new Point(spawn.x, spawn.y);   // ship, world coordinates
var velocity = new Point(0, 0);
var heading = -90;
var fuel = 100, score = 0, best = loadBest(), dead = false;
var collected = {};      // energy ids taken in this run
var sectors = {};        // "sx,sy" -> { sx, sy, data, group, energy }
var loadedKey = null, loadRadius = 0;
var regionId = null;     // region of the ship's sector, for the "Entering" banner
var keysPressed = {};

var worldLayer = project.activeLayer;
var fxLayer = new Layer();     // sparks, between the world and the ship
var shipLayer = new Layer();

// The ship: generated from the pilot id (helpers.js shipDesign).
// applyMatrix: false, so `rotation` is an absolute angle and does not accumulate.
// pivot [0, 0], so `position` is the hull origin and not the centre of the rotated bounds.
var design = shipDesign(pilot);
var flameColor = hsb(design.flameHue, 0.85, 1);
var flame = new Path({
    segments: [[design.tail + 1, -2.6], [design.tail - 8, 0], [design.tail + 1, 2.6]],
    closed: true, fillColor: flameColor, applyMatrix: false, pivot: [design.tail, 0], visible: false
});
var player = new Group({
    children: [
        flame,
        new Path({ segments: design.points, closed: true, fillColor: hsb(design.hue, 0.45, 0.95), strokeColor: 'white', strokeWidth: 0.8 }),
        new Path.Ellipse({ center: [design.cockpitAt, 0], size: [5, 3], fillColor: hsb(design.hue, 0.6, 0.35) })
    ],
    applyMatrix: false,
    pivot: [0, 0]
});
shipLayer.addChild(player);

// Spark pool for the engine trail and the crash burst. Positions are local (origin-relative).
var sparks = [], nextSpark = 0;
for (var i = 0; i < 64; i++) {
    var dot = new Path.Circle({ center: [0, 0], radius: 1.6, fillColor: flameColor, applyMatrix: false, visible: false });
    fxLayer.addChild(dot);
    sparks.push({ item: dot, life: 0, vel: new Point(0, 0) });
}
worldLayer.activate();

updateSectors();
placeShip();

//==============================================
//=========          Frame loop        =========
//==============================================
function onFrame(event) {
    var dt = Math.min(event.delta, 0.05);
    if (!dead) {
        if (keysPressed['left'] || keysPressed['a']) heading -= 220 * dt;
        if (keysPressed['right'] || keysPressed['d']) heading += 220 * dt;
        var thrusting = (keysPressed['up'] || keysPressed['w']) && fuel > 0;
        if (thrusting) {
            velocity = velocity + new Point({ angle: heading, length: 260 * dt });
            fuel -= 12 * dt;
        }
        velocity = velocity * Math.max(0, 1 - 0.35 * dt);
        if (velocity.length > 320) velocity = velocity.normalize(320);
        flame.visible = thrusting;
        if (thrusting) {
            flame.scaling = new Point(0.7 + 0.3 * Math.abs(Math.sin(event.time * 37)), 1);
            var back = new Point({ angle: heading + 180, length: 1 });
            var spread = new Point({ angle: heading + 90, length: (Math.random() - 0.5) * 30 });
            emitSpark(pos - origin + back * -design.tail, velocity * 0.4 + back * 70 + spread);
        }
        pos = pos + velocity * dt;
        var local = pos - origin;
        if (Math.abs(local.x) > REBASE_DISTANCE || Math.abs(local.y) > REBASE_DISTANCE) {
            setOrigin(sectorCorner(pos.x, pos.y));
        }
        updateSectors();
        checkCollisions();
        if (fuel <= 0 && velocity.length < 8) endRun();
    }
    placeShip();
    updateSparks(dt);
    animate(STILL ? 0 : event.time);
    setStarOffset(pos.x, pos.y);
    updateHud(score, best, Math.round(fuel));
    var s = sectorOf(pos.x, pos.y);
    setText('where', 'SECTOR ' + s.x + ', ' + s.y);
}

function placeShip() {
    var local = pos - origin;
    view.center = local;
    player.position = local;
    player.rotation = heading;
}

// Floating origin. The new origin must be a sector corner, so every shift is a whole
// number of sectors and the drawing does not move.
function setOrigin(newOrigin) {
    var back = origin - newOrigin;
    if (back.isZero()) return;
    origin = newOrigin;
    Object.keys(sectors).forEach(function(k) { sectors[k].group.translate(back); });
    sparks.forEach(function(s) { s.item.position = s.item.position + back; });
    placeShip();
}

//==============================================
//=========           Sparks           =========
//==============================================
// Sparks are effects only, so they may use Math.random.
function emitSpark(at, vel) {
    var s = sparks[nextSpark];
    nextSpark = (nextSpark + 1) % sparks.length;
    s.item.position = at;
    s.vel = vel;
    s.life = 1;
    s.item.visible = true;
}

function updateSparks(dt) {
    sparks.forEach(function(s) {
        if (s.life <= 0) return;
        s.life -= dt * 1.8;
        if (s.life <= 0) { s.item.visible = false; return; }
        s.item.position = s.item.position + s.vel * dt;
        s.item.opacity = s.life;
        s.item.scaling = 0.4 + 0.6 * s.life;
    });
}

function clearSparks() {
    sparks.forEach(function(s) { s.life = 0; s.item.visible = false; });
}

//==============================================
//=========     Sectors (streaming)    =========
//==============================================
function sectorOf(wx, wy) {
    return { x: Math.floor(wx / SECTOR_SIZE), y: Math.floor(wy / SECTOR_SIZE) };
}

function sectorCorner(wx, wy) {
    var s = sectorOf(wx, wy);
    return new Point(s.x * SECTOR_SIZE, s.y * SECTOR_SIZE);
}

// Load the sectors that the view can show; unload the ones more than one sector further.
function updateSectors() {
    var s = sectorOf(pos.x, pos.y);
    var key = s.x + ',' + s.y;
    var half = Math.max(view.bounds.width, view.bounds.height) / 2;
    var r = Math.ceil(half / SECTOR_SIZE);
    if (key == loadedKey && r == loadRadius) return;
    loadedKey = key;
    loadRadius = r;
    for (var dx = -r; dx <= r; dx++) {
        for (var dy = -r; dy <= r; dy++) {
            loadSector(s.x + dx, s.y + dy);
        }
    }
    Object.keys(sectors).forEach(function(k) {
        var sec = sectors[k];
        if (Math.max(Math.abs(sec.sx - s.x), Math.abs(sec.sy - s.y)) > r + 1) {
            sec.group.remove();
            delete sectors[k];
        }
    });
    var here = sectors[key].data.region;
    if (here.id != regionId) {
        regionId = here.id;
        showRegion(here);
    }
}

function loadSector(sx, sy) {
    var key = sx + ',' + sy;
    if (sectors[key]) return;
    var data = sectorData(UNIVERSE, sx, sy);
    // Children use sector-local coordinates; the group matrix moves them into place.
    var group = new Group({ applyMatrix: false });
    if (showGrid) {
        group.addChild(new Path.Rectangle({
            point: [0, 0], size: [SECTOR_SIZE, SECTOR_SIZE], strokeColor: '#3f3f3f', strokeWidth: 3
        }));
    }
    var light = new Point({ angle: data.region.light, length: 1 });
    var moons = [];
    data.planets.forEach(function(p) { drawPlanet(group, p, light, moons); });
    // Energy glows in the opposite hue of the region, so it stands out from the planets.
    var energyHue = (data.region.hue + 180) % 360;
    var energy = [];
    data.energy.forEach(function(e) {
        if (collected[e.id]) return;
        var item = new Path.Circle({
            center: [e.x, e.y], radius: 4,
            fillColor: hsb(energyHue, 0.25, 1), shadowColor: hsb(energyHue, 0.9, 1), shadowBlur: 16
        });
        group.addChild(item);
        energy.push({ e: e, item: item });
    });
    group.translate(new Point(sx * SECTOR_SIZE - origin.x, sy * SECTOR_SIZE - origin.y));
    sectors[key] = { sx: sx, sy: sy, data: data, group: group, energy: energy, moons: moons };
}

//==============================================
//=========        Planet looks        =========
//==============================================
// p.look holds LOOK_SLOTS numbers (see sectorData): 0-2 colour, 3 atmosphere, 4-5 ring,
// 6-7 moons. Atmospheres, rings and moons are decoration: only the body collides.
function hsb(h, s, b, a) {
    return new Color({ hue: h, saturation: Math.max(0, Math.min(1, s)), brightness: Math.max(0, Math.min(1, b)), alpha: a == null ? 1 : a });
}

function drawPlanet(group, p, light, moons) {
    var v = p.look;
    var center = new Point(p.x, p.y);
    var base = hsb(p.hue, p.saturation, p.brightness);
    var lightSide = hsb(p.hue, p.saturation * 0.6, p.brightness + 0.3);
    var darkSide = hsb(p.hue, p.saturation + 0.1, p.brightness * 0.2);

    if (v[3] < 0.4) {
        var halo = p.r * 1.4;
        group.addChild(new Path.Circle({
            center: center, radius: halo,
            fillColor: {
                gradient: { stops: [[hsb(p.hue, p.saturation, 1, 0.35), 0.68], [hsb(p.hue, p.saturation, 1, 0), 1]], radial: true },
                origin: center, destination: center + new Point(halo, 0)
            }
        }));
    }

    var ring = p.r > 14 && v[4] < 0.3 ? ringHalves(center, p.r, v[5] * 140 - 70, lightSide) : null;
    if (ring) group.addChild(ring[0]);

    // Radial shading: bright where the region's light falls, dark on the far side.
    var lit = center + light * (p.r * 0.45);
    group.addChild(new Path.Circle({
        center: center, radius: p.r,
        fillColor: {
            gradient: { stops: [[lightSide, 0], [base, 0.45], [darkSide, 1]], radial: true },
            origin: lit, destination: lit - light * (p.r * 1.45)
        }
    }));
    if (ring) group.addChild(ring[1]);

    if (p.r > 8) {
        var count = Math.floor(v[6] * 3);
        for (var m = 0; m < count; m++) {
            var moon = new Path.Circle({ center: center, radius: Math.max(1.5, p.r * 0.13), fillColor: hsb(p.hue, 0.12, 0.8) });
            group.addChild(moon);
            moons.push({
                item: moon, cx: p.x, cy: p.y,
                orbit: p.r * (1.7 + m * 0.55 + v[7] * 0.3),
                speed: (0.25 + v[7] * 0.5) * (m % 2 ? -1 : 1) / (1 + m),
                phase: v[7] * 6.283 + m * 2.1
            });
        }
    }
}

// A ring as two half-ellipses: the back half is drawn before the planet, the front half after.
function ringHalves(center, r, tilt, color) {
    var a = r * 1.9;
    var halves = [
        new Path.Arc({ from: [-a, 0], through: [0, -a], to: [a, 0] }),
        new Path.Arc({ from: [a, 0], through: [0, a], to: [-a, 0] })
    ];
    halves.forEach(function(arc) {
        arc.scale(1, 0.32, new Point(0, 0));
        arc.rotate(tilt, new Point(0, 0));
        arc.translate(center);
        arc.strokeColor = color;
        arc.strokeWidth = Math.max(1, r * 0.1);
        arc.opacity = 0.75;
    });
    return halves;
}

// Moons orbit; energy pulses. `t` is in seconds.
function animate(t) {
    Object.keys(sectors).forEach(function(k) {
        var sec = sectors[k];
        sec.moons.forEach(function(m) {
            var a = m.phase + m.speed * t;
            m.item.position = new Point(m.cx + Math.cos(a) * m.orbit, m.cy + Math.sin(a) * m.orbit);
        });
        sec.energy.forEach(function(en) {
            en.item.opacity = 0.65 + 0.35 * Math.sin(t * 4 + en.e.x);
        });
    });
}

function unloadAllSectors() {
    Object.keys(sectors).forEach(function(k) { sectors[k].group.remove(); });
    sectors = {};
    loadedKey = null;
}

//==============================================
//=========     Collisions and rules   =========
//==============================================
// Only the 3x3 sectors around the ship: a planet stays inside its own sector.
function checkCollisions() {
    var s = sectorOf(pos.x, pos.y);
    for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
            var sec = sectors[(s.x + dx) + ',' + (s.y + dy)];
            if (!sec) continue;
            // Ship in this sector's local units: small numbers, exact enough.
            var lx = pos.x - sec.sx * SECTOR_SIZE, ly = pos.y - sec.sy * SECTOR_SIZE;
            var planets = sec.data.planets;
            for (var i = 0; i < planets.length; i++) {
                if (dist(lx, ly, planets[i].x, planets[i].y) < planets[i].r + SHIP_RADIUS) { endRun(); return; }
            }
            sec.energy.forEach(function(en) {
                if (!collected[en.e.id] && dist(lx, ly, en.e.x, en.e.y) < ENERGY_RADIUS) {
                    collected[en.e.id] = true;
                    en.item.remove();
                    soundPickup(sec.data.region);
                    score += 10;
                    fuel = Math.min(100, fuel + 25);
                    if (score > best) { best = score; saveBest(best); }
                }
            });
        }
    }
}

function endRun() {
    dead = true;
    flame.visible = false;
    soundCrash();
    for (var k = 0; k < 28; k++) {
        emitSpark(pos - origin, new Point({ angle: k * 360 / 28, length: 40 + Math.random() * 90 }));
    }
    showGameOver(true);
}

function restart() {
    unloadAllSectors();
    collected = {}; score = 0; fuel = 100; heading = -90; dead = false;
    velocity = new Point(0, 0);
    pos = new Point(spawn.x, spawn.y);
    origin = sectorCorner(spawn.x, spawn.y);
    regionId = null;
    clearSparks();
    updateSectors();
    placeShip();
    showGameOver(false);
}

//==============================================
//==========     User Interaction     ==========
//==============================================
function onKeyDown(event) {
    unlockAudio();
    keysPressed[event.key] = true;
    if (event.key == 'm') toggleSound();
    if (event.key == 'l') {
        var here = sectorOf(pos.x, pos.y);
        copyPlaceLink(UNIVERSE, here.x, here.y);
    }
    if (event.key == 'r' && dead) restart();
    if (event.key == '+') view.zoom = view.zoom + 0.1;
    if (event.key == '-') view.zoom = Math.max(MIN_ZOOM, view.zoom - 0.1);
}

function onKeyUp(event) {
    keysPressed[event.key] = false;
}

// Hook for tests and the browser console.
window.spacejam = {
    info: function() {
        var s = sectorOf(pos.x, pos.y);
        return { universe: UNIVERSE, pilot: pilot, x: pos.x, y: pos.y, sector: [s.x, s.y],
                 origin: [origin.x, origin.y], sectors: Object.keys(sectors).length,
                 items: worldLayer.children.length, dead: dead, score: score, fuel: fuel };
    },
    restart: restart,
    // Test: move the origin by whole sectors. The frame must not change.
    shiftOrigin: function(sx, sy) {
        setOrigin(origin + new Point(sx * SECTOR_SIZE, sy * SECTOR_SIZE));
    }
};
