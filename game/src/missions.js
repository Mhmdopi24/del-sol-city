// Del Sol City — missions.js
// The story of Mara Vale, a driver-for-hire who takes one job too many.
// Five chained missions: a package pickup, a timed hot delivery, a checkpoint
// race across the grid, shaking a three-star tail, and a final run to the
// marina. Between missions a gold beacon marks the next job at the depot;
// walking or driving into a beacon starts the mission, and each step points
// the player at the next marker with dialogue and an objective line.

var DEPOT = { x: 10, z: -56 }; // Mara's lockup, where every job begins.

var MISSIONS = [
  {
    title: 'First Fare',
    reward: 150,
    intro: [
      ['Mara', 'One car, no questions, cash up front. That was the deal I made with myself.'],
      ['Felix', 'Mara? Felix. I left a package at the Solano parking court. Bring it to the depot, no stops.'],
    ],
    steps: [
      { kind: 'goto', x: 122, z: 58, text: 'Pick up the package at the Solano parking court', done: [['Felix', 'Got it? Good. Now bring it home.']] },
      { kind: 'goto', x: DEPOT.x, z: DEPOT.z, text: 'Deliver the package to the depot', done: [['Felix', 'Clean work. There may be more where that came from.']] },
    ],
  },
  {
    title: 'Hot Package',
    reward: 300,
    intro: [
      ['Felix', 'Same again, but this one is warm. The marina buyer leaves in two minutes.'],
      ['Mara', 'Warm how? ...You know what, do not answer that.'],
    ],
    steps: [
      { kind: 'goto', x: -58, z: 122, text: 'Collect the warm package from the north-west block', heat: 2, done: [['Mara', 'It is ticking. It is actually ticking.']] },
      { kind: 'goto', x: 236, z: 0, timer: 110, text: 'Get the package to the marina before the buyer leaves', done: [['Buyer', 'You cut that fine, Vale. Felix pays well for fine.']] },
    ],
  },
  {
    title: 'Harbour Run',
    reward: 400,
    intro: [
      ['Felix', 'A sponsor wants proof you can drive this city blindfold. Five gates, one clock.'],
      ['Mara', 'Tell the sponsor to keep the envelope open.'],
    ],
    steps: [
      { kind: 'race', points: [[128, -128], [192, 0], [64, 128], [-64, 64], [-160, -32]], timer: 130, text: 'Hit every checkpoint before the clock runs out', done: [['Felix', 'The sponsor is impressed. So am I, a little.']] },
    ],
  },
  {
    title: 'Heat',
    reward: 500,
    intro: [
      ['Felix', 'Small problem. The last package had an owner, and the owner has friends in uniform.'],
      ['Mara', 'Three stars of friends, Felix. Lose them myself, as usual.'],
    ],
    steps: [
      { kind: 'escape', heat: 3, text: 'Lose the police — break line of sight and let the heat die', done: [['Mara', 'Gone. Next time, Felix, we check the package first.']] },
    ],
  },
  {
    title: 'The Last Run',
    reward: 750,
    intro: [
      ['Felix', 'Last job. Take my boat money to the marina, and take the long way. You are done after this.'],
      ['Mara', 'Done. A beach, a boat, and no more ticking packages.'],
    ],
    steps: [
      { kind: 'goto', x: 300, z: 0, heat: 2, text: 'Make the final run to the end of the marina pier', done: [['Mara', 'Del Sol City. You never did own me.'], ['Felix', 'Pleasure doing business, Vale. Stay out of the papers.']] },
    ],
  },
];

