// Del Sol City — police.js
// The wanted system and the Del Sol PD. Crimes add heat when a pedestrian or
// officer witnesses them; stars are ceil(heat). Staying out of sight drains
// heat until the chase is called off. Police units spawn at the city edge,
// chase in cars, ram the player, and fill the busted meter when they pin the
// player at low speed. On foot they close in the same way — this PD never
// leaves its cars, it just gets out and grabs you (the meter is the grab).

var Wanted = {
  addHeat: function (amount, x, z) {
    if (G.mode === 'busted' || G.mode === 'wasted') return;
    // Unwitnessed crimes in the middle of nowhere still count a little.
    var witnessed = this.witnessedAt(x, z, 30);
    G.wantedHeat = clamp(G.wantedHeat + (witnessed ? amount : amount * 0.35), 0, 5);
    G.unseenTime = 0;
    this.syncStars();
  },

  witnessedAt: function (x, z, radius) {
    var i;
    for (i = 0; i < G.peds.length; i++) {
      var p = G.peds[i];
      if (!p.dead && dist2D(p.group.position.x, p.group.position.z, x, z) < radius) return true;
    }
    for (i = 0; i < G.cops.length; i++) {
      var c = G.cops[i].car.group.position;
      if (dist2D(c.x, c.z, x, z) < radius + 14) return true;
    }
    return false;
  },

  syncStars: function () {
    var s = G.wantedHeat <= 0 ? 0 : Math.ceil(G.wantedHeat);
    if (s !== G.wantedStars) {
      G.wantedStars = s;
      HUD.renderStars();
      if (s > 0) AudioSys.blip(196, 0.12, 'sawtooth', 0.07);
    }
  },

  update: function (dt) {
    // Being seen resets the decay clock.
    var p = Player.pos();
    var seen = false;
    for (var i = 0; i < G.cops.length; i++) {
      var c = G.cops[i].car.group.position;
      if (dist2D(c.x, c.z, p.x, p.z) < 55) { seen = true; break; }
    }
    if (seen) G.unseenTime = 0; else G.unseenTime += dt;
    if (G.wantedHeat > 0 && G.unseenTime > CFG.HEAT_DECAY_DELAY) {
      G.wantedHeat = Math.max(0, G.wantedHeat - CFG.HEAT_DECAY_RATE * dt);
      this.syncStars();
      if (G.wantedHeat === 0) HUD.setObjectiveNote('You lost the cops.');
    }
  },
};

var Police = {
  spawnTimer: 0,
  flashT: 0,

  desiredCount: function () {
    // 1 star: a curious patrol. 5 stars: the whole precinct.
    return [0, 1, 2, 3, 4, 6][G.wantedStars] || 0;
  },

  clearAll: function () {
    for (var i = 0; i < G.cops.length; i++) G.scene.remove(G.cops[i].car.group);
    G.cops = [];
  },

  spawnOne: function () {
    var car = Vehicles.makeCar('police', 0xf2f2f2);
    car.cruise = CFG.POLICE_SPEED;
    // Spawn on a road at the city edge, away from the player's view.
    var p = Player.pos();
    var edge = pick(CFG.ROADS);
    var x = edge, z = chance(0.5) ? -205 : 205;
    if (dist2D(x, z, p.x, p.z) < 70) { x = -x; z = -z; }
    Vehicles.placeCar(car, x, z, Math.atan2(p.x - x, p.z - z));
    G.cops.push({ car: car, stuckT: 0, lastX: x, lastZ: z });
  },

  update: function (dt) {
    this.spawnTimer -= dt;
    var want = this.desiredCount();
    if (G.cops.length < want && this.spawnTimer <= 0) {
      this.spawnOne();
      this.spawnTimer = 2.2;
    }
    // Surplus units peel off when the heat drops.
    if (G.cops.length > want && want > 0) {
      var extra = G.cops.pop();
      G.scene.remove(extra.car.group);
      var idx = G.cars.indexOf(extra.car);
      if (idx >= 0) G.cars.splice(idx, 1);
    }
    if (want === 0 && G.cops.length > 0) this.clearAll();

    var target = Player.pos();
    var nearest = 9999;
    this.flashT += dt;
    var flashOn = Math.floor(this.flashT * 2.4) % 2 === 0;

    for (var i = 0; i < G.cops.length; i++) {
      var unit = G.cops[i], car = unit.car;
      if (car === G.currentCar) continue; // the player stole this one
      if (car.dead) continue;
      var pos = car.group.position;
      var d = dist2D(pos.x, pos.z, target.x, target.z);
      nearest = Math.min(nearest, d);
      // Chase: steer at a point a little ahead of the target to intercept.
      var lead = clamp(d / 26, 0, 1.2);
      var tx = target.x, tz = target.z;
      if (G.mode === 'car' && G.currentCar) {
        tx += Math.sin(G.currentCar.heading) * G.currentCar.speed * 0.45 * lead;
        tz += Math.cos(G.currentCar.heading) * G.currentCar.speed * 0.45 * lead;
      }
      var dx = tx - pos.x, dz = tz - pos.z;
      var wantHeading = Math.atan2(dx, dz);
      var steer = clamp(((wantHeading - car.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
      var playerSpeed = G.mode === 'car' && G.currentCar ? Math.abs(G.currentCar.speed) : 0;
      var throttle = d > 7 ? 1 : (playerSpeed > 3 ? 0.4 : -0.4);
      Vehicles.driveStep(car, { throttle: throttle, steer: -steer }, dt, CFG.POLICE_SPEED + G.wantedStars * 1.2);
      // Light bar strobing.
      if (car.extras.redLight) {
        car.extras.redLight.material.color.setHex(flashOn ? 0xff2a2a : 0x661111);
        car.extras.blueLight.material.color.setHex(flashOn ? 0x112266 : 0x2a5cff);
      }
      // Stuck detection: reverse out and try again.
      if (Math.abs(car.speed) < 1 && d > 12) {
        unit.stuckT += dt;
        if (unit.stuckT > 1.6) {
          Vehicles.driveStep(car, { throttle: -1, steer: steer }, dt * 2, 12);
          unit.stuckT = 0;
        }
      } else unit.stuckT = 0;
      // Busted meter: a cop close to a slow or on-foot player is arresting.
      var playerSlow = G.mode === 'foot' || playerSpeed < 4;
      if (!G.shotMode && d < CFG.BUSTED_RANGE && playerSlow && G.wantedStars > 0) {
        G.bustedMeter += dt / CFG.BUSTED_TIME;
        if (G.bustedMeter >= 1) { Player.busted(); return; }
      }
    }
    if (G.bustedMeter > 0 && (G.cops.length === 0 || nearest > CFG.BUSTED_RANGE + 3)) {
      G.bustedMeter = Math.max(0, G.bustedMeter - dt * 0.7);
    }
    AudioSys.siren(nearest);
    HUD.renderBusted(G.bustedMeter);
  },
};
