// Del Sol City — config.js
// Shared game state and tuning constants. Every other file reads and writes the
// single global state object G defined here, so there is exactly one source of
// truth for the player, the city, the wanted level and the mission progress.

var CFG = {
  // City layout: roads run along these coordinates on both axes, which makes a
  // 7x7 intersection grid with 6x6 buildable blocks between them.
  ROADS: [-192, -128, -64, 0, 64, 128, 192],
  ROAD_W: 14,          // road width in metres
  BLOCK: 50,           // building block footprint between roads
  CITY_MIN: -210,
  CITY_MAX: 210,
  BEACH_X: 214,        // sand starts here, water just past it
  WATER_X: 262,
  WORLD_EDGE: 420,     // invisible wall for the player

  // Player
  WALK_SPEED: 5.2,
  SPRINT_SPEED: 9.0,
  PLAYER_RADIUS: 0.55,
  PLAYER_MAX_HEALTH: 100,

  // Driving
  CAR_ACCEL: 16,
  CAR_BRAKE: 26,
  CAR_REVERSE: 8,
  CAR_MAX_SPEED: 34,
  CAR_MAX_REVERSE: 10,
  CAR_TURN: 1.9,       // steering rate at low speed
  CAR_RADIUS: 2.1,

  // Wanted system: heat is a float, stars are ceil(heat) clamped to 0..5.
  HEAT_STEAL: 1.0,
  HEAT_HIT_CAR: 0.6,
  HEAT_HIT_PED: 1.2,
  HEAT_SHOT: 0.8,
  HEAT_KILL: 1.0,
  HEAT_DECAY_DELAY: 7, // seconds unseen before heat starts falling
  HEAT_DECAY_RATE: 0.16,

  // Police
  POLICE_SPEED: 30,
  BUSTED_RANGE: 5.5,
  BUSTED_TIME: 2.6,    // seconds in range at low speed before arrest

  SAVE_KEY: 'delsol-city-save-v1',
  VERSION: '1.0.0',
};

// The one global state object. Files attach their slices as the game boots.
var G = {
  mode: 'menu',        // menu | foot | car | paused | busted | wasted
  prevMode: 'foot',
  scene: null,
  camera: null,
  renderer: null,
  clock: null,
  elapsed: 0,
  keys: {},
  mouseDX: 0,
  mouseDY: 0,
  mouseDown: false,
  pointerLocked: false,
  shotMode: 0,         // 0 = normal play, 1..4 = staged screenshot scenes

  cash: 0,
  health: CFG.PLAYER_MAX_HEALTH,
  wantedHeat: 0,
  wantedStars: 0,
  unseenTime: 0,       // seconds since a witness last saw the player
  bustedMeter: 0,

  player: null,        // filled by player.js: { group, pos, yaw, speed... }
  currentCar: null,    // the car the player is driving, or null on foot
  cars: [],            // every vehicle (traffic, parked, police excluded)
  peds: [],
  cops: [],            // police units (cars with drivers abstracted)
  colliders: [],       // building AABBs {minX,maxX,minZ,maxZ}
  trafficLights: [],

  missionIndex: 0,     // next mission to offer
  mission: null,       // active mission runtime state
  storyDone: false,

  camYaw: 0,
  camPitch: 0.32,
  camDist: 8,

  muted: false,
  started: false,
};

// World helpers shared by several files.
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2D(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
function angleLerp(a, b, t) {
  var d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
// Push a circle (x,z,r) out of every building AABB; returns corrected [x,z].
function collideBuildings(x, z, r) {
  for (var i = 0; i < G.colliders.length; i++) {
    var b = G.colliders[i];
    var nx = clamp(x, b.minX, b.maxX), nz = clamp(z, b.minZ, b.maxZ);
    var dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) { var d = Math.sqrt(d2); x = nx + dx / d * r; z = nz + dz / d * r; }
      else { // centre inside the box: push out along the smallest penetration
        var pl = x - b.minX, pr = b.maxX - x, pt = z - b.minZ, pb = b.maxZ - z;
        var m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.minX - r; else if (m === pr) x = b.maxX + r;
        else if (m === pt) z = b.minZ - r; else z = b.maxZ + r;
      }
    }
  }
  return [x, z];
}
