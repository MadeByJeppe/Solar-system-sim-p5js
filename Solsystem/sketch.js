let lastMouseX, lastMouseY;

let cameraDistanceMax, cameraDistanceMin, cameraDistance;
cameraDistanceMax = 10000000;
cameraDistanceMin = 5;

cameraDistance = 100000;
let cameraAngleX, cameraAngleY;
cameraAngleX = 0;
cameraAngleY = 90;


let cameraAngleSensitivity = 0.2;
let cameraZoomStep;
let cameraZoomSensitivity = 0.001;

let cameraX, cameraY, cameraZ;

let bodies, bodyNameElements;
bodies = bodyNameElements = [];

let AU = 149597870700;
let ORBITAL_PERIODS = [0, 0.2408, 0.6152, 1, 1.8809, 11.862, 29.458, 84.01, 164.79, 248.54];
let G = 6.674e-11;

let simScale = 5000;
let radiusScale = 10;

let trailSteps;
trailSteps = 1000;

let lastSteps = [];

let font; 

function preload() {
    bodies = getBodies(getMovements(), window.lagrange.planet_info);
    font = loadFont('./assets/ARIAL.TTF');

    console.log(bodies);
}

function setup() {
    createCanvas(windowWidth, windowHeight, WEBGL);
    addScreenPositionFunction();

    perspective(PI/3.0, width/height, 10, 10000000000);
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);   
    perspective(PI/3.0, width/height, 10, 10000000000);
}

function draw() {
    background(0);

    push();
    stroke(color(255,0,0));
    beginShape();
    vertex(0,0,0);
    vertex(1000,0,0);
    endShape();

    stroke(color(0,255,0));
    beginShape();
    vertex(0,0,0);
    vertex(0,1000,0);
    endShape();

    stroke(color(0,0,255));
    beginShape();
    vertex(0,0,0);
    vertex(0,0,1000);
    endShape();
    pop();

    for(var i = 0; i < 1000; i++) setPositions();

    setCameraPos();

    drawBodies();
}

function drawBodies () {
    for(var i = 0; i < bodies.length; i++) {
        var scale = AU * simScale;

        var bodyPos = bodies[i].positionsScaled[0];
        var bodyRad = bodies[i].radius/AU*simScale*radiusScale;

        angleMode(RADIANS);

        drawBodyTrail(i);

        push();        
        normalMaterial();
        // console.log("pos: " + bodies[i].position);
        translate(bodyPos);
        sphere(bodyRad);
        pop();


        // Calculate if planet is behind camera or not
        var screenPos = screenPosition(bodyPos);

        var cVector = createVector(cameraX, cameraY, cameraZ);

        var bMag = bodyPos.magSq();
        var cMag = cVector.magSq();

        var cross = bodyPos.dot(cVector);

        if (Math.sign(cross) <= 0) {
            screenPos = screenPosition(bodyPos);
        } else {
            if (bMag > cMag) {
                screenPos = createVector(windowWidth,0);
            }
        }

        var distToCamera = bodyPos.dist(createVector(cameraX, cameraY, cameraZ)); 

        var bodyIndex = bodyNameElements.findIndex(b => b.name == bodies[i].name);

        if (bodyIndex == -1) {
            var bodyNameElement = createElement('h1', bodies[i].name);
            bodyNameElement.position(windowWidth/2 + screenPos.x, windowHeight/2 + screenPos.y);
            bodyNameElements.push({name: bodies[i].name, element: bodyNameElement, distance: distToCamera});
        } else {
            bodyNameElements[bodyIndex].element.position(windowWidth/2 + screenPos.x, windowHeight/2 + screenPos.y);
            bodyNameElements[bodyIndex].distance = distToCamera;
        }
    }

    bodyNameElements.sort((a,b) => b.distance - a.distance);

    for(var i = 0; i < bodyNameElements.length; i++) {
        bodyNameElements[i].element.style("z-index", i);
    }
}

function drawBodyTrail(bodyIndex) {
    shiftPositions(bodyIndex);

    var positions = bodies[bodyIndex].positionsScaled;

    noFill();
    stroke(255);
    beginShape();

    vertex(positions[0].x , positions[0].y, positions[0].z);

    for (var j = 0; j < positions.length; j++) {
        vertex(positions[j].x, positions[j].y, positions[j].z);
    }

    endShape();
}

function calcAccelerations() {
    var bodyForces = [];

    for (var i = 0; i < ORBITAL_PERIODS.length; i++) {
        bodyForces.push({name: bodies[i].name, forces: Array(ORBITAL_PERIODS.length).fill(null)});
    }

    for (var i = 0; i < bodyForces.length; i++) {
        for (var j = 0; j < bodyForces.length; j++) {
            if (i == j) continue;
            if (bodyForces[i].forces[j] != null) continue;

            var r = p5.Vector.sub(bodies[i].position, bodies[j].position);
            var rm = r.mag();

            var F = p5.Vector.mult(r,(G*bodies[i].mass*bodies[j].mass)/(rm ** 3));

            bodyForces[i].forces[j] = p5.Vector.mult(F, -1);
            bodyForces[j].forces[i] = F;
        }
    }

    var accs = [];

    for (var i = 0; i < bodyForces.length; i++) {
        var F = createVector(0,0,0);

        for (var j = 0; j < bodyForces.length; j++) {
            if (bodyForces[i].forces[j] == null) continue;

            F.add(bodyForces[i].forces[j]);
        }

        var a = F.div(bodies[i].mass);

        var as = p5.Vector.div(a, AU).mult(simScale);

        accs.push({unscaled: a, scaled: as});
    }

    return accs;
}

