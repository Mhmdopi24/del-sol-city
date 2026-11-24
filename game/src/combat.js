// Del Sol City — combat.js
// Gunplay on foot and the consequences of collisions. Shooting raycasts from
// the camera through the crosshair: pedestrians take damage and die, cars
// take damage and smoke, and every shot is a witnessed crime. A separate
// sweep checks the player's car against pedestrians and other cars each
// frame so running people over and trading paint both register.

var Combat = {
  cooldown: 0,
  flash: null, flashT: 0,
  tracer: null, tracerT: 0,
  hitCooldowns: {},

  init: function () {
    var flashMat = new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.95 });
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), flashMat);
    this.flash.visible = false;
    G.scene.add(this.flash);
    var lineMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.8 });
    this.tracer = new THREE.Line(new THREE.BufferGeometry(), lineMat);
    this.tracer.visible = false;
    G.scene.add(this.tracer);
  },

  // Fired from the main loop while the mouse is held in aim mode.
  tryShoot: function (dt) {
    this.cooldown -= dt;
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.visible = false; }
    if (this.tracerT > 0) { this.tracerT -= dt; if (this.tracerT <= 0) this.tracer.visible = false; }
    if (G.mode !== 'foot' || !Player.aimMode || this.cooldown > 0) return;
    this.cooldown = 0.16;
    this.shoot();
  },

  shoot: function () {
    AudioSys.gunshot();
    var origin = G.camera.position.clone();
    var dir = new THREE.Vector3();
    G.camera.getWorldDirection(dir);
    var from = G.player.group.position;
    // Muzzle flash at the gun, tracer from the gun to the hit point.
    var muzzle = new THREE.Vector3(from.x, 1.35, from.z).add(dir.clone().multiplyScalar(0.7));
    this.flash.position.copy(muzzle);
    this.flash.visible = true; this.flashT = 0.05;

    var bestT = 60, bestPed = null, bestCar = null, i, p, c;
    // Pedestrians: treat as a vertical capsule, test ray distance in 2D plus height.
    for (i = 0; i < G.peds.length; i++) {
      p = G.peds[i];
      if (p.dead) continue;
      var t = this.rayHit(origin, dir, p.group.position, 0.55, 1.9);
      if (t !== null && t < bestT) { bestT = t; bestPed = p; bestCar = null; }
    }
    var cars = G.cars.concat(G.cops.map(function (u) { return u.car; }));
    for (i = 0; i < cars.length; i++) {
      c = cars[i];
      if (c.dead || c === G.currentCar) continue;
      t = this.rayHit(origin, dir, c.group.position, 2.3, 1.6);
      if (t !== null && t < bestT) { bestT = t; bestCar = c; bestPed = null; }
    }
    var end = origin.clone().add(dir.clone().multiplyScalar(bestT));
    this.tracer.geometry.setFromPoints([muzzle, end]);
    this.tracer.visible = true; this.tracerT = 0.06;

    Wanted.addHeat(CFG.HEAT_SHOT, from.x, from.z);
    Pedestrians.scare(from.x, from.z, 18);
    if (bestPed) {
      Pedestrians.hurt(bestPed, 34, 'player');
      AudioSys.hit();
    } else if (bestCar) {
      this.damageCar(bestCar, 22, true);
      AudioSys.hit();
    }
  },

  // Distance along the ray where it passes within r of a target column, or null.
  rayHit: function (origin, dir, targetPos, r, height) {
    var ox = targetPos.x - origin.x, oz = targetPos.z - origin.z;
    var t = ox * dir.x + oz * dir.z;
    if (t < 0.5 || t > 70) return null;
    var px = origin.x + dir.x * t, pz = origin.z + dir.z * t;
    var py = origin.y + dir.y * t;
    var dx = targetPos.x - px, dz = targetPos.z - pz;
    if (dx * dx + dz * dz > r * r) return null;
    if (py < -0.2 || py > height + 0.4) return null;
    return t;
  },

  damageCar: function (car, dmg, byPlayer) {
    car.health -= dmg;
    if (car.health <= 0 && !car.dead) {
      car.dead = true;
      car.speed = 0;
      car.group.rotation.z = 0.12;
      // A burnt-out wreck: darken the paint.
      car.group.children[0].material = new THREE.MeshLambertMaterial({ color: 0x1c1c1e });
      Pedestrians.scare(car.group.position.x, car.group.position.z, 14);
    }
  },

  // The player's car (or a cop car) meeting pedestrians and other cars.
  updateCollisions: function (dt) {
    var actors = [];
    if (G.mode === 'car' && G.currentCar) actors.push(G.currentCar);
    for (var i = 0; i < G.cops.length; i++) actors.push(G.cops[i].car);
    for (i = 0; i < actors.length; i++) {
      var car = actors[i];
      var isPlayer = car === G.currentCar;
      var pos = car.group.position, spd = Math.abs(car.speed);
      if (spd < 1) continue;
      // Pedestrians.
      for (var j = 0; j < G.peds.length; j++) {
        var p = G.peds[j];
        if (p.dead) continue;
        if (dist2D(pos.x, pos.z, p.group.position.x, p.group.position.z) < 2.3) {
          Pedestrians.hurt(p, spd > 7 ? 60 : 22, isPlayer ? 'player' : 'npc');
          if (isPlayer && spd > 4) { Wanted.addHeat(CFG.HEAT_HIT_PED, pos.x, pos.z); AudioSys.hit(); }
          p.group.position.x += Math.sin(car.heading) * 2.4;
          p.group.position.z += Math.cos(car.heading) * 2.4;
        }
      }
      // Other cars: a shove, a crunch, and heat for the player.
      var others = G.cars.concat(G.cops.map(function (u) { return u.car; }));
      for (j = 0; j < others.length; j++) {
        var o = others[j];
        if (o === car) continue;
        var key = (isPlayer ? 'p' : 'c') + '_' + j;
        if (dist2D(pos.x, pos.z, o.group.position.x, o.group.position.z) < 3.6) {
          if (!this.hitCooldowns[key] || this.hitCooldowns[key] <= 0) {
            this.hitCooldowns[key] = 0.8;
            if (isPlayer) {
              Wanted.addHeat(CFG.HEAT_HIT_CAR, pos.x, pos.z);
              if (spd > 14) Player.damage((spd - 12) * 0.5, 'crash');
            }
            this.damageCar(o, spd * 1.1, isPlayer);
            AudioSys.hit();
            var push = 1.6;
            o.group.position.x += (o.group.position.x - pos.x) / 3.6 * push;
            o.group.position.z += (o.group.position.z - pos.z) / 3.6 * push;
            car.speed *= 0.55;
          }
        }
      }
      // Traffic cars can run the player down on foot.
      if (G.mode === 'foot' && !isPlayer) {
        var pp = G.player.group.position;
        if (dist2D(pos.x, pos.z, pp.x, pp.z) < 2.4 && spd > 5) {
          Player.damage(spd * 1.4, 'runover');
          pp.x += Math.sin(car.heading) * 3;
          pp.z += Math.cos(car.heading) * 3;
        }
      }
    }
    for (var k in this.hitCooldowns) this.hitCooldowns[k] -= dt;
    // Slow health regen keeps free roam forgiving.
    if ((G.mode === 'foot' || G.mode === 'car') && G.health > 0 && G.health < CFG.PLAYER_MAX_HEALTH) {
      G.health = Math.min(CFG.PLAYER_MAX_HEALTH, G.health + dt * 1.6);
    }
  },
};
