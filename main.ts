// Del Sol City — main.ts, the hand-in program for make.fun's gta6-01 bounty.
//
// The game itself is the static site in game/ beside this file: an original
// open-world crime game (a procedural coastal city, traffic and pedestrians,
// stealable cars, a wanted level with police chases, gunplay, a five-mission
// story about driver-for-hire Mara Vale, a HUD with a live minimap, and a
// localStorage save), written as plain classic scripts over a vendored
// three.js build, loading nothing from the network.
//
// This program hands it in: it copies game/ and screenshots/ from beside this
// file into the output directory (MAKEFUN_OUTPUT_DIR locally, /output in the
// grader), writes a small build-info.json naming the game and version, and
// writes dossier.json with buildDossier from the vendored make.fun library,
// using this bounty's scorer caps so the program refuses exactly what the
// scorer would refuse. Node 22, standard library only, deterministic: the
// same repository produces the same bytes on every run.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const GAME_TITLE = 'Del Sol City';
const GAME_VERSION = '1.0.0';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Build info for anyone unpacking the entry: what this is, in one glance.
writeFileSync(
  join(out, 'build-info.json'),
  JSON.stringify(
    {
      title: GAME_TITLE,
      version: GAME_VERSION,
      competition: 'gta6-01',
      engine: 'three.js (vendored, game/vendor/three.min.js)',
      entrypoint: 'game/index.html',
      screenshots: ['1-cover.jpg', '2-chase.jpg', '3-mission.jpg', '4-city.jpg'],
    },
    null,
    2,
  ) + '\n',
);

// The dossier the judge reads, byte for byte what the scorer recomputes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
