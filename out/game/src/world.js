// The game's rules and state, with no drawing and no browser in it: the prism ship, the pools of
// falling shards and rising beams, spawning, colour matching, splitting, scoring, the combo
// streak, lives and level. step() advances one fixed step and returns what happened as bit flags,
// so the caller can react (sound, particles, screens) without the world knowing about them.
// Nothing here allocates after createWorld returns: the pools are grown once, at boot.
import { BEAM, COLORS, FIELD, GOLD, LEVEL, LIVES, POOL_BEAMS, POOL_SHARDS, SHARD, SHIP, STEP } from './config.js';

export const EVENT_MATCH = 1;
export const EVENT_SPLIT = 2;
export const EVENT_HIT = 4;
export const EVENT_GOLD = 8;
export const EVENT_OVER = 16;

/** A shard is a full-size one (scale 1, it splits on a wrong-colour beam) or a split half (scale
 *  0.5, a wrong-colour beam passes through it and only a matching beam clears it). */
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function createWorld(random) {
  const player = {
    x: (FIELD.width - SHIP.width) / 2,
    color: 0,
    invulnerable: 0,
    fireTimer: 0,
  };
  const shards = [];
  for (let i = 0; i < POOL_SHARDS; i += 1) {
    shards.push({ active: false, gold: false, color: 0, scale: 1, x: 0, y: 0, size: SHARD.size, speed: 0, split: false });
  }
  const beams = [];
  for (let i = 0; i < POOL_BEAMS; i += 1) {
    beams.push({ active: false, color: 0, x: 0, y: 0 });
  }
  const state = {
    player,
    shards,
    beams,
    score: 0,
    lives: LIVES,
    level: 1,
    combo: 0,
    bestCombo: 0,
    elapsed: 0,
    shardTimer: SHARD.interval,
    goldTimer: GOLD.interval,
    goldCount: 0,
  };

  function reset() {
    player.x = (FIELD.width - SHIP.width) / 2;
    player.color = 0;
    player.invulnerable = 0;
    player.fireTimer = 0;
    for (const shard of shards) shard.active = false;
    for (const beam of beams) beam.active = false;
    state.score = 0;
    state.lives = LIVES;
    state.level = 1;
    state.combo = 0;
    state.bestCombo = 0;
    state.elapsed = 0;
    state.shardTimer = SHARD.interval;
    state.goldTimer = GOLD.interval;
    state.goldCount = 0;
  }

  function freeShard() {
    for (const shard of shards) if (!shard.active) return shard;
    return null;
  }

  function freeBeam() {
    for (const beam of beams) if (!beam.active) return beam;
    return null;
  }

  function spawnShard() {
    const shard = freeShard();
    if (shard === null) return;
    shard.active = true;
    shard.gold = false;
    shard.color = (random() * COLORS.length) | 0;
    shard.scale = 1;
    shard.size = SHARD.size;
    shard.x = random() * (FIELD.width - SHARD.size);
    shard.y = -SHARD.size;
    shard.speed = SHARD.speed + SHARD.speedPerLevel * (state.level - 1) + random() * SHARD.speedJitter;
    shard.split = false;
  }

  function spawnSplit(parent) {
    // Two half-size shards of colours different from each other, dropped slightly faster.
    for (let c = 0; c < SHARD.splitCount; c += 1) {
      const shard = freeShard();
      if (shard === null) continue;
      shard.active = true;
      shard.gold = false;
      let color = (random() * COLORS.length) | 0;
      if (color === parent.color) color = (color + 1) % COLORS.length;
      shard.color = color;
      shard.scale = 0.5;
      shard.size = SHARD.size * SHARD.splitLevelFade;
      shard.x = Math.min(FIELD.width - shard.size, Math.max(0, parent.x + (random() * 34 - 17)));
      shard.y = parent.y;
      shard.speed = parent.speed * 1.15;
      shard.split = true;
    }
  }

  function spawnGold() {
    const shard = freeShard();
    if (shard === null) return;
    shard.active = true;
    shard.gold = true;
    shard.color = 0;
    shard.scale = 1;
    shard.size = GOLD.size;
    shard.x = random() * (FIELD.width - GOLD.size);
    shard.y = -GOLD.size;
    shard.speed = GOLD.speed + GOLD.speedPerLevel * (state.level - 1);
    shard.split = false;
  }

  function fireBeam() {
    const beam = freeBeam();
    if (beam === null) return;
    beam.active = true;
    beam.color = player.color;
    beam.x = player.x + SHIP.width / 2 - BEAM.width / 2;
    beam.y = player.y - SHIP.height;
  }

  function shardInterval() {
    return Math.max(SHARD.minInterval, SHARD.interval * SHARD.intervalScale ** (state.level - 1));
  }

  function comboMultiplier() {
    return 1 + Math.floor(state.combo / 3);
  }

  /**
   * One fixed step. `controls` is { dir, mouseX, color }: dir is -1/0/1 steering, mouseX (null or
   * a playfield x) steers the ship toward that point instead, color (null to keep) sets the ship's
   * beam colour. With `harmless` set (the title screen's backdrop) shards fall, nothing fires and
   * nothing scores or hurts.
   */
  function step(dt, controls, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.level = Math.min(LEVEL.max, 1 + Math.floor(state.elapsed / LEVEL.seconds));

    // Steering: the mouse takes the ship toward where it points; keys give a direction.
    if (controls.mouseX !== null && controls.mouseX !== undefined) {
      const target = Math.min(FIELD.width - SHIP.width, Math.max(0, controls.mouseX - SHIP.width / 2));
      const delta = target - player.x;
      const maxStep = SHIP.speed * dt;
      player.x += Math.max(-maxStep, Math.min(maxStep, delta));
    } else {
      player.x = Math.min(FIELD.width - SHIP.width, Math.max(0, player.x + controls.dir * SHIP.speed * dt));
    }
    if (controls.color !== null && controls.color !== undefined) player.color = controls.color % COLORS.length;
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);

    // Spawn shards and the occasional gold bonus.
    state.shardTimer -= dt;
    if (state.shardTimer <= 0) {
      spawnShard();
      state.shardTimer += shardInterval();
    }
    state.goldTimer -= dt;
    if (state.goldTimer <= 0) {
      spawnGold();
      state.goldTimer += GOLD.interval + random() * GOLD.intervalJitter;
    }

    // Fire the beam on its interval, but only once play has begun.
    if (!harmless) {
      player.fireTimer -= dt;
      if (player.fireTimer <= 0) {
        fireBeam();
        player.fireTimer += BEAM.fireInterval;
      }
    }

    // Move shards down; a shard that reaches the bottom edge costs a life (or, on the title
    // screen's harmless backdrop, simply wraps off).
    for (const shard of shards) {
      if (!shard.active) continue;
      shard.y += shard.speed * dt;
      if (shard.y > FIELD.groundY) {
        shard.active = false;
        if (!harmless && !shard.gold) {
          state.lives -= 1;
          state.combo = 0;
          events |= EVENT_HIT;
          if (state.lives <= 0) events |= EVENT_OVER;
        }
      }
    }

    // Move beams up and resolve their collisions with shards.
    for (const beam of beams) {
      if (!beam.active) continue;
      beam.y -= BEAM.speed * dt;
      if (beam.y < -20) {
        beam.active = false;
        continue;
      }
      const box = { x: beam.x, y: beam.y, w: BEAM.width, h: 22 };
      for (const shard of shards) {
        if (!shard.active) continue;
        const sbox = { x: shard.x, y: shard.y, w: shard.size, h: shard.size };
        if (!overlaps(box, sbox)) continue;
        if (shard.gold) {
          shard.active = false;
          beam.active = false;
          state.score += GOLD.points;
          state.goldCount += 1;
          if (state.goldCount >= GOLD.lifeEvery && state.lives < 5) {
            state.lives += 1;
            state.goldCount = 0;
          }
          events |= EVENT_GOLD;
          break;
        }
        if (shard.color === beam.color) {
          // A match: destroy it, score with the streak bonus.
          shard.active = false;
          beam.active = false;
          state.combo += 1;
          if (state.combo > state.bestCombo) state.bestCombo = state.combo;
          state.score += SHARD.points * comboMultiplier();
          events |= EVENT_MATCH;
        } else if (!shard.split) {
          // A wrong-colour hit on a full shard splits it; the beam is spent.
          const px = shard.x;
          const py = shard.y;
          const pc = shard.color;
          const ps = shard.speed;
          shard.active = false;
          beam.active = false;
          spawnSplit({ x: px, y: py, color: pc, speed: ps });
          state.combo = 0;
          events |= EVENT_SPLIT;
        } else {
          // A wrong-colour hit on a split half is absorbed harmlessly.
          beam.active = false;
          state.combo = 0;
        }
        break;
      }
    }

    return events;
  }

  reset();
  return { state, reset, step };
}