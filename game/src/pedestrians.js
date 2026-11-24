// Del Sol City — pedestrians.js
// Citizens who stroll the sidewalk loops around each block and the beach
// promenade. They amble between waypoints, panic and run when a shot is
// fired, a car mounts the kerb at them, or someone nearby is hurt, and they
// have health: being run over or shot can kill them, which the wanted system
// hears about through Combat/Wanted hooks.

var PED_SHIRTS = [0xe8e4da, 0xd64545, 0x3f6fd8, 0xf0a832, 0x53b06a, 0xd86fb0, 0x8e5fc0, 0x2a9d8f, 0xf2f0e6];
var PED_SKIN = [0xf2c79b, 0xc98d5e, 0x8a5a33, 0x6e4525, 0xffdbb4];

var Pedestrians = {
  // A low-poly person: legs and arms swing from pivots while walking.
  makePed: function () {
    var group = new THREE.Group();
    var shirt = new THREE.MeshLambertMaterial({ color: pick(PED_SHIRTS) });
    var skin = new THREE.MeshLambertMaterial({ color: pick(PED_SKIN) });
    var pants = new THREE.MeshLambertMaterial({ color: pick([0x2c3550, 0x4a3b2c, 0x222222, 0x5e6e7e]) });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.66, 0.3), shirt);
    torso.position.y = 1.12;
    group.add(torso);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.3), skin);
    head.position.y = 1.66;
    group.add(head);
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
    limbs.armL = limb(shirt, 0.13, 0.6, -0.34, 1.4);
    limbs.armR = limb(shirt, 0.13, 0.6, 0.34, 1.4);
    limbs.legL = limb(pants, 0.16, 0.78, -0.14, 0.8);
    limbs.legR = limb(pants, 0.16, 0.78, 0.14, 0.8);
    G.scene.add(group);
    return {
      group: group, limbs: limbs, health: 50, dead: false,
      state: 'walk', waypoint: null, speed: rand(1.1, 1.9),
      walkPhase: rand(0, 6), fleeT: 0, fearX: 0, fearZ: 0, fallT: 0,
    };
  },

  // Sidewalk loop around a block centre, or a stretch of the promenade.
  newWaypoint: function (ped) {
    if (chance(0.22)) { // promenade stroll
      return { x: CFG.BEACH_X + rand(2, 10), z: rand(-200, 200) };
    }
    var cx = rand(-195, 195), cz = rand(-195, 195);
    // Snap to the nearest sidewalk ring: offset to a block edge.
    var ring = 30;
    var side = randInt(0, 3);
    var along = rand(-ring, ring);
    var bx = Math.round((cx + 32) / 64) * 64 - 32, bz = Math.round((cz + 32) / 64) * 64 - 32;
    if (side === 0) return { x: bx + along, z: bz - ring };
    if (side === 1) return { x: bx + along, z: bz + ring };
    if (side === 2) return { x: bx - ring, z: bz + along };
    return { x: bx + ring, z: bz + along };
  },

  spawn: function (count) {
    for (var i = 0; i < count; i++) {
      var ped = this.makePed();
      var wp = this.newWaypoint(ped);
      ped.group.position.set(wp.x + rand(-6, 6), 0, wp.z + rand(-6, 6));
      ped.waypoint = this.newWaypoint(ped);
      G.peds.push(ped);
    }
  },

  scare: function (x, z, radius) {
    for (var i = 0; i < G.peds.length; i++) {
      var p = G.peds[i];
      if (p.dead) continue;
      if (dist2D(p.group.position.x, p.group.position.z, x, z) < radius) {
        p.state = 'flee'; p.fleeT = rand(2, 3.6);
        p.fearX = x; p.fearZ = z;
      }
    }
  },

  hurt: function (ped, dmg, cause) {
    if (ped.dead) return;
    ped.health -= dmg;
    if (ped.health <= 0) {
      ped.dead = true; ped.fallT = 0;
      this.scare(ped.group.position.x, ped.group.position.z, 16);
      if (cause === 'player') Wanted.addHeat(CFG.HEAT_KILL, ped.group.position.x, ped.group.position.z);
    } else {
      ped.state = 'flee'; ped.fleeT = 2.4;
      ped.fearX = G.player.group.position.x; ped.fearZ = G.player.group.position.z;
      if (cause === 'player') Wanted.addHeat(CFG.HEAT_HIT_PED * 0.5, ped.group.position.x, ped.group.position.z);
    }
  },

  update: function (dt) {
    for (var i = 0; i < G.peds.length; i++) {
      var p = G.peds[i];
      var pos = p.group.position;
      if (p.dead) {
        if (p.fallT < 1) { p.fallT += dt * 2.4; p.group.rotation.x = -Math.PI / 2 * Math.min(1, p.fallT); p.group.position.y = 0.12; }
        continue;
      }
      var speed = p.speed, tx, tz;
      if (p.state === 'flee') {
        p.fleeT -= dt;
        if (p.fleeT <= 0) { p.state = 'walk'; p.waypoint = this.newWaypoint(p); }
        var dx = pos.x - p.fearX, dz = pos.z - p.fearZ;
        var d = Math.sqrt(dx * dx + dz * dz) || 1;
        tx = pos.x + dx / d * 10; tz = pos.z + dz / d * 10;
        speed = 4.6;
      } else {
        if (!p.waypoint || dist2D(pos.x, pos.z, p.waypoint.x, p.waypoint.z) < 1.6) p.waypoint = this.newWaypoint(p);
        tx = p.waypoint.x; tz = p.waypoint.z;
      }
      var mx = tx - pos.x, mz = tz - pos.z;
      var md = Math.sqrt(mx * mx + mz * mz) || 1;
      var nx = pos.x + mx / md * speed * dt, nz = pos.z + mz / md * speed * dt;
      var fixed = collideBuildings(nx, nz, 0.4);
      pos.x = clamp(fixed[0], CFG.CITY_MIN - 6, CFG.WATER_X - 2);
      pos.z = clamp(fixed[1], -215, 215);
      p.group.rotation.y = angleLerp(p.group.rotation.y, Math.atan2(mx, mz), clamp(dt * 8, 0, 1));
      p.walkPhase += dt * speed * 3.4;
      var sw = Math.sin(p.walkPhase) * (p.state === 'flee' ? 0.75 : 0.5);
      p.limbs.legL.rotation.x = sw; p.limbs.legR.rotation.x = -sw;
      p.limbs.armL.rotation.x = -sw * 0.8; p.limbs.armR.rotation.x = sw * 0.8;
      if (p.state === 'flee') { p.limbs.armL.rotation.x = -2.6; p.limbs.armR.rotation.x = -2.6; }
    }
  },
};
