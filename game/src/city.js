// Del Sol City — city.js
// Builds the whole static world into the scene: a sun-soaked coastal grid of
// roads and sidewalks, procedurally textured buildings with lit windows, palm
// trees, street lamps, a beach, animated water and the marina pier. Building
// footprints are registered as AABB colliders for the player and traffic.

var City = {
  water: null,
  sunLight: null,
  lampHeads: [],

  // A facade texture drawn on a canvas: stucco wall, a grid of windows, some
  // lit warm, some dark glass. A few hues give the blocks variety for free.
  facadeTexture: function (base, litRatio) {
    var c = document.createElement('canvas'); c.width = 128; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 128, 256);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 246, 128, 10);
    for (var y = 0; y < 10; y++) for (var x = 0; x < 5; x++) {
      var lit = RNG() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : 'rgba(38,52,66,0.9)';
      g.fillRect(10 + x * 23, 12 + y * 24, 15, 15);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(10 + x * 23, 12 + y * 24, 15, 4);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  },

  roadTexture: function () {
    var c = document.createElement('canvas'); c.width = 128; c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = '#33373c'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#3a3f45'; g.fillRect(0, 0, 128, 6); g.fillRect(0, 122, 128, 6);
    g.fillStyle = '#e8c95a';
    g.fillRect(60, 8, 8, 44); g.fillRect(60, 76, 8, 44); // centre dashes along V
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  },

  build: function (scene) {
    // Sky, light and atmosphere: late-afternoon sun over the ocean.
    scene.background = new THREE.Color(0x8ec9e8);
    scene.fog = new THREE.Fog(0xf2c99a, 190, 620);
    var hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a6f4d, 0.85);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffe3b3, 1.6);
    sun.position.set(160, 190, 60);
    scene.add(sun);
    this.sunLight = sun;
    var fill = new THREE.DirectionalLight(0x9db8ff, 0.3);
    fill.position.set(-120, 80, -140);
    scene.add(fill);

    // Base ground (under everything) and the city slab.
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshLambertMaterial({ color: 0x9c8a6d }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05;
    scene.add(ground);

    this.buildRoads(scene);
    this.buildBlocks(scene);
    this.buildBeach(scene);
    this.buildMarina(scene);
    this.buildPalmsAndLamps(scene);
  },

  setSunset: function () {
    // Used by the wide screenshot and late story beats: low orange sun.
    G.scene.background = new THREE.Color(0xf7a55c);
    G.scene.fog.color = new THREE.Color(0xf7b06a);
    this.sunLight.color = new THREE.Color(0xff9a3c);
    this.sunLight.position.set(320, 42, 40);
  },

  buildRoads: function (scene) {
    var tex = this.roadTexture();
    var mat = new THREE.MeshLambertMaterial({ map: tex });
    var i, r;
    for (i = 0; i < CFG.ROADS.length; i++) {
      r = CFG.ROADS[i];
      var hTex = tex.clone(); hTex.needsUpdate = true; hTex.repeat.set(30, 1);
      var h = new THREE.Mesh(new THREE.PlaneGeometry(452, CFG.ROAD_W),
        new THREE.MeshLambertMaterial({ map: hTex }));
      h.rotation.x = -Math.PI / 2; h.rotation.z = Math.PI / 2;
      h.position.set(0, 0.02, r);
      scene.add(h);
      var vTex = tex.clone(); vTex.needsUpdate = true; vTex.repeat.set(30, 1);
      var v = new THREE.Mesh(new THREE.PlaneGeometry(452, CFG.ROAD_W),
        new THREE.MeshLambertMaterial({ map: vTex }));
      v.rotation.x = -Math.PI / 2;
      v.position.set(r, 0.021, 0);
      scene.add(v);
    }
    // One cross-town boulevard to the beach, so the marina is reachable.
    var bTex = tex.clone(); bTex.needsUpdate = true; bTex.repeat.set(10, 1);
    var b = new THREE.Mesh(new THREE.PlaneGeometry(120, CFG.ROAD_W),
      new THREE.MeshLambertMaterial({ map: bTex }));
    b.rotation.x = -Math.PI / 2; b.rotation.z = Math.PI / 2;
    b.position.set(268, 0.02, 0);
    scene.add(b);
  },

  buildBlocks: function (scene) {
    var palettes = [
      ['#e8dcc8', '#d9c6a5', '#cfe0e8'], ['#e6b98a', '#d98e6a', '#f0e0c0'],
      ['#bcd6e2', '#9fb8cc', '#e8e2d2'], ['#f0e6da', '#e0cfae', '#c9d4da'],
    ];
    var sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xb9b0a0 });
    var centers = [];
    for (var i = 0; i < CFG.ROADS.length - 1; i++)
      centers.push((CFG.ROADS[i] + CFG.ROADS[i + 1]) / 2);
    for (var bx = 0; bx < centers.length; bx++) for (var bz = 0; bz < centers.length; bz++) {
      var cx = centers[bx], cz = centers[bz];
      var slab = new THREE.Mesh(new THREE.BoxGeometry(CFG.BLOCK + 6, 0.3, CFG.BLOCK + 6), sidewalkMat);
      slab.position.set(cx, 0.15, cz);
      scene.add(slab);
      // 1–4 buildings per block, leaving a plaza corner on some blocks.
      var plots = [[-13, -13], [13, -13], [-13, 13], [13, 13]];
      var n = randInt(2, 4);
      var pal = pick(palettes);
      for (var k = 0; k < n; k++) {
        var px = cx + plots[k][0], pz = cz + plots[k][1];
        var w = rand(15, 21), d = rand(15, 21), hgt = rand(14, 52);
        if (chance(0.12)) hgt = rand(55, 78); // the odd tower
        var tex = this.facadeTexture(pick(pal), 0.34);
        tex.repeat.set(Math.max(1, Math.round(w / 11)), Math.max(1, Math.round(hgt / 22)));
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        var b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d),
          new THREE.MeshLambertMaterial({ map: tex, emissive: 0x664d22, emissiveIntensity: 0.35, emissiveMap: tex }));
        b.position.set(px, 0.3 + hgt / 2, pz);
        scene.add(b);
        // Roof cap + a water tank or AC box for silhouette variety.
        var cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 1.6, d * 0.5),
          new THREE.MeshLambertMaterial({ color: 0x8d8578 }));
        cap.position.set(px, 0.3 + hgt + 0.8, pz);
        scene.add(cap);
        G.colliders.push({ minX: px - w / 2, maxX: px + w / 2, minZ: pz - d / 2, maxZ: pz + d / 2 });
      }
    }
  },

  buildBeach: function (scene) {
    var sand = new THREE.Mesh(new THREE.PlaneGeometry(70, 700),
      new THREE.MeshLambertMaterial({ color: 0xeed9a4 }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(CFG.BEACH_X + 32, 0.01, 0);
    scene.add(sand);
    var waterMat = new THREE.MeshPhongMaterial({
      color: 0x1d7f9e, shininess: 120, transparent: true, opacity: 0.92,
    });
    var water = new THREE.Mesh(new THREE.PlaneGeometry(700, 1400), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(CFG.WATER_X + 340, 0.12, 0);
    scene.add(water);
    this.water = water;
    // Foam line where the sea meets the sand.
    var foam = new THREE.Mesh(new THREE.PlaneGeometry(3, 700),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(CFG.WATER_X + 1, 0.14, 0);
    scene.add(foam);
    this.foam = foam;
  },

  buildMarina: function (scene) {
    // A wooden pier reaching into the water at the end of the boulevard,
    // with moored boats: the story's final destination.
    var wood = new THREE.MeshLambertMaterial({ color: 0x8a6844 });
    var pier = new THREE.Mesh(new THREE.BoxGeometry(90, 1.2, 10), wood);
    pier.position.set(300, 0.7, 0);
    scene.add(pier);
    for (var i = 0; i < 7; i++) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3), wood);
      post.position.set(262 + i * 13, -0.4, 4.4);
      scene.add(post);
      var post2 = post.clone(); post2.position.z = -4.4; scene.add(post2);
    }
    var hullCols = [0xe8e4da, 0xc94f4f, 0x4f7fc9, 0x53b06a];
    for (var bIdx = 0; bIdx < 5; bIdx++) {
      var boat = new THREE.Group();
      var hull = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 2.6),
        new THREE.MeshLambertMaterial({ color: pick(hullCols) }));
      hull.position.y = 0.6;
      boat.add(hull);
      var cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 2),
        new THREE.MeshLambertMaterial({ color: 0xf2efe8 }));
      cabin.position.set(-0.4, 1.9, 0);
      boat.add(cabin);
      var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 7),
        new THREE.MeshLambertMaterial({ color: 0x777777 }));
      mast.position.set(1.4, 4.4, 0);
      boat.add(mast);
      boat.position.set(282 + bIdx * 13, 0.15, (bIdx % 2 === 0 ? 11 : -11));
      boat.rotation.y = (bIdx % 2 === 0 ? 0.06 : -0.06);
      scene.add(boat);
    }
  },

  buildPalmsAndLamps: function (scene) {
    var trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
    var leafMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d, side: THREE.DoubleSide });
    var trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 6.4, 6);
    var leafGeo = new THREE.PlaneGeometry(3.6, 0.9);
    var spots = [];
    // Palms line the beach promenade and sprinkle the sidewalks.
    for (var z = -200; z <= 200; z += 24) spots.push([CFG.BEACH_X + 6, z + rand(-2, 2)]);
    for (var i = 0; i < 30; i++) spots.push([pick(CFG.ROADS) + rand(-4, 4), rand(-205, 205)]);
    for (i = 0; i < spots.length; i++) {
      var palm = new THREE.Group();
      var trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 3.2; trunk.rotation.z = rand(-0.06, 0.06);
      palm.add(trunk);
      for (var l = 0; l < 6; l++) {
        var leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.y = 6.5;
        leaf.rotation.y = (l / 6) * Math.PI * 2;
        leaf.rotation.z = 0.7;
        leaf.translateX(1.5);
        palm.add(leaf);
      }
      palm.position.set(spots[i][0], 0, spots[i][1]);
      scene.add(palm);
    }
    // Street lamps along every road: emissive heads the night would light.
    var poleMat = new THREE.MeshLambertMaterial({ color: 0x3c4147 });
    var headMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
    var poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 5.6, 5);
    var headGeo = new THREE.SphereGeometry(0.32, 8, 6);
    for (i = 0; i < CFG.ROADS.length; i++) {
      for (var s = -192; s <= 192; s += 96) {
        for (var side = -1; side <= 1; side += 2) {
          var lamp = new THREE.Group();
          var pole = new THREE.Mesh(poleGeo, poleMat); pole.position.y = 2.8; lamp.add(pole);
          var head = new THREE.Mesh(headGeo, headMat); head.position.y = 5.7; lamp.add(head);
          lamp.position.set(CFG.ROADS[i] + side * 8.2, 0, s + (side > 0 ? 24 : 0));
          scene.add(lamp);
          var lamp2 = lamp.clone();
          lamp2.position.set(s + (side > 0 ? 24 : 0), 0, CFG.ROADS[i] + side * 8.2);
          scene.add(lamp2);
        }
      }
    }
  },

  // Gentle water shimmer and foam pulse, called from the main loop.
  update: function (t) {
    if (this.water) this.water.position.y = 0.12 + Math.sin(t * 0.8) * 0.05;
    if (this.foam) this.foam.material.opacity = 0.4 + Math.sin(t * 1.7) * 0.18;
  },
};