function setPositions() {
    setVelocities();

    for (var i = 0; i < ORBITAL_PERIODS.length; i++) {
        
        bodies[i].position.add(bodies[i].velocity);
        bodies[i].positionsScaled[0].add(bodies[i].velocityScaled);
    }
}

function setVelocities() {
    var accs = calcAccelerations();

    for (var i = 0; i < ORBITAL_PERIODS.length; i++) {
        bodies[i].velocity.add(accs[i].unscaled);
        bodies[i].velocityScaled.add(accs[i].scaled);
    }
}

function shiftPositions(bodyIndex) {
    if (lastSteps.length < ORBITAL_PERIODS.length) {
        for (var j = 0; j < ORBITAL_PERIODS.length; j++) {
            lastSteps.push({position: bodies[j].positionsScaled[bodies[j].positionsScaled.length - 1], distance: p5.Vector.dist(bodies[j].positionsScaled[bodies[j].positionsScaled.length - 2], bodies[j].positionsScaled[bodies[j].positionsScaled.length - 1])});
        }
    }

    var d = p5.Vector.dist(bodies[bodyIndex].positionsScaled[0], bodies[bodyIndex].positionsScaled[1]);

    bodies[bodyIndex].positionsScaled[bodies[bodyIndex].positionsScaled.length - 1] = p5.Vector.lerp(lastSteps[bodyIndex].position, bodies[bodyIndex].positionsScaled[bodies[bodyIndex].positionsScaled.length - 2], d/lastSteps[bodyIndex].distance);

    if (d > lastSteps[bodyIndex].distance) {
        bodies[bodyIndex].positionsScaled.unshift(bodies[bodyIndex].positionsScaled[0].copy());

        bodies[bodyIndex].positionsScaled.pop();

        lastSteps[bodyIndex] = {position: bodies[bodyIndex].positionsScaled[bodies[bodyIndex].positionsScaled.length - 1], distance: p5.Vector.dist(bodies[bodyIndex].positionsScaled[bodies[bodyIndex].positionsScaled.length - 2], bodies[bodyIndex].positionsScaled[bodies[bodyIndex].positionsScaled.length - 1])};
    }
}

function mousePressed() {
    lastMouseX = mouseX;
    lastMouseY = mouseY;
}

function mouseDragged() {
    dragX = lastMouseX - mouseX;
    dragY = lastMouseY - mouseY;

    cameraAngleX -= dragX * cameraAngleSensitivity;
    cameraAngleY = constrain(cameraAngleY - dragY * cameraAngleSensitivity, 1, 179);

    lastMouseX = mouseX;
    lastMouseY = mouseY;

    // console.log("cameraAngleVector: " + cameraAngleX + ", " + cameraAngleY);
}

function mouseWheel(event) {
    cameraZoomStep = cameraDistance * cameraZoomSensitivity;
    cameraDistance = constrain(cameraDistance + event.delta * cameraZoomStep, cameraDistanceMin, cameraDistanceMax)
}

function setCameraPos() {
    angleMode(DEGREES);
    cameraX = cameraDistance * sin(cameraAngleY) * cos(cameraAngleX);
    cameraZ = cameraDistance * sin(cameraAngleY) * sin(cameraAngleX);
    cameraY = cameraDistance * cos(cameraAngleY);

    // console.log(cameraX + ", " + cameraY + ", " + cameraZ);

    camera(cameraX, cameraY, cameraZ, 0, 0, 0, 0, 1, 0);
}

function getMovements() {
    var movements = [];
    
    while (movements.length < ORBITAL_PERIODS.length) {
        movements.push({position: p5.Vector, velocity: p5.Vector, positionsScaled: [], velocityScaled: p5.Vector});
    }

    for(var i = 0; i < movements.length; i++) {
        var trailStepTime = ORBITAL_PERIODS[i]/trailSteps * 365 * 24 * 60 * 60 * 1000;

        for(var j = 0; j < trailSteps; j++) {
            var m = window.lagrange.planet_positions.getPositions(Date.now() - j * trailStepTime, true);

            var p = createVector(m[i].position.y, -m[i].position.z, m[i].position.x);
            var v = createVector(m[i].velocity.y, -m[i].velocity.z, m[i].velocity.x);

            movements[i].positionsScaled[j] = p5.Vector.div(p, AU).mult(simScale);

            if (j == 0) {
                movements[i].position = p;
                movements[i].velocity = v;

                movements[i].velocityScaled = p5.Vector.div(v, AU).mult(simScale);
            }
        }
    }

    return movements;
}

function getBodies (movements, info) {
    var bodies = [];
    
    for(var i = 0; i < movements.length; i++) {
        bodies.push(new Body(movements[i], info[i]));
    }

    return bodies;
}

class Body {
    constructor (movement, info) {
        this.name = info.title;

        this.position = movement.position; // m, only item [0] can be expected to an unscaled representation of the planets position. This probably shouldn't be an array
        this.velocity = movement.velocity; // m/s, velocities probably shouldn't be returned as an array

        this.positionsScaled = movement.positionsScaled;
        this.velocityScaled = movement.velocityScaled;

        this.mass = info.mass; // kg
        this.radius = info.radius * 1000 // 
    }
}





