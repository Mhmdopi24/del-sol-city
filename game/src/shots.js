// Del Sol City — shots.js
// Staged, deterministic scenes for the entry's screenshots, selected with
// ?shot=1..4. Each shot reseeds the world (main.js uses the same seed), puts
// Mara, traffic and the police in composed positions, sets the HUD state the
// scene needs, and parks the camera — the game then renders the scene live,
// so a screenshot is a real frame of the game, never a composite.

var Shots = {
  setup: function (n) {
    G.shotMode = n;
    document.getElementById('startscreen').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    G.started = true;

    if (n === 1) {
      // On foot in the city centre, first job on the board.
      G.mode = 'foot';
      G.player.group.position.set(3, 0, 2);
      G.player.yaw = Math.PI / 2;
      G.camYaw = Math.PI / 2; G.camPitch = 0.3;
      G.missionIndex = 0;
      Missions.pointAt(DEPOT.x, DEPOT.z);
      HUD.setObjective('Go to the gold marker at the depot to take a job');
      G.cash = 40;
    }

    if (n === 2) {
      // Mid-chase: Mara in a coral coupe, three stars, two units on her tail.
      var car = Vehicles.makeCar('traffic', 0xc94f6d);
      Vehicles.placeCar(car, 0, -96, 0);
      car.speed = 17;
      G.cars.push(car);
      Player.enterCarSilent(car);
      G.wantedHeat = 3; Wanted.syncStars();
      G.unseenTime = 0;
      for (var i = 0; i < 2; i++) {
        var cop = Vehicles.makeCar('police', 0xf2f2f2);
        Vehicles.placeCar(cop, -3.5 + i * 7.5, -110 - i * 9, 0.08 * (i ? -1 : 1));
        cop.speed = 16;
        G.cops.push({ car: cop, stuckT: 0, lastX: 0, lastZ: 0 });
      }
      G.camYaw = Math.PI; G.camPitch = 0.24;
      G.cash = 590;
      HUD.setObjective('Lose the police — break line of sight and let the heat die');
      G.mission = { def: MISSIONS[3] };
      Missions.stepIndex = 0;
      Missions.hideMarker();
    }

    if (n === 3) {
      // A mission moment: Mara pulls up at the marina delivery marker while
      // Felix talks her in.
      var car3 = Vehicles.makeCar('traffic', 0x3f6fd8);
      Vehicles.placeCar(car3, 228, 3.5, Math.PI / 2);
      car3.speed = 0;
      G.cars.push(car3);
      Player.enterCarSilent(car3);
      G.camYaw = Math.PI / 2 - 0.4; G.camPitch = 0.3;
      G.missionIndex = 1;
      G.mission = { def: MISSIONS[1] };
      Missions.stepIndex = 1;
      Missions.pointAt(236, 0);
      Missions.stepTimer = 47; // mid-delivery countdown, shown by the HUD
      HUD.setObjective('Get the package to the marina before the buyer leaves');
      Missions.say([['Felix', 'Buyer is on the pier, Mara. Thirty seconds of patience left in him.']]);
      G.cash = 450;
    }

    if (n === 4) {
      // The wide one: sunset over the whole grid from the beach boulevard.
      City.setSunset();
      var car4 = Vehicles.makeCar('traffic', 0xf0a832);
      Vehicles.placeCar(car4, 224, 30, -Math.PI / 2 - 0.35);
      car4.speed = 0;
      G.cars.push(car4);
      Player.enterCarSilent(car4);
      G.camYaw = -Math.PI / 2 + 0.3; G.camPitch = 0.6;
      G.camDistOverride = 30; // pulled-back establishing shot of the whole grid
      G.cash = 1340;
      G.storyDone = true;
      Missions.hideMarker();
      HUD.setObjective('Story complete — Del Sol City is yours. Free roam!');
    }

    HUD.renderCash();
    HUD.renderStars();
  },
};
