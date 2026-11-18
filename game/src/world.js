// The game's rules and state, with no drawing and no browser in it: the prism ship, the pools of
// falling shards, rising beams and power-ups, spawning, colour matching, splitting, scoring, the
// combo streak, the shield/slow/triple/bomb effects, lives and level. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react (sound, particles, screens)
// without the world knowing about them. Nothing here allocates after createWorld returns.
import { BEAM, COLORS, FIELD, GOLD, LEVEL, LIVES, POOL_BEAMS, POOL_POWERUPS, POOL_SHARDS, POWERUP, POWERUP_DEFS, POWERUP_ORDER, SHARD, SHIP } from './config.js';

export const EVENT_MATCH = 1;
export const EVENT_SPLIT = 2;
export const EVENT_HIT = 4;
export const EVENT_GOLD = 8;
export const EVENT_OVER = 16;
export const EVENT_POWERUP = 32;
export const EVENT_BOMB = 64;
export const EVENT_SHIELD = 128;

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function createWorld(random) {
  const player = {
    x: (FIELD.width - SHIP.width) / 2,
    y: SHIP.y,
    color: 0,
    invulnerable: 0,
    fireTimer: 0,
    shield: 0,
    tripleTime: 0,
  };
  const shards = [];
  for (let i = 0; i < POOL_SHARDS; i += 1) {
    shards.push({ active: false, gold: false, color: 0, scale: 1, x: 0, y: 0, size: SHARD.size, speed: 0, split: false, spin: 0 });
  }
  const beams = [];
  for (let i = 0; i < POOL_BEAMS; i += 1) {
    beams.push({ active: false, color: 0, x: 0, y: 0 });
  }
  const powerups = [];
  for (let i = 0; i < POOL_POWERUPS; i += 1) {
    powerups.push({ active: false, type: 'shield', x: 0, y: 0, size: POWERUP.size, speed: 0 });
  }
  const state = {
    player,
    shards,
    beams,
    powerups,
    score: 0,
    lives: LIVES,
    level: 1,
    maxLevel: 1,
    combo: 0,
    bestCombo: 0,
    destroyed: 0,
    powerupsCollected: 0,
    slowTime: 0,
    elapsed: 0,
    shardTimer: SHARD.interval,
    goldTimer: GOLD.interval,
    powerupTimer: POWERUP.interval,
    goldCount: 0,
  };

  function reset() {
    player.x = (FIELD.width - SHIP.width) / 2;
    player.color = 0;
    player.shield = 0;
    player.tripleTime = 0;
    player.invulnerable = 0;
    player.fireTimer = 0;
    for (const shard of shards) shard.active = false;
    for (const beam of beams) beam.active = false;
    for (const powerup of powerups) powerup.active = false;
    state.score = 0;
    state.lives = LIVES;
    state.level = 1;
    state.maxLevel = 1;
    state.combo = 0;
    state.bestCombo = 0;
    state.destroyed = 0;
    state.powerupsCollected = 0;
    state.slowTime = 0;
    state.elapsed = 0;
    state.shardTimer = SHARD.interval;
    state.goldTimer = GOLD.interval;
    state.powerupTimer = POWERUP.interval;
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

  function freePowerup() {
    for (const powerup of powerups) if (!powerup.active) return powerup;
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
    shard.spin = random() * Math.PI * 2;
  }

  function spawnSplit(parent) {
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
      shard.spin = random() * Math.PI * 2;
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
    shard.spin = 0;
  }

  function spawnPowerup() {
    const powerup = freePowerup();
    if (powerup === null) return;
    powerup.active = true;
    powerup.type = POWERUP_ORDER[(random() * POWERUP_ORDER.length) | 0];
    powerup.size = POWERUP.size;
    powerup.x = random() * (FIELD.width - POWERUP.size);
    powerup.y = -POWERUP.size;
    powerup.speed = POWERUP.speed;
  }

  function fireBeam(centerX) {
    const beam = freeBeam();
    if (beam === null) return;
    beam.active = true;
    beam.color = player.color;
    beam.x = centerX - BEAM.width / 2;
    beam.y = player.y - SHIP.height;
  }

  /** Collect a power-up: apply its effect and report it. bomb is handled by the caller's event. */
  function applyPowerup(powerup) {
    const def = POWERUP_DEFS[powerup.type];
    if (powerup.type === 'shield') player.shield = 1;
    else if (powerup.type === 'triple') player.tripleTime = def.duration;
    else if (powerup.type === 'slow') state.slowTime = def.duration;
    else if (powerup.type === 'bomb') {
      let cleared = 0;
      for (const shard of shards) {
        if (shard.active && !shard.gold) {
          shard.active = false;
          cleared += 1;
        }
      }
      state.score += cleared * SHARD.points;
      state.destroyed += cleared;
    }
    state.score += POWERUP.points;
    state.powerupsCollected += 1;
    powerup.active = false;
  }

  function shardInterval() {
    return Math.max(SHARD.minInterval, SHARD.interval * SHARD.intervalScale ** (state.level - 1));
  }

  function comboMultiplier() {
    return 1 + Math.floor(state.combo / 3);
  }

  /**
   * One fixed step. `controls` is { dir, mouseX, color }. With `harmless` set (the title screen's
   * backdrop) shards fall, nothing fires and nothing scores or hurts.
   */
  function step(dt, controls, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.level = Math.min(LEVEL.max, 1 + Math.floor(state.elapsed / LEVEL.seconds));
    if (state.level > state.maxLevel) state.maxLevel = state.level;

    // Steering and colour.
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
    if (player.tripleTime > 0) player.tripleTime = Math.max(0, player.tripleTime - dt);
    if (state.slowTime > 0) state.slowTime = Math.max(0, state.slowTime - dt);

    // Spawn shards, gold and power-ups.
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
    state.powerupTimer -= dt;
    if (state.powerupTimer <= 0) {
      spawnPowerup();
      state.powerupTimer += POWERUP.interval + random() * POWERUP.intervalJitter;
    }

    // Fire: the triple power-up spreads three beams, else one.
    if (!harmless) {
      player.fireTimer -= dt;
      if (player.fireTimer <= 0) {
        const cx = player.x + SHIP.width / 2;
        if (player.tripleTime > 0) {
          fireBeam(cx - SHIP.width * 0.4);
          fireBeam(cx);
          fireBeam(cx + SHIP.width * 0.4);
        } else {
          fireBeam(cx);
        }
        player.fireTimer += BEAM.fireInterval;
      }
    }

    // Move shards down; a shard that reaches the bottom edge costs a shield, else a life.
    const slowFactor = state.slowTime > 0 ? 0.5 : 1;
    for (const shard of shards) {
      if (!shard.active) continue;
      shard.y += shard.speed * slowFactor * dt;
      shard.spin += dt * 1.5;
      if (shard.y > FIELD.groundY) {
        shard.active = false;
        if (harmless || shard.gold) continue;
        if (player.shield > 0) {
          player.shield = 0;
          state.combo = 0;
          events |= EVENT_SHIELD;
        } else {
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
          shard.active = false;
          beam.active = false;
          state.combo += 1;
          if (state.combo > state.bestCombo) state.bestCombo = state.combo;
          state.destroyed += 1;
          state.score += SHARD.points * comboMultiplier();
          events |= EVENT_MATCH;
        } else if (!shard.split) {
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
          beam.active = false;
          state.combo = 0;
        }
        break;
      }
    }

    // Power-ups: fall, and the ship collects one it touches.
    for (const powerup of powerups) {
      if (!powerup.active) continue;
      powerup.y += powerup.speed * dt;
      if (powerup.y > FIELD.groundY + POWERUP.size) {
        powerup.active = false;
        continue;
      }
      if (harmless) continue;
      const pbox = { x: powerup.x, y: powerup.y, w: powerup.size, h: powerup.size };
      const sbox = { x: player.x, y: player.y - SHIP.height, w: SHIP.width, h: SHIP.height + 6 };
      if (overlaps(pbox, sbox)) {
        const wasBomb = powerup.type === 'bomb';
        applyPowerup(powerup);
        events |= wasBomb ? EVENT_BOMB : EVENT_POWERUP;
        if (wasBomb) events |= EVENT_POWERUP;
      }
    }

    return events;
  }

  reset();
  return { state, reset, step };
}