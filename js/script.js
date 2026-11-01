
console.log("Start");


var seedRaw = getParameterByName('seed');
var showGridRaw = getParameterByName('showGrid');
var initialZoomRaw = getParameterByName('zoomLevel');

var showGrid = true;
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

var galaxy1 = new Galaxy()

// Initialize sectors around starting position
updateVisibleSectors(view.center.x, view.center.y);

var player = new Path.Circle({
    center: view.center,
    radius: 5,
    strokeColor: '#737373',
    strokeWidth: 0.5,
    fillColor: 'red'
});

var destination = view.center;
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

function onFrame() {
    // Handle continuous movement based on pressed keys
    var movementSpeed = 2;
    var deltaX = 0;
    var deltaY = 0;
    
    // Check for movement keys (arrow keys and WASD)
    if (keysPressed['up'] || keysPressed['w']) deltaY -= movementSpeed;
    if (keysPressed['down'] || keysPressed['s']) deltaY += movementSpeed;
    if (keysPressed['left'] || keysPressed['a']) deltaX -= movementSpeed;
    if (keysPressed['right'] || keysPressed['d']) deltaX += movementSpeed;
    
    // Apply movement if any keys are pressed
    if (deltaX !== 0 || deltaY !== 0) {
        destination = new Point(destination.x + deltaX, destination.y + deltaY);
    }
    
    // Smooth movement to destination with consistent speed
    var vector = destination - view.center;
    var distance = vector.length;
    
    if (distance > movementSpeed) {
        // Move at consistent speed towards destination
        var direction = vector.normalize();
        setViewCenter(view.center + (direction * movementSpeed));
    } else if (distance > 0.1) {
        // Close to destination, move directly there
        setViewCenter(destination);
    }
    
    // Update sectors around player position for infinite map
    updateVisibleSectors(view.center.x, view.center.y);
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
function onMouseUp(event) {
    destination = event.point
}

function onKeyDown(event) {
    // Mark keys as pressed for continuous movement
    keysPressed[event.key] = true;
    
    // Handle special keys
    if (event.key == 'space') {
        destination = new Point(0, 0);
    }
    if (event.key == 'c') {
        destination = view.center; // Center on current position
    }
    if (event.key == '+') {
        zoomIn();
    }
    if (event.key == '-') {
        zoomOut();
    }
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
    
    activeSectors[key] = {
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

