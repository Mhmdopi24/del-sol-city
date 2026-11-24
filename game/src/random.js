// Del Sol City — random.js
// A tiny seeded RNG (mulberry32) so the city, traffic and the staged
// screenshot scenes are identical on every load. Gameplay code uses RNG for
// world generation and Math.random only for cosmetic jitter.

// The active generator; reseeded by seedRandom() before world generation.
var _rngState = 1337;

function seedRandom(seed) { _rngState = seed >>> 0; }

function RNG() {
  _rngState = (_rngState + 0x6D2B79F5) >>> 0;
  var t = _rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Random float in [lo, hi).
function rand(lo, hi) { return lo + RNG() * (hi - lo); }
// Random integer in [lo, hi] inclusive.
function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
// Random element of an array.
function pick(arr) { return arr[Math.floor(RNG() * arr.length)]; }
// True with probability p.
function chance(p) { return RNG() < p; }
