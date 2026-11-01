
console.log("Start");


var seedRaw = getParameterByName('seed');
var showGridRaw = getParameterByName('showGrid');
var initialZoomRaw = getParameterByName('zoomLevel');

var showGrid = false;
var initialZoom = 2.6;

// Dynamic sector storage - use object with "x,y" keys for infinite map
var activeSectors = {};
var SECTOR_SIZE = 400;
var LOAD_DISTANCE = 2; // Load sectors within 2 sector radius
var UNLOAD_DISTANCE = 4; // Unload sectors beyond 4 sector radius

if (seedRaw == undefined || seedRaw == '') {
    seedRaw = new Date().getTime();
}

if (showGridRaw == 'true') {
    showGrid = true;
} else if (showGridRaw == 'false') {
    showGrid = false;
}

if (initialZoomRaw == undefined || initialZoomRaw == '') {
    initialZoom = 1.2;
} else {
    initialZoom = +initialZoomRaw;
}

var seed = seedRaw;
console.log("Original Seed:" + seed);

// Initialize seedrandom with the seed
var rng = new Math.seedrandom(seed);

function random() {
    return rng();
}

var planetsSize = Math.round(random() * 50);
console.log("Galaxy size:" + planetsSize);


setViewCenter(new Point(random() * 5000000, random() * 5000000));

console.log("Initial location:" + view.center + '; bounds' + view.getBounds());



var Galaxy = function() {
    // Galaxy is now just a container - sectors managed globally
    this.random = arguments.randomGenerator;
}

var PlanetarySystem = function(arguments) {

    this.detailLevel = 1000;
    this.showGrid = arguments.showGrid; 
    this.random = arguments.randomGenerator;
    this.rect = new paper.Path.Rectangle(arguments.rectangle);
    this.rect.strokeWidth = 3;
    if (this.showGrid) {
        this.rect.strokeColor = '#3f3f3f';
    }
    

    this.planetsSize = Math.round(this.random() * (this.rect.bounds.width*0.030));
    this.planetsColor = new Color(this.random(),this.random(),this.random());
    this.planets = [];

    this.center = {'x': 0,'y': 0};
    

    this.drawPlanets = function() {
        console.log("planets to draw:" + this.planetsSize);
        var it = 0;
        while (it < this.planetsSize) {

            var x = this.random()*this.rect.bounds.width+this.rect.position.x-(this.rect.bounds.width/2);
            var y = this.random()*this.rect.bounds.height+this.rect.position.y-(this.rect.bounds.height/2);
            var center = new Point(x, y);
            var planet = new Path.Circle({
                center: center,
                radius: (this.random() * (this.rect.bounds.height*0.09))+(this.rect.bounds.height*0.005),
                strokeColor: '#737373',
                strokeWidth: 0.5,
                fillColor: this.planetsColor
            });

            var intersections = 0;
            this.planets.forEach(function(iterator) {

                var intersections = planet.getIntersections(iterator);

                if (intersections.length > 0) {
                    planet.remove();
                } else {
                    intersections++;
                }
            });

            if (intersections == 0) {
                planet.onClick = function(event) {
                    this.fillColor = 'red';
                    console.log("\ncenter:" + this.position + "\nbounds:" + this.bounds + "\n");
                }
                this.planets.push(planet);
            }
            it++;
        }
    }
}

// Old fixed grid function - no longer used, replaced by dynamic generation




//  [][][][][][][][][]
//  [] 1 1 1 1 1 1 1[]
//  [] 1 2 2 2 2 2 1[]
//  [] 1 2 3 X 3 2 1[]
//  [] 1 2 2 2 2 2 1[]
//  [] 1 1 1 1 1 1 1[]
//  [][][][][][][][][]

// Game state. Declared before the first updateVisibleSectors call, because generateSector reads `collected`.
var startCenter = view.center;
var velocity = new Point(0, 0);
var heading = -90;
var fuel = 100, score = 0, best = loadBest(), dead = false;
var collected = {};
var SHIP_RADIUS = 6;

var galaxy1 = new Galaxy()

// Initialize sectors around starting position
updateVisibleSectors(view.center.x, view.center.y);
clearSpawn();

// applyMatrix: false, so `rotation` is an absolute angle and does not accumulate.
var player = new Path({
    segments: [[9, 0], [-6, -6], [-3, 0], [-6, 6]],
    closed: true,
    fillColor: '#7df',
    strokeColor: 'white',
    strokeWidth: 1,
    applyMatrix: false
});
player.position = view.center;
player.rotation = heading;
var zoomLevel = initialZoom;
view.zoom = zoomLevel;

// Track which keys are currently pressed
var keysPressed = {};


function checkIfNeedToDraw(){

    return true
}

function getPlanetarySystem(galaxy, x, y){

}

//==============================================
//=========   View Helper Functions    =========
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
        player.rotation = heading;
        player.fillColor = thrusting ? '#fd6' : '#7df';
        setViewCenter(view.center + velocity * dt);
        updateVisibleSectors(view.center.x, view.center.y);
        checkCollisions();
        if (fuel <= 0 && velocity.length < 8) endRun();
    }
    setStarOffset(view.center.x, view.center.y);
    updateHud(score, best, Math.round(fuel));
}

function hitPlanet(planets, pos, margin) {
    // this.planets also holds planets that drawPlanets removed (see CLAUDE.md), so skip them.
    for (var i = 0; i < planets.length; i++) {
        var p = planets[i];
        if (p.isInserted() && pos.getDistance(p.position) < p.bounds.width / 2 + margin) return p;
    }
    return null;
}

