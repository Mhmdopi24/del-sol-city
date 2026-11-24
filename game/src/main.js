// Del Sol City — main.js
// Boot and the main loop. Builds the renderer and the world in a fixed order
// (seeded, so every load makes the same city), wires keyboard/mouse input and
// the start/pause/end screens, then ticks every system once per frame:
// traffic, pedestrians, the player, police, combat, missions, HUD, water.

(function () {
  var params = new URLSearchParams(location.search);
  var shot = parseInt(params.get('shot') || '0', 10) || 0;

  function boot() {
    seedRandom(20261117); // the city is the same on every visit
    G.scene = new THREE.Scene();
    G.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1500);
    G.renderer = new THREE.WebGLRenderer({ antialias: true });
    G.renderer.setSize(innerWidth, innerHeight);
    G.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    document.getElementById('game').appendChild(G.renderer.domElement);
    G.clock = new THREE.Clock();

    City.build(G.scene);
    Player.build();
    Vehicles.spawnTraffic(15);
    Vehicles.spawnParked(13);
    Pedestrians.spawn(30);
    Combat.init();
    HUD.init();
    Missions.init();

    wireInput();
    wireScreens();

    if (shot >= 1 && shot <= 4) Shots.setup(shot);
    else if (SaveGame.exists()) document.getElementById('continueBtn').style.display = 'inline-block';

    G.renderer.setAnimationLoop(tick);
  }

  function wireInput() {
    addEventListener('keydown', function (e) {
      G.keys[e.code] = true;
      if (e.code === 'KeyM') { G.muted = !G.muted; AudioSys.setMuted(G.muted); }
      if (e.code === 'Escape' && (G.mode === 'foot' || G.mode === 'car')) pauseGame();
      else if (e.code === 'Escape' && G.mode === 'paused') resumeGame();
      if (['ArrowUp', 'ArrowDown', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    });
    addEventListener('keyup', function (e) { G.keys[e.code] = false; });
    addEventListener('mousemove', function (e) {
      if (G.pointerLocked) { G.mouseDX += e.movementX || 0; G.mouseDY += e.movementY || 0; }
    });
    addEventListener('mousedown', function (e) { if (e.button === 0) G.mouseDown = true; });
    addEventListener('mouseup', function (e) { if (e.button === 0) G.mouseDown = false; });
    document.addEventListener('pointerlockchange', function () {
      G.pointerLocked = document.pointerLockElement === G.renderer.domElement;
    });
    G.renderer.domElement.addEventListener('click', function () {
      AudioSys.init(); AudioSys.resume();
      if (G.started && (G.mode === 'foot' || G.mode === 'car') && !G.pointerLocked && !G.shotMode) {
        G.renderer.domElement.requestPointerLock();
      }
    });
    addEventListener('resize', function () {
      G.camera.aspect = innerWidth / innerHeight;
      G.camera.updateProjectionMatrix();
      G.renderer.setSize(innerWidth, innerHeight);
    });
    addEventListener('beforeunload', function () { if (G.started) SaveGame.write(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && G.started) SaveGame.write();
    });
  }

  function wireScreens() {
    document.getElementById('startBtn').addEventListener('click', function () {
      AudioSys.init(); AudioSys.resume();
      SaveGame.clear();
      startGame(false);
    });
    document.getElementById('continueBtn').addEventListener('click', function () {
      AudioSys.init(); AudioSys.resume();
      startGame(true);
    });
    document.getElementById('resumeBtn').addEventListener('click', resumeGame);
    document.getElementById('respawnBtn').addEventListener('click', function () {
      Player.respawn();
    });
  }

  function startGame(fromSave) {
    document.getElementById('startscreen').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    G.started = true;
    G.mode = 'foot';
    if (fromSave) SaveGame.apply(SaveGame.read());
    else {
      HUD.setObjective('Go to the gold marker at the depot to take a job');
      Missions.say([
        ['Mara', 'Del Sol City. Six years driving other people\'s problems around it.'],
        ['Mara', 'Rent is due, the tank is empty, and Felix always calls when both are true.'],
      ]);
    }
    if (!G.shotMode) G.renderer.domElement.requestPointerLock();
  }

  function pauseGame() {
    G.prevMode = G.mode;
    G.mode = 'paused';
    document.getElementById('pausescreen').style.display = 'flex';
    if (document.exitPointerLock) document.exitPointerLock();
    SaveGame.write();
  }

  function resumeGame() {
    document.getElementById('pausescreen').style.display = 'none';
    G.mode = G.prevMode === 'car' ? 'car' : 'foot';
    if (!G.shotMode) G.renderer.domElement.requestPointerLock();
  }

  var saveT = 0;
  var shotFrames = 0;
  function tick() {
    // Screenshot scenes render a fixed run of frames then hold the last one,
    // so a headless capture finishes quickly instead of simulating forever.
    if (G.shotMode && ++shotFrames > 150) { G.renderer.setAnimationLoop(null); return; }
    var dt = Math.min(G.clock.getDelta(), 0.05);
    if (G.mode === 'paused' || G.mode === 'menu') {
      // The menu idles over a slow pan of the city so the title sits on life.
      if (G.mode === 'menu') {
        var t = performance.now() * 0.00004;
        G.camera.position.set(Math.sin(t) * 150, 42, Math.cos(t) * 150);
        G.camera.lookAt(0, 6, 0);
      }
      G.renderer.render(G.scene, G.camera);
      return;
    }
    G.elapsed += dt;
    if (G.mode === 'foot') Player.updateFoot(dt);
    else if (G.mode === 'car') Player.updateCar(dt);
    if (G.mode === 'foot' || G.mode === 'car') {
      Vehicles.updateTraffic(dt);
      Pedestrians.update(dt);
      Police.update(dt);
      Wanted.update(dt);
      Combat.tryShoot(dt);
      Combat.updateCollisions(dt);
      Missions.update(dt);
      City.update(G.elapsed);
      HUD.update(dt);
      saveT += dt;
      if (saveT > 6) { saveT = 0; SaveGame.write(); }
    } else {
      // Busted/wasted: let the world drift on behind the end screen.
      Vehicles.updateTraffic(dt);
      Pedestrians.update(dt);
      City.update(G.elapsed);
    }
    G.renderer.render(G.scene, G.camera);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
