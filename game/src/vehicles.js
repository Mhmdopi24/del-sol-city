// Del Sol City — vehicles.js
// Car factory plus the traffic system. Every car is a small group of boxes and
// cylinder wheels built once and reused. Traffic cars follow the road grid
// node to node on the correct side, slow for the car ahead and for crossing
// pedestrians, and pick a new heading at each intersection. Parked cars line
// the kerbs. The same physics step drives the player's car.

var CAR_COLORS = [0xd64545, 0x3f6fd8, 0xf2f0e6, 0x30343a, 0xf0a832, 0x53b06a, 0x8e5fc0, 0xd86fb0, 0x9aa4ae, 0x2a9d8f];

var Vehicles = {
  bodyGeo: null, cabinGeo: null, wheelGeo: null,
  wheelMat: null, glassMat: null,

  initGeos: function () {
    this.bodyGeo = new THREE.BoxGeometry(2.0, 0.62, 4.3);
    this.cabinGeo = new THREE.BoxGeometry(1.8, 0.58, 2.1);
    this.wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    this.wheelMat = new THREE.MeshLambertMaterial({ color: 0x17181a });
    this.glassMat = new THREE.MeshLambertMaterial({ color: 0x223140 });
  },

  // Builds one car. kind: 'traffic' | 'parked' | 'police'. Returns the car
  // record used by every other system.
  makeCar: function (kind, color) {
    if (!this.bodyGeo) this.initGeos();
    var group = new THREE.Group();
    var paint = new THREE.MeshLambertMaterial({ color: color });
    var body = new THREE.Mesh(this.bodyGeo, paint);
    body.position.y = 0.55;
    group.add(body);
    var cabin = new THREE.Mesh(this.cabinGeo, this.glassMat);
    cabin.position.set(0, 1.12, -0.25);
    group.add(cabin);
    var wheels = [];
    var wpos = [[-0.95, -1.45], [0.95, -1.45], [-0.95, 1.45], [0.95, 1.45]];
    for (var i = 0; i < 4; i++) {
      var w = new THREE.Mesh(this.wheelGeo, this.wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wpos[i][0], 0.38, wpos[i][1]);
      group.add(w);
      wheels.push(w);
    }
    var extras = {};
    if (kind === 'police') {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.5),
        new THREE.MeshLambertMaterial({ color: 0xdddddd }));
      bar.position.set(0, 1.5, -0.25);
      group.add(bar);
      var red = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.44),
        new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
      red.position.set(-0.38, 1.52, -0.25);
      group.add(red);
      var blue = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.44),
        new THREE.MeshBasicMaterial({ color: 0x2a5cff }));
      blue.position.set(0.38, 1.52, -0.25);
      group.add(blue);
      extras.redLight = red; extras.blueLight = blue;
      var stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.32),
        new THREE.MeshLambertMaterial({ color: 0x24407c }));
      stripe.position.y = 0.62;
      group.add(stripe);
    }
    G.scene.add(group);
    return {
      group: group, wheels: wheels, extras: extras, kind: kind,
      color: color, speed: 0, heading: 0, health: 100,
      node: null, target: null, cruise: rand(10, 15),
      driver: null, occupied: false, honkT: 0, dead: false,
    };
  },

  placeCar: function (car, x, z, heading) {
    car.group.position.set(x, 0, z);
    car.heading = heading;
    car.group.rotation.y = heading;
  },

  // The node a car is heading to, with the right-hand lane offset applied.
  lanePoint: function (car) {
    var t = car.target;
    var dx = Math.sign(t.x - car.node.x), dz = Math.sign(t.z - car.node.z);
    // Right-hand traffic: shift the target sideways by half a lane.
    return { x: t.x + dz * 3.4, z: t.z - dx * 3.4, dx: dx, dz: dz };
  },

  pickNextNode: function (car) {
    var node = car.target;
    var options = [];
    for (var i = 0; i < CFG.ROADS.length; i++) {
      var rx = CFG.ROADS[i];
      if (rx !== node.x) options.push({ x: rx, z: node.z });
      if (rx !== node.z) options.push({ x: node.x, z: rx });
    }
    // Prefer going straight, never U-turn unless it is the only way.
    var straight = null, back = null, sides = [];
    for (i = 0; i < options.length; i++) {
      var o = options[i];
      var dx = Math.sign(o.x - node.x), dz = Math.sign(o.z - node.z);
      var cdx = Math.sign(node.x - car.node.x), cdz = Math.sign(node.z - car.node.z);
      if (dx === cdx && dz === cdz) straight = o;
      else if (dx === -cdx && dz === -cdz) back = o;
      else sides.push(o);
    }
    var next = straight && chance(0.72) ? straight : (sides.length ? pick(sides) : (straight || back));
    car.node = node;
    car.target = next;
  },

  spawnTraffic: function (count) {
    for (var i = 0; i < count; i++) {
      var car = this.makeCar('traffic', pick(CAR_COLORS));
      var a = { x: pick(CFG.ROADS), z: pick(CFG.ROADS) };
      var b = chance(0.5) ? { x: pick(CFG.ROADS), z: a.z } : { x: a.x, z: pick(CFG.ROADS) };
      if (b.x === a.x && b.z === a.z) b = { x: CFG.ROADS[3], z: a.z };
      car.node = a; car.target = b;
      var drv = Pedestrians.makePed();
      drv.group.visible = false; // seated inside, hidden by the cabin
      drv.seatedIn = car;
      car.driver = drv;
      var lp = this.lanePoint(car);
      var fx = lp.dx !== 0 ? rand(-26, 26) : 0, fz = lp.dz !== 0 ? rand(-26, 26) : 0;
      this.placeCar(car, a.x + lp.dz * 3.4 + fx, a.z - lp.dx * 3.4 + fz,
        Math.atan2(lp.dx, lp.dz));
      car.speed = car.cruise * rand(0.5, 1);
      G.cars.push(car);
    }
  },

  spawnParked: function (count) {
    for (var i = 0; i < count; i++) {
      var car = this.makeCar('parked', pick(CAR_COLORS));
      var alongX = chance(0.5);
      var road = pick(CFG.ROADS), along = rand(-200, 200), side = chance(0.5) ? 5.6 : -5.6;
      if (alongX) this.placeCar(car, along, road + side, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      else this.placeCar(car, road + side, along, side > 0 ? Math.PI : 0);
      car.parked = true;
      G.cars.push(car);
    }
  },

  // Is there a car or a pedestrian close ahead of this traffic car?
  blockedAhead: function (car) {
    var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    var px = car.group.position.x, pz = car.group.position.z;
    var i, o, dx, dz, ahead, side;
    for (i = 0; i < G.cars.length; i++) {
      o = G.cars[i];
      if (o === car || o.dead) continue;
      dx = o.group.position.x - px; dz = o.group.position.z - pz;
      ahead = dx * fx + dz * fz; side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 11 && side < 2.4) return true;
    }
    if (G.currentCar && G.currentCar !== car) {
      o = G.currentCar;
      dx = o.group.position.x - px; dz = o.group.position.z - pz;
      ahead = dx * fx + dz * fz; side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 11 && side < 2.4) return true;
    }
    for (i = 0; i < G.peds.length; i++) {
      var p = G.peds[i];
      if (p.dead) continue;
      dx = p.group.position.x - px; dz = p.group.position.z - pz;
      ahead = dx * fx + dz * fz; side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 9 && side < 2.2) return true;
    }
    // The player on foot counts too.
    if (G.mode === 'foot' && G.player) {
      dx = G.player.group.position.x - px; dz = G.player.group.position.z - pz;
      ahead = dx * fx + dz * fz; side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 9 && side < 2.2) return true;
    }
    return false;
  },

  updateTraffic: function (dt) {
    for (var i = 0; i < G.cars.length; i++) {
      var car = G.cars[i];
      if (car.parked || car.dead || car === G.currentCar) continue;
      var lp = this.lanePoint(car);
      var px = car.group.position.x, pz = car.group.position.z;
      var dx = lp.x - px, dz = lp.z - pz;
      var distT = Math.sqrt(dx * dx + dz * dz);
      if (distT < 6) this.pickNextNode(car);
      var wantHeading = Math.atan2(dx, dz);
      car.heading = angleLerp(car.heading, wantHeading, clamp(dt * 2.4, 0, 1));
      var targetSpeed = this.blockedAhead(car) ? 0 : car.cruise;
      car.speed = lerp(car.speed, targetSpeed, clamp(dt * (targetSpeed > car.speed ? 0.8 : 3.2), 0, 1));
      px += Math.sin(car.heading) * car.speed * dt;
      pz += Math.cos(car.heading) * car.speed * dt;
      var fixed = collideBuildings(px, pz, CFG.CAR_RADIUS);
      car.group.position.x = fixed[0];
      car.group.position.z = fixed[1];
      car.group.rotation.y = car.heading;
      this.spinWheels(car, dt);
    }
  },

  spinWheels: function (car, dt) {
    var rot = car.speed * dt / 0.38;
    for (var i = 0; i < car.wheels.length; i++) car.wheels[i].rotation.x += rot;
  },

  // Arcade driving step shared by the player (and reused for police with
  // different inputs). input: {throttle -1..1, steer -1..1}.
  driveStep: function (car, input, dt, topSpeed) {
    var maxF = topSpeed || CFG.CAR_MAX_SPEED;
    if (input.throttle > 0) car.speed += CFG.CAR_ACCEL * dt * (1 - Math.max(0, car.speed) / (maxF * 1.25));
    else if (input.throttle < 0) {
      if (car.speed > 0.5) car.speed -= CFG.CAR_BRAKE * dt;
      else car.speed = Math.max(car.speed - CFG.CAR_REVERSE * dt, -CFG.CAR_MAX_REVERSE);
    } else {
      car.speed -= car.speed * 0.55 * dt; // engine braking / drag
      if (Math.abs(car.speed) < 0.04) car.speed = 0;
    }
    car.speed = clamp(car.speed, -CFG.CAR_MAX_REVERSE, maxF);
    var steerAuthority = clamp(Math.abs(car.speed) / 6, 0, 1) * (car.speed < 0 ? -1 : 1);
    car.heading -= input.steer * CFG.CAR_TURN * steerAuthority * dt * clamp(1.15 - Math.abs(car.speed) / (maxF * 2.4), 0.45, 1.1);
    var px = car.group.position.x + Math.sin(car.heading) * car.speed * dt;
    var pz = car.group.position.z + Math.cos(car.heading) * car.speed * dt;
    var fixed = collideBuildings(px, pz, CFG.CAR_RADIUS);
    if (fixed[0] !== px || fixed[1] !== pz) {
      if (Math.abs(car.speed) > 12 && car === G.currentCar) Player.damage((Math.abs(car.speed) - 10) * 0.55, 'crash');
      car.speed *= 0.35;
    }
    car.group.position.x = fixed[0];
    car.group.position.z = fixed[1];
    car.group.rotation.y = car.heading;
    // A little body roll and pitch sells the speed.
    car.group.rotation.z = lerp(car.group.rotation.z || 0, -input.steer * clamp(Math.abs(car.speed) / maxF, 0, 1) * 0.045, dt * 6);
    this.spinWheels(car, dt);
  },
};
