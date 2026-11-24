// Del Sol City — player.js
// Mara Vale, the player character: a low-poly figure with swinging limbs who
// walks, sprints and aims on foot, steals and drives cars, and takes damage.
// Owns the third-person camera for both modes and the busted/wasted flow.

var Player = {
  limbs: null,
  walkPhase: 0,
  aimMode: false,

  build: function () {
    var group = new THREE.Group();
    var jacket = new THREE.MeshLambertMaterial({ color: 0xc94f6d }); // Mara's coral jacket
    var skin = new THREE.MeshLambertMaterial({ color: 0xc98d5e });
    var dark = new THREE.MeshLambertMaterial({ color: 0x23232a });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.68, 0.3), jacket);
    torso.position.y = 1.14;
    group.add(torso);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.3), skin);
    head.position.y = 1.7;
    group.add(head);
    var hair = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.34), new THREE.MeshLambertMaterial({ color: 0x2a1a12 }));
    hair.position.y = 1.9;
    group.add(hair);
    var limbs = {};
    function limb(mat, w, len, x, y) {
      var pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat);
      m.position.y = -len / 2;
      pivot.add(m);
      group.add(pivot);
      return pivot;
    }
    limbs.armL = limb(jacket, 0.13, 0.62, -0.35, 1.44);
    limbs.armR = limb(jacket, 0.13, 0.62, 0.35, 1.44);
    limbs.legL = limb(dark, 0.17, 0.8, -0.14, 0.82);
    limbs.legR = limb(dark, 0.17, 0.8, 0.14, 0.82);
    this.limbs = limbs;
    // A simple pistol in the right hand, shown while aiming.
    var gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.34), dark);
    gun.position.set(0, -0.62, 0.12);
    limbs.armR.add(gun);
    this.gunMesh = gun;
    gun.visible = false;
    group.position.set(-6, 0, 10);
    G.scene.add(group);
    G.player = { group: group, yaw: Math.PI, speedNow: 0 };
    G.camYaw = Math.PI;
  },

  pos: function () {
    if (G.mode === 'car' && G.currentCar) return G.currentCar.group.position;
    return G.player.group.position;
  },

  nearestCar: function (maxDist) {
    var p = G.player.group.position, best = null, bd = maxDist;
    var all = G.cars.concat(G.cops.map(function (c) { return c.car; }));
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (c.dead) continue;
      var d = dist2D(p.x, p.z, c.group.position.x, c.group.position.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  },

  enterCar: function (car) {
    var wasParked = car.parked;
    car.parked = false;
    if (car.driver) { // a traffic driver bails out and runs
      var drv = car.driver;
      drv.group.position.copy(car.group.position);
      drv.group.visible = true;
      drv.state = 'flee'; drv.fleeT = 3;
      drv.fearX = car.group.position.x; drv.fearZ = car.group.position.z;
      drv.seatedIn = null;
      if (G.peds.indexOf(drv) < 0) G.peds.push(drv);
      car.driver = null;
    }
    G.currentCar = car;
    G.mode = 'car';
    G.player.group.visible = false;
    // Stealing in front of witnesses raises heat; taking a police car more.
    var witnessed = Wanted.witnessedAt(car.group.position.x, car.group.position.z, 26);
    if (!wasParked || witnessed) Wanted.addHeat(car.kind === 'police' ? 1.6 : CFG.HEAT_STEAL, car.group.position.x, car.group.position.z);
    if (witnessed) Pedestrians.scare(car.group.position.x, car.group.position.z, 10);
    AudioSys.blip(320, 0.07, 'square', 0.08);
    Missions.onEnterCar(car);
  },

  // Used by the staged screenshot scenes: sit Mara in a car with none of the
  // theft side effects.
  enterCarSilent: function (car) {
    car.parked = false;
    G.currentCar = car;
    G.mode = 'car';
    G.player.group.visible = false;
    G.player.group.position.copy(car.group.position);
  },

  exitCar: function () {
    var car = G.currentCar;
    if (!car) return;
    var p = car.group.position;
    var side = { x: p.x + Math.cos(car.heading) * -2.2, z: p.z + Math.sin(car.heading) * 2.2 };
    var fixed = collideBuildings(side.x, side.z, 0.55);
    G.player.group.position.set(fixed[0], 0, fixed[1]);
    G.player.group.visible = true;
    G.player.yaw = car.heading;
    car.speed = 0;
    if (car.kind === 'traffic') car.parked = true; // left where it stands
    G.currentCar = null;
    G.mode = 'foot';
    AudioSys.engine(0, false);
  },

  damage: function (amount, cause) {
    if (G.mode === 'busted' || G.mode === 'wasted' || G.shotMode) return;
    G.health -= amount;
    HUD.flashDamage();
    if (G.health <= 0) {
      G.health = 0;
      this.die();
    }
  },

  die: function () {
    G.mode = 'wasted';
    AudioSys.fail();
    HUD.showEndScreen('wasted');
  },

  busted: function () {
    G.mode = 'busted';
    AudioSys.bustedJingle();
    HUD.showEndScreen('busted');
  },

  respawn: function () {
    // Wake up outside the marina clinic, lighter in the wallet, heat gone.
    G.cash = Math.max(0, G.cash - (G.mode === 'busted' ? 150 : 100));
    G.health = CFG.PLAYER_MAX_HEALTH;
    G.wantedHeat = 0; G.wantedStars = 0; G.bustedMeter = 0;
    Police.clearAll();
    if (G.currentCar) { G.currentCar = null; }
    G.player.group.visible = true;
    G.player.group.position.set(196, 0, 24);
    G.player.yaw = -Math.PI / 2;
    G.mode = 'foot';
    HUD.hideEndScreen();
    SaveGame.write();
  },

  updateFoot: function (dt) {
    var p = G.player;
    var pos = p.group.position;
    // Camera-relative movement.
    var fwd = (G.keys['KeyW'] ? 1 : 0) - (G.keys['KeyS'] ? 1 : 0);
    var strafe = (G.keys['KeyD'] ? 1 : 0) - (G.keys['KeyA'] ? 1 : 0);
    var sprint = G.keys['ShiftLeft'] || G.keys['ShiftRight'];
    this.aimMode = G.mouseDown && G.pointerLocked;
    var speed = this.aimMode ? 2.2 : (sprint ? CFG.SPRINT_SPEED : CFG.WALK_SPEED);
    var sin = Math.sin(G.camYaw), cos = Math.cos(G.camYaw);
    var mx = (sin * fwd + cos * strafe), mz = (cos * fwd - sin * strafe);
    var ml = Math.sqrt(mx * mx + mz * mz);
    var moving = ml > 0.01;
    if (moving) {
      mx /= ml; mz /= ml;
      var nx = pos.x + mx * speed * dt, nz = pos.z + mz * speed * dt;
      var fixed = collideBuildings(nx, nz, CFG.PLAYER_RADIUS);
      pos.x = clamp(fixed[0], -CFG.WORLD_EDGE, CFG.WATER_X + 60);
      pos.z = clamp(fixed[1], -CFG.WORLD_EDGE, CFG.WORLD_EDGE);
      p.yaw = angleLerp(p.yaw, this.aimMode ? G.camYaw : Math.atan2(mx, mz), clamp(dt * 12, 0, 1));
      p.speedNow = speed;
    } else p.speedNow = 0;
    p.group.rotation.y = p.yaw;
    // Walk cycle.
    this.walkPhase += dt * (moving ? speed * 1.9 : 0);
    var sw = moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.limbs.legL.rotation.x = sw; this.limbs.legR.rotation.x = -sw;
    if (this.aimMode) {
      this.limbs.armR.rotation.x = -1.45; this.limbs.armL.rotation.x = -1.2;
      this.gunMesh.visible = true;
    } else {
      this.limbs.armL.rotation.x = -sw * 0.7; this.limbs.armR.rotation.x = sw * 0.7;
      this.gunMesh.visible = false;
    }
    pos.y = moving ? Math.abs(Math.sin(this.walkPhase)) * 0.05 : 0;
    // Wading limit: the sea is not swimmable in Del Sol.
    if (pos.x > CFG.WATER_X + 8) pos.x = CFG.WATER_X + 8;
    // Enter a car.
    if (G.keys['KeyE']) {
      G.keys['KeyE'] = false;
      var car = this.nearestCar(4.2);
      if (car) this.enterCar(car);
    }
    this.updateCamera(dt, pos, 6.5);
  },

  updateCar: function (dt) {
    var car = G.currentCar;
    var input = {
      throttle: (G.keys['KeyW'] ? 1 : 0) - (G.keys['KeyS'] ? 1 : 0),
      steer: (G.keys['KeyA'] ? 1 : 0) - (G.keys['KeyD'] ? 1 : 0),
    };
    if (G.keys['Space']) car.speed -= car.speed * 3.2 * dt; // handbrake
    Vehicles.driveStep(car, input, dt, car.kind === 'police' ? 38 : CFG.CAR_MAX_SPEED);
    AudioSys.engine(clamp(Math.abs(car.speed) / CFG.CAR_MAX_SPEED, 0, 1), input.throttle !== 0);
    // Running things over is handled by combat/collision checks in main.
    if (G.keys['KeyE']) {
      G.keys['KeyE'] = false;
      if (Math.abs(car.speed) < 3) this.exitCar();
    }
    this.updateCamera(dt, car.group.position, 10.5);
    // Keep the hidden player glued to the car so exiting and minimaps work.
    G.player.group.position.copy(car.group.position);
  },

  updateCamera: function (dt, target, dist) {
    if (G.pointerLocked && !G.shotMode) {
      G.camYaw -= G.mouseDX * 0.0026;
      G.camPitch = clamp(G.camPitch + G.mouseDY * 0.0022, -0.05, 1.1);
    }
    G.mouseDX = 0; G.mouseDY = 0;
    var d = this.aimMode ? 3.4 : (G.camDistOverride || dist);
    if (G.mode === 'car' && G.currentCar && !G.pointerLocked && !G.shotMode) {
      // Without pointer lock the chase camera settles behind the car.
      G.camYaw = angleLerp(G.camYaw, G.currentCar.heading + Math.PI, clamp(dt * 2.2, 0, 1));
    }
    var cx = target.x - Math.sin(G.camYaw) * Math.cos(G.camPitch) * d;
    var cz = target.z - Math.cos(G.camYaw) * Math.cos(G.camPitch) * d;
    var cy = target.y + 1.6 + Math.sin(G.camPitch) * d;
    var fixed = collideBuildings(cx, cz, 0.4);
    G.camera.position.set(fixed[0], Math.max(cy, 0.7), fixed[1]);
    G.camera.lookAt(target.x, target.y + 1.7, target.z);
  },
};
