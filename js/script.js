
console.log("Start");


var seedRaw = getParameterByName('seed');
var showGridRaw = getParameterByName('showGrid');
var initialZoomRaw = getParameterByName('zoomLevel');

var showGrid = true;
var initialZoom = 2.6;

var planetarySystems = [[]];

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
var xorshift64starSeed = +seed;

console.log("Original Seed:" + xorshift64starSeed);


function random() {
    return xorshift64star();
}

function xorshift64star() {
    xorshift64starSeed = xorshift64starSeed ^ (xorshift64starSeed >> 12) // a
    xorshift64starSeed = xorshift64starSeed ^ (xorshift64starSeed << 25) // b
    xorshift64starSeed = xorshift64starSeed ^ (xorshift64starSeed >> 27) // c
    return ((xorshift64starSeed * 2685821657736338717) % 1000) / 1000;
}

var planetsSize = Math.round(random() * 50);
console.log("Galaxy size:" + planetsSize);


setViewCenter(new Point(random() * 5000000, random() * 5000000));

console.log("Initial location:" + view.center + '; bounds' + view.getBounds());



var Galaxy = function() {

    this.planetarySystems = [[]];
    this.random = arguments.randomGenerator;

    this.addPlanetarySystem = function(planetarySystem, x, y) {

        this.planetarySystems[x][y] = planetarySystem;
    }
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

var drawPlanetarySystem = function(galaxy, num_rectangles_wide, num_rectangles_tall, boundingRect) {
    var width = 400;
    var height = 400;
    for (var i = 0; i < num_rectangles_wide; i++) {
        for (var j = 0; j < num_rectangles_tall; j++) {

            var x = boundingRect.left + i * width;
            var y = boundingRect.top + j * height;

            var planetarySystem = new PlanetarySystem({
                rectangle: (new Rectangle(x, y, width, height)),
                randomGenerator: getXorRandomWithSeed(convertCoordinateToSeed(x,y,seed)),
                showGrid:showGrid
            });
            planetarySystem.drawPlanets();

            planetarySystems.push(planetarySystem);
        }
    }
}




//  [][][][][][][][][]
//  [] 1 1 1 1 1 1 1[]
//  [] 1 2 2 2 2 2 1[]
//  [] 1 2 3 X 3 2 1[]
//  [] 1 2 2 2 2 2 1[]
//  [] 1 1 1 1 1 1 1[]
//  [][][][][][][][][]

var galaxy1 = new Galaxy()

drawPlanetarySystem(galaxy1, 5, 5, view.bounds);

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


function checkIfNeedToDraw(){

    return true
}

function getPlanetarySystem(galaxy, x, y){

}

//==============================================
//=========   View Helper Functions    =========
//============================================== 

function onFrame() {
    var vector = destination - view.center;
    setViewCenter(view.center + (vector / 15));
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
    var translationSize = 9;
    if (event.key == 'space') {
        destination = new Point(0, 0);
    }
    if (event.key == 'down') {
        destination = new Point(destination.x, destination.y + translationSize);
    } else if (event.key == 'up') {
        destination = new Point(destination.x, destination.y - translationSize);
    } else if (event.key == 'left') {
        destination = new Point(destination.x - translationSize, destination.y);
    } else if (event.key == 'right') {
        destination = new Point(destination.x + translationSize, destination.y);
    }

    if (event.key == '+') {
        zoomIn()
    }
    if (event.key == '-') {
        zoomOut()
    }
}


//==============================================
//=========      Helper Functions      =========
//============================================== 
function convertCoordinateToSeed(x, y, seed) {
    var result = ((y*x ^ seed) ^ x)^y;
    return result
}