function checkCollisions() {
    var pos = player.position;
    var s = getSectorCoords(pos.x, pos.y);
    for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
            var sector = activeSectors[getSectorKey(s.x + dx, s.y + dy)];
            if (!sector) continue;
            if (hitPlanet(sector.system.planets, pos, SHIP_RADIUS)) { endRun(); return; }
            sector.pickups.forEach(function(e) {
                if (e.isInserted() && pos.getDistance(e.position) < 14) {
                    e.remove();
                    collected[e.data.id] = true;
                    score += 10;
                    fuel = Math.min(100, fuel + 25);
                    if (score > best) { best = score; saveBest(best); }
                }
            });
        }
    }
}

// Remove planets on top of the start point, so a run never starts inside a planet.
function clearSpawn() {
    Object.keys(activeSectors).forEach(function(k) {
        var hit;
        while ((hit = hitPlanet(activeSectors[k].system.planets, startCenter, 60))) hit.remove();
    });
}

function endRun() {
    dead = true;
    showGameOver(true);
}

function restart() {
    unloadDistantSectors(Infinity, Infinity); // every sector is "too far": unload all
    collected = {}; score = 0; fuel = 100; heading = -90; dead = false;
    velocity = new Point(0, 0);
    setViewCenter(startCenter);
    updateVisibleSectors(startCenter.x, startCenter.y);
    clearSpawn();
    showGameOver(false);
}



//==============================================
//=========   View Helper Functions    =========
//============================================== 
function setViewCenter(newCenter) {
    view.center = newCenter
    if (player != undefined ) {
        player.position = newCenter    
    }
}

function zoomIn() {
    view.zoom += 0.1
    zoomLevel = view.zoom
}

function zoomOut() {
    var newZoom = view.zoom - 0.1
    if (newZoom <= 0) {
        newZoom = 0.1
    }
    view.zoom = newZoom
    zoomLevel = view.zoom
}


//==============================================
//==========     User Interaction     ==========
//============================================== 
function onKeyDown(event) {
    keysPressed[event.key] = true;
    if (event.key == 'r' && dead) restart();
    if (event.key == '+') zoomIn();
    if (event.key == '-') zoomOut();
}

function onKeyUp(event) {
    // Mark keys as released
    keysPressed[event.key] = false;
}


//==============================================
//=========      Helper Functions      =========
//============================================== 
function convertCoordinateToSeed(x, y, seed) {
    var result = ((y*x ^ seed) ^ x)^y;
    return result
}

function getSeededRandom(seed) {
    return new Math.seedrandom(seed);
}

//==============================================
//=========    Infinite Map System     =========
//============================================== 

function getSectorCoords(worldX, worldY) {
    return {
        x: Math.floor(worldX / SECTOR_SIZE),
        y: Math.floor(worldY / SECTOR_SIZE)
    };
}

function getSectorKey(sectorX, sectorY) {
    return sectorX + "," + sectorY;
}

function generateSector(sectorX, sectorY) {
    var key = getSectorKey(sectorX, sectorY);
    if (activeSectors[key]) {
        return; // Already exists
    }
    
    var worldX = sectorX * SECTOR_SIZE;
    var worldY = sectorY * SECTOR_SIZE;
    
    var planetarySystem = new PlanetarySystem({
        rectangle: new Rectangle(worldX, worldY, SECTOR_SIZE, SECTOR_SIZE),
        randomGenerator: getSeededRandom(convertCoordinateToSeed(worldX, worldY, seed)),
        showGrid: showGrid
    });
    planetarySystem.drawPlanets();

    // 0-2 energy pickups. Same sector RNG, used after the planets, so the planet layout does not change.
    var pickups = [];
    var count = Math.floor(planetarySystem.random() * 3);
    for (var i = 0; i < count; i++) {
        var at = new Point(worldX + planetarySystem.random() * SECTOR_SIZE, worldY + planetarySystem.random() * SECTOR_SIZE);
        var id = key + ':' + i;
        if (collected[id] || hitPlanet(planetarySystem.planets, at, 12)) continue;
        var e = new Path.Circle({ center: at, radius: 4, fillColor: '#6f9', shadowColor: '#6f9', shadowBlur: 14 });
        e.data.id = id;
        pickups.push(e);
    }

    activeSectors[key] = {
        pickups: pickups,
        system: planetarySystem,
        sectorX: sectorX,
        sectorY: sectorY
    };
}

function unloadDistantSectors(playerSectorX, playerSectorY) {
    Object.keys(activeSectors).forEach(function(key) {
        var sector = activeSectors[key];
        var distance = Math.max(
            Math.abs(sector.sectorX - playerSectorX),
            Math.abs(sector.sectorY - playerSectorY)
        );
        
        if (distance > UNLOAD_DISTANCE) {
            // Remove all planets in this sector
            sector.system.planets.forEach(function(planet) {
                planet.remove();
            });
            sector.pickups.forEach(function(e) { e.remove(); });
            if (sector.system.rect) {
                sector.system.rect.remove();
            }
            delete activeSectors[key];
        }
    });
}

function updateVisibleSectors(playerWorldX, playerWorldY) {
    var playerSector = getSectorCoords(playerWorldX, playerWorldY);
    
    // Generate sectors around player
    for (var dx = -LOAD_DISTANCE; dx <= LOAD_DISTANCE; dx++) {
        for (var dy = -LOAD_DISTANCE; dy <= LOAD_DISTANCE; dy++) {
            generateSector(playerSector.x + dx, playerSector.y + dy);
        }
    }
    
    // Unload distant sectors
    unloadDistantSectors(playerSector.x, playerSector.y);
}

