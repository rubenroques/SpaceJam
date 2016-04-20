var seedRaw = getParameterByName('seed');
var showGridRaw = getParameterByName('showGrid');
var initialZoomRaw = getParameterByName('zoomLevel');

var showGrid = true;
var initialZoom = 2.6;

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

var planets = [];

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

setViewCenter(new Point(random() * 500, random() * 500));

//Comment to see the planets
console.log("Initial location:" + view.center + '; bounds' + view.getBounds());

// var pRandom = getRandomWithSeed(10000);
// console.log("r:" + pRandom());

// var xorRandom = getXorRandomWithSeed(10000);
// console.log("r:" + xorRandom());

var Grid = function(arguments) {
    this.random = arguments.seed;
    
    this.rect = new paper.Path.Rectangle(arguments.rectangle);

    if (showGrid) {
        this.rect.strokeColor = '#3f3f3f';
    }
    this.rect.strokeWidth = 3;

    this.planetsSize = Math.round( this.random() * 10);
    this.planetsColor = new Color( this.random(),this.random(),this.random());
    this.planets = [];

    this.drawPlanets = function() {
        console.log("planets to draw:" + this.planetsSize);
        var it = 0;
        while (it < this.planetsSize) {

            var center = new Point(this.random()*200+this.rect.position.x-100, this.random()*200+this.rect.position.y-100);

            var planet = new Path.Circle({
                center: center,
                radius: (this.random() * 14)+2,
                strokeColor: '#737373',
                strokeWidth: 1,
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



// var grid = new Grid({
//     rectangle: (new Rectangle(20, 0, 200, 200)), 
//     seed: getXorRandomWithSeed(convertCoordinateToSeed(20,0,seed))
// });
// grid.drawPlanets();

// var grid2 = new Grid({
//     rectangle: (new Rectangle(240, 0, 200, 200)),
//     seed: getXorRandomWithSeed(convertCoordinateToSeed(20,0,seed))
// });
// grid2.drawPlanets();

// var grid3 = new Grid({
//     rectangle: (new Rectangle(460, 0, 200, 200)),
//     seed: getXorRandomWithSeed(convertCoordinateToSeed(20,0,seed))
// });
// grid3.drawPlanets();

// var grid4 = new Grid({
//     rectangle: (new Rectangle(680, 0, 200, 200)),
//     seed: getXorRandomWithSeed(convertCoordinateToSeed(20,0,seed))
// });
// grid4.drawPlanets();

// var grid5 = new Grid({
//     rectangle: (new Rectangle(900, 0, 200, 200)),
//     seed: getXorRandomWithSeed(convertCoordinateToSeed(20,0,seed))
// });
// grid5.drawPlanets();

var drawGridRects = function(num_rectangles_wide, num_rectangles_tall, boundingRect) {
    var width_per_rectangle = 200;
    var height_per_rectangle = 200;
    for (var i = 0; i < num_rectangles_wide; i++) {
        for (var j = 0; j < num_rectangles_tall; j++) {

            var x = boundingRect.left + i * width_per_rectangle;
            var y = boundingRect.top + j * height_per_rectangle;

            var grid5 = new Grid({
                rectangle: (new Rectangle(
                x, 
                y, 
                width_per_rectangle, 
                height_per_rectangle
                )),
                seed: getXorRandomWithSeed(convertCoordinateToSeed(x,y,seed))
            });
            grid5.drawPlanets();

        }
    }
}

function drawPlanets() {
    var it = 0;
    while (it < planetsSize) {

        var planet = new Path.Circle({
            center: new Point(random(), random()) * view.size,
            radius: (random() * 33) + 5,
            strokeColor: '#737373',
            strokeWidth: 1,
            fillColor: '#333333'
        });

        var intersections = 0;
        planets.forEach(function(entry) {

            var intersections = planet.getIntersections(entry);

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
            planets.push(planet);
        }
        it++;
    }
}


drawGridRects(20, 20, view.bounds);
//drawPlanets();

var destination = view.center;
var zoomLevel = initialZoom;
view.zoom = zoomLevel;


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
}

function zoomIn() {
    view.zoom += 0.1
    zoomLevel = view.zoom
}

function zoomOut() {
    var newZoom = view.zoom - 0.1
    if (newZoom < 1) {
        newZoom = 1
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
    var translationSize = 60;
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