var Missions = {
  marker: null, ring: null,
  dialogueQueue: [], dialogueT: 0,
  stepIndex: 0, stepTimer: null, raceIndex: 0,
  failed: false,

  init: function () {
    var geo = new THREE.CylinderGeometry(2.2, 2.2, 26, 20, 1, true);
    var mat = new THREE.MeshBasicMaterial({
      color: 0xffc93c, transparent: true, opacity: 0.3,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.marker = new THREE.Mesh(geo, mat);
    this.marker.position.y = 13;
    var ringGeo = new THREE.RingGeometry(1.7, 2.2, 28);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.25;
    G.scene.add(this.marker);
    G.scene.add(this.ring);
    this.pointAt(DEPOT.x, DEPOT.z);
    if (!G.storyDone) HUD.setObjective('Go to the gold marker at the depot to take a job');
  },

  pointAt: function (x, z) {
    this.marker.position.x = x; this.marker.position.z = z;
    this.ring.position.x = x; this.ring.position.z = z;
    this.marker.visible = this.ring.visible = true;
  },

  hideMarker: function () { this.marker.visible = this.ring.visible = false; },

  currentTarget: function () {
    if (!G.mission) return G.storyDone ? null : DEPOT;
    var step = G.mission.def.steps[this.stepIndex];
    if (step.kind === 'race') return { x: step.points[this.raceIndex][0], z: step.points[this.raceIndex][1] };
    if (step.kind === 'escape') return null;
    return step;
  },

  say: function (lines) {
    for (var i = 0; i < (lines || []).length; i++) this.dialogueQueue.push(lines[i]);
    if (this.dialogueT <= 0 && this.dialogueQueue.length) this.nextLine();
  },

  nextLine: function () {
    var line = this.dialogueQueue.shift();
    if (!line) { HUD.hideDialogue(); this.dialogueT = 0; return; }
    HUD.showDialogue(line[0], line[1]);
    this.dialogueT = 3.6;
  },

  startMission: function () {
    var def = MISSIONS[G.missionIndex];
    G.mission = { def: def };
    this.stepIndex = 0;
    this.raceIndex = 0;
    this.failed = false;
    HUD.showBanner('Mission: ' + def.title, 'Reward $' + def.reward);
    this.say(def.intro);
    this.beginStep();
    AudioSys.pickup();
  },

  beginStep: function () {
    var step = G.mission.def.steps[this.stepIndex];
    this.stepTimer = step.timer || null;
    if (step.heat) { G.wantedHeat = Math.max(G.wantedHeat, step.heat); Wanted.syncStars(); }
    if (step.kind === 'escape') {
      this.hideMarker();
      HUD.setObjective(step.text);
    } else {
      var t = this.currentTarget();
      this.pointAt(t.x, t.z);
      HUD.setObjective(step.text);
    }
    if (step.kind === 'race') HUD.setObjective(step.text + ' — gate 1 of ' + step.points.length);
  },

  completeStep: function () {
    var step = G.mission.def.steps[this.stepIndex];
    this.say(step.done);
    AudioSys.pickup();
    this.stepIndex++;
    if (this.stepIndex >= G.mission.def.steps.length) this.completeMission();
    else this.beginStep();
  },

  completeMission: function () {
    var def = G.mission.def;
    G.cash += def.reward;
    AudioSys.cash();
    HUD.showBanner('Mission complete', '+$' + def.reward);
    HUD.renderCash();
    G.mission = null;
    G.missionIndex++;
    if (G.missionIndex >= MISSIONS.length) {
      G.storyDone = true;
      this.hideMarker();
      HUD.setObjective('Story complete — Del Sol City is yours. Free roam!');
      this.say([['Mara', 'Five jobs, one boat, zero regrets. Time to just drive.']]);
    } else {
      this.pointAt(DEPOT.x, DEPOT.z);
      HUD.setObjective('Return to the depot marker for the next job: ' + MISSIONS[G.missionIndex].title);
    }
    SaveGame.write();
  },

  failMission: function (why) {
    HUD.showBanner('Mission failed', why);
    AudioSys.fail();
    G.mission = null;
    this.pointAt(DEPOT.x, DEPOT.z);
    HUD.setObjective('Job blown. Return to the depot marker to try again: ' + MISSIONS[G.missionIndex].title);
  },

  onEnterCar: function (car) {
    // Story flavour: the first steal gets a line from Mara.
    if (!this._firstSteal) {
      this._firstSteal = true;
      this.say([['Mara', 'Sorry, friend. Driver-for-hire business. I will bring it back washed.']]);
    }
  },

  update: function (dt) {
    // Dialogue pacing.
    if (this.dialogueT > 0) {
      this.dialogueT -= dt;
      if (this.dialogueT <= 0) this.nextLine();
    }
    // Marker shimmer.
    if (this.marker && this.marker.visible) {
      this.ring.rotation.z += dt * 1.4;
      this.marker.material.opacity = 0.24 + Math.sin(G.elapsed * 2.6) * 0.08;
    }
    if (G.mode !== 'foot' && G.mode !== 'car') return;
    var p = Player.pos();

    if (!G.mission) {
      if (!G.storyDone && dist2D(p.x, p.z, DEPOT.x, DEPOT.z) < 4.5) this.startMission();
      return;
    }
    var step = G.mission.def.steps[this.stepIndex];
    if (this.stepTimer !== null) {
      this.stepTimer -= dt;
      HUD.setTimer(this.stepTimer);
      if (this.stepTimer <= 0) { HUD.setTimer(null); this.failMission('Out of time.'); return; }
    } else HUD.setTimer(null);

    if (step.kind === 'escape') {
      if (G.wantedStars === 0 && G.unseenTime > 1) { this.completeStep(); }
      return;
    }
    var t = this.currentTarget();
    if (t && dist2D(p.x, p.z, t.x, t.z) < 5) {
      if (step.kind === 'race') {
        AudioSys.pickup();
        this.raceIndex++;
        if (this.raceIndex >= step.points.length) { HUD.setTimer(null); this.completeStep(); }
        else {
          var nt = this.currentTarget();
          this.pointAt(nt.x, nt.z);
          HUD.setObjective(step.text + ' — gate ' + (this.raceIndex + 1) + ' of ' + step.points.length);
        }
      } else this.completeStep();
    }
  },
};
