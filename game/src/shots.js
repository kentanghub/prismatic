// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward from a
// fresh world for a fixed number of steps, steered by a simple autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame. The play pilot
// matches colours (a healthy field with a live score); the end pilot mismatches on purpose, which
// splits shards until they overrun it, so it is caught out exactly as a harried player is.
import { SHIP, STEP } from './config.js';
import { COLORS } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 30;
const END_LIMIT_SECONDS = 300;

/** Pick the lowest active shard (the one nearest the bottom edge), ignoring gold. */
function nearestShard(state) {
  let best = null;
  for (const shard of state.shards) {
    if (!shard.active || shard.gold) continue;
    if (best === null || shard.y > best.y) best = shard;
  }
  return best;
}

/** Steer in the pilot style: toward the lowest shard, matching (or, when `sabotage`, mismatching)
 *  its colour. Returns the controls object the world's step expects. */
function pilot(state, sabotage) {
  const player = state.player;
  const target = nearestShard(state);
  const cx = player.x + SHIP.width / 2;
  let dir = 0;
  if (target) {
    const tx = target.x + target.size / 2;
    if (tx > cx + 14) dir = 1;
    else if (tx < cx - 14) dir = -1;
  }
  let color = player.color;
  if (target) {
    if (sabotage) color = (target.color + 1 + (Math.floor(player.y * 0) & 1)) % COLORS.length;
    else color = target.color;
  }
  return { dir, mouseX: null, color };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { dir: 0, mouseX: null, color: 0 }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const sabotage = name === 'end';
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  for (let i = 0; i < limit / STEP; i += 1) {
    if (world.step(STEP, pilot(world.state, sabotage), false) & EVENT_OVER) break;
  }
  const over = world.state.lives <= 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}