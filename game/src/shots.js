// The screenshot scenes behind ?shot=start|play|end. Each returns a world state plus the screen
// to draw over it. The title scene plays the real rules forward from a fresh world for a few
// seconds (harmless mode: shards fall, nothing scores). The play and end scenes are curated: the
// world's object pools are filled by hand with a mid-game arrangement — a stack of shards over the
// ship, beams mid-climb, a power-up falling, the shield ring up — so the frame shows the game at
// its best, the same way a game's own screenshot mode poses a scene. Everything in the frame is
// the real renderer drawing real game objects; only their placement is staged.
import { FIELD, SHIP, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;

/** Place one shard from the pool with everything a live shard carries. */
function placeShard(state, x, y, color, speed, spin) {
  const shard = state.shards.find((s) => !s.active);
  if (!shard) return;
  shard.active = true;
  shard.gold = false;
  shard.color = color;
  shard.scale = 1;
  shard.size = 44;
  shard.x = x;
  shard.y = y;
  shard.speed = speed;
  shard.split = false;
  shard.spin = spin;
}

function placeGold(state, x, y, speed) {
  const shard = state.shards.find((s) => !s.active);
  if (!shard) return;
  shard.active = true;
  shard.gold = true;
  shard.color = 0;
  shard.scale = 1;
  shard.size = 28;
  shard.x = x;
  shard.y = y;
  shard.speed = speed;
  shard.split = false;
  shard.spin = 0;
}

function placePowerup(state, type, x, y) {
  const powerup = state.powerups.find((p) => !p.active);
  if (!powerup) return;
  powerup.active = true;
  powerup.type = type;
  powerup.size = 26;
  powerup.x = x;
  powerup.y = y;
  powerup.speed = 95;
}

function placeBeam(state, x, y, color) {
  const beam = state.beams.find((b) => !b.active);
  if (!beam) return;
  beam.active = true;
  beam.color = color;
  beam.x = x;
  beam.y = y;
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it, the best score to show, and any effects to seed before painting.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { dir: 0, mouseX: null, color: 0 }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const end = name === 'end';

  // The shared mid-game story: wave 3, a real score, a best combo worth bragging about.
  state.level = 3;
  state.maxLevel = end ? 4 : 3;
  state.score = end ? 1320 : 1240;
  state.bestCombo = 9;
  state.combo = end ? 0 : 5;
  state.destroyed = end ? 104 : 96;
  state.powerupsCollected = 5;
  state.elapsed = end ? 52 : 35;
  state.lives = end ? 0 : 3;
  state.slowTime = end ? 0 : 3.4;

  // The ship, holding the rose column, shield ring up unless the story is its undoing.
  state.player.x = 592;
  state.player.color = 0;
  state.player.invulnerable = 0;
  state.player.shield = end ? 0 : 1;
  state.player.tripleTime = 0;
  state.player.fireTimer = 0;

  // A stack of rose shards right above the ship: the next three beams chain into it. Spaced so
  // each crystal's halo reads as its own gem, not a blob.
  placeShard(state, 598, 470, 0, 152, 0.4);
  placeShard(state, 588, 330, 0, 149, 2.2);
  placeShard(state, 604, 190, 0, 158, 4.1);
  // Two low shards on the left: near-misses read as tension, and they fill the empty corner.
  placeShard(state, 140, 596, 2, 150, 2.5);
  placeShard(state, 258, 618, 1, 143, 4.4);
  // A scatter across the field: every colour, several heights, all mid-fall.
  placeShard(state, 232, 250, 1, 171, 1.2);
  placeShard(state, 322, 84, 2, 163, 5.0);
  placeShard(state, 452, 180, 1, 145, 0.1);
  placeShard(state, 762, 70, 2, 168, 2.8);
  placeShard(state, 884, 130, 1, 159, 1.9);
  placeShard(state, 952, 320, 2, 172, 3.9);
  placeShard(state, 1076, 508, 1, 147, 0.6);
  placeShard(state, 1128, 230, 0, 181, 5.6);
  // The gold bonus, a power-up on the way down, and two rose beams mid-climb. The gold sits in
  // open sky: its wide halo must not merge with a shard's.
  placeGold(state, 1005, 95, 190);
  placePowerup(state, 'bomb', 408, 332);
  placeBeam(state, 617, 500, 0);
  placeBeam(state, 617, 296, 0);

  // Juice: the burst where a shard just shattered, the score that shatter paid — placed in the
  // open, clear of the standing shards, so each element reads on its own.
  const seedFx = end
    ? [
        { kind: 'burst', x: 340, y: 560, color: '#ff4d6d', count: 14 },
        { kind: 'shake', amount: 6 },
      ]
    : [
        { kind: 'burst', x: 780, y: 390, color: '#ff4d6d', count: 18 },
        { kind: 'burst', x: 348, y: 560, color: '#2cf08f', count: 12 },
        { kind: 'text', x: 808, y: 358, text: '+30', color: '#ff4d6d' },
        { kind: 'text', x: 376, y: 528, text: '+20', color: '#2cf08f' },
        { kind: 'shake', amount: 3 },
      ];
  return { screen: end ? SCREEN_OVER : SCREEN_PLAY, best: state.score, seedFx };
}