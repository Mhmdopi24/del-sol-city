// Del Sol City — save.js
// Persists the run to localStorage: cash, mission progress, story completion,
// health and where Mara is standing (and in which car she is not — she always
// reloads on foot next to it). The start screen's Continue button reads this.

var SaveGame = {
  exists: function () {
    try { return !!localStorage.getItem(CFG.SAVE_KEY); } catch (e) { return false; }
  },

  write: function () {
    try {
      var p = G.player.group.position;
      localStorage.setItem(CFG.SAVE_KEY, JSON.stringify({
        cash: G.cash,
        missionIndex: G.missionIndex,
        storyDone: G.storyDone,
        health: Math.round(G.health),
        x: Math.round(p.x * 10) / 10,
        z: Math.round(p.z * 10) / 10,
        yaw: Math.round(G.player.yaw * 100) / 100,
        version: CFG.VERSION,
      }));
    } catch (e) { /* private mode etc.: saving is best-effort */ }
  },

  read: function () {
    try {
      var raw = localStorage.getItem(CFG.SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },

  apply: function (data) {
    if (!data) return false;
    G.cash = data.cash || 0;
    G.missionIndex = data.missionIndex || 0;
    G.storyDone = !!data.storyDone;
    G.health = clamp(data.health || CFG.PLAYER_MAX_HEALTH, 10, CFG.PLAYER_MAX_HEALTH);
    G.player.group.position.set(data.x || -6, 0, data.z || 10);
    G.player.yaw = data.yaw || Math.PI;
    G.camYaw = G.player.yaw;
    HUD.renderCash();
    if (G.storyDone) {
      Missions.hideMarker();
      HUD.setObjective('Story complete — Del Sol City is yours. Free roam!');
    } else {
      Missions.pointAt(DEPOT.x, DEPOT.z);
      HUD.setObjective('Return to the depot marker for the next job: ' + MISSIONS[G.missionIndex].title);
    }
    return true;
  },

  clear: function () {
    try { localStorage.removeItem(CFG.SAVE_KEY); } catch (e) {}
  },
};
