// The screenshot scenes behind ?shot=start|play|end|power. Each returns a world state plus the
// screen to draw over it. The title scene plays the real rules forward from a fresh world for a
// few seconds (harmless mode: shards fall, nothing scores). The play, end and power scenes are
// curated: the world's object pools are filled by hand with a mid-game arrangement — a stack of
// shards over the ship, beams mid-climb, power-ups falling, the shield ring up — so each frame
// shows the game at its best, the way a game's own screenshot mode poses a scene. Everything in
// the frame is the real renderer drawing real game objects; only their placement is staged.
import { BEAM, POWERUP, SHARD, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 8;

/** Place one shard from the pool with everything a live shard carries. */
function placeShard(state, x, y, color, speed, spin) {
  const shard = state.shards.find((s) => !s.active);
  if (!shard) return;
  shard.active = true;
  shard.gold = false;
  shard.color = color;
  shard.scale = 1;
  shard.size = SHARD.size;
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
  powerup.size = POWERUP.size;
  powerup.x = x;
  powerup.y = y;
  powerup.speed = 95;
}

/** A beam mid-climb: `centerX` is the beam's centre line, so the width writes itself. */
function placeBeam(state, centerX, y, color) {
  const beam = state.beams.find((b) => !b.active);
  if (!beam) return;
  beam.active = true;
  beam.color = color;
  beam.x = centerX - BEAM.width / 2;
  beam.y = y;
}

/**
 * Set `world` to the named scene (start, play, end or power; any other name is start) and return
 * the screen to draw over it, the best score to show, and any effects to seed before painting.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'end' && name !== 'power') {
    // The title's backdrop: crystals framing the edges, kept clear of the title band (y < 160,
    // x 360-920), the prism column and every line of text.
    placeShard(state, 110, 190, 0, 160, 1.2);
    placeShard(state, 215, 90, 2, 150, 4.0);
    placeShard(state, 90, 420, 1, 170, 2.8);
    placeShard(state, 200, 600, 0, 155, 0.5);
    placeShard(state, 1100, 170, 1, 165, 3.3);
    placeShard(state, 1180, 330, 0, 158, 5.2);
    placeShard(state, 1150, 520, 2, 150, 1.8);
    placeShard(state, 1060, 608, 1, 172, 4.6);
    placeShard(state, 330, 40, 1, 160, 2.1);
    placeShard(state, 950, 40, 2, 148, 0.9);
    placeShard(state, 380, 636, 2, 162, 3.8);
    placeShard(state, 880, 636, 1, 155, 5.5);
    placeGold(state, 130, 300, 170);
    placeGold(state, 1160, 440, 175);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const end = name === 'end';
  const showcase = name === 'power';

  // The mid-game story each frame tells: real wave, real score, a best combo worth bragging about.
  state.level = showcase ? 4 : 3;
  state.maxLevel = end || showcase ? 4 : 3;
  state.score = end ? 1320 : showcase ? 1860 : 1240;
  state.bestCombo = showcase ? 12 : 9;
  state.combo = end ? 0 : showcase ? 8 : 5;
  state.destroyed = end ? 104 : showcase ? 140 : 96;
  state.powerupsCollected = showcase ? 7 : 5;
  state.elapsed = end ? 52 : showcase ? 47 : 35;
  state.lives = end ? 0 : 3;
  state.slowTime = end || showcase ? 0 : 3.4;
  state.banner = end ? null : { text: `WAVE ${state.level}`, time: showcase ? 1.2 : 0.9 };

  // The ship, holding its column: shielded in the play frame, triple-armed in the showcase.
  state.player.x = showcase ? 560 : 592;
  state.player.color = showcase ? 1 : 0;
  state.player.invulnerable = 0;
  state.player.shield = showcase || end ? 0 : 1;
  state.player.tripleTime = showcase ? 6.5 : 0;
  state.player.fireTimer = 0;

  if (showcase) {
    // The power shot: the triple beam fanned wide, catching a mint stack mid-chain.
    placeBeam(state, 566, 540, 1);
    placeBeam(state, 588, 500, 1);
    placeBeam(state, 610, 540, 1);
    placeShard(state, 562, 470, 1, 150, 0.3);
    placeShard(state, 556, 350, 1, 155, 2.0);
    placeShard(state, 570, 230, 2, 160, 3.7);
    // A scatter across the field: every colour, several heights, all mid-fall.
    placeShard(state, 180, 200, 0, 168, 1.1);
    placeShard(state, 300, 90, 2, 175, 4.4);
    placeShard(state, 120, 470, 2, 158, 2.6);
    placeShard(state, 420, 300, 0, 152, 4.9);
    placeShard(state, 840, 160, 0, 149, 5.1);
    placeShard(state, 950, 330, 2, 170, 0.8);
    placeShard(state, 1090, 520, 0, 144, 3.2);
    placeShard(state, 1150, 210, 1, 178, 1.7);
    // Gold in open sky, two power-ups on the way down.
    placeGold(state, 1020, 90, 190);
    placePowerup(state, 'bomb', 760, 330);
    placePowerup(state, 'shield', 320, 560);
    return {
      screen: SCREEN_PLAY,
      best: state.score,
      seedFx: [
        { kind: 'burst', x: 600, y: 430, color: '#2cf08f', count: 26 },
        { kind: 'text', x: 628, y: 400, text: '+120', color: '#2cf08f' },
        { kind: 'burst', x: 170, y: 540, color: '#ff4d6d', count: 14 },
        { kind: 'text', x: 196, y: 512, text: '+90', color: '#ff4d6d' },
        { kind: 'shake', amount: 4 },
      ],
    };
  }

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
  placeBeam(state, 620, 500, 0);
  placeBeam(state, 620, 296, 0);

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