// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), sounds and particles react to the events the
// world reports, and the renderer paints what is there. The game moves between four screens:
// title, play, paused and game over. ?seed=N fixes the random stream; ?shot=start|play|end (with
// &seed=N) stages that scene instead of running the loop and sets window.__shotReady for a
// screenshot, as the kit's shots.json drives.
import { BEST_KEY, COLORS, FIELD, GOLD, SHARD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOMB, EVENT_GOLD, EVENT_HIT, EVENT_MATCH, EVENT_OVER, EVENT_POWERUP, EVENT_SHIELD, EVENT_SPLIT } from './world.js';
import { ACTION_CONFIRM, ACTION_CYCLE, ACTION_PAUSE, createInput } from './input.js';
import { createEffects } from './effects.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { sound } from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const fx = createEffects();
const renderer = createRenderer(canvas);
const input = createInput(canvas);

let screen = SCREEN_TITLE;
let best = readBest();
let lastEvents = 0;
let last = 0;
let accumulator = 0;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function announce(text) {
  status.textContent = text;
}

function comboMultiplier(combo) {
  return 1 + Math.floor(combo / 3);
}

function startGame() {
  world.reset();
  screen = SCREEN_PLAY;
  announce('Playing: move with the mouse or arrow keys, switch colour with 1 2 3, Q W E or the wheel.');
  sound.startAmbient();
}

function onEvents(events) {
  const state = world.state;
  lastEvents = events;
  if (events & EVENT_MATCH) {
    const points = SHARD.points * comboMultiplier(state.combo);
    const color = COLORS[state.player.color].fill;
    const cx = state.player.x + 24;
    fx.burst(cx, state.player.y - 90, color, 14);
    fx.floatText(cx, state.player.y - 120, `+${points}`, color);
    sound.match(state.combo);
  }
  if (events & EVENT_SPLIT) {
    const cx = state.player.x + 24;
    fx.burst(cx, state.player.y - 70, '#9aa5c0', 10);
    sound.split();
  }
  if (events & EVENT_GOLD) {
    const cx = state.player.x + 24;
    fx.burst(cx, state.player.y - 90, '#ffd24d', 20);
    fx.floatText(cx, state.player.y - 130, `+${GOLD.points}`, '#ffd24d');
    sound.gold();
  }
  if (events & EVENT_POWERUP) {
    const cx = state.player.x + 24;
    const color = COLORS[state.player.color].fill;
    fx.burst(cx, state.player.y - 60, color, 18);
    fx.floatText(cx, state.player.y - 90, '+POWER', color);
    sound.powerup();
  }
  if (events & EVENT_BOMB) {
    fx.burst(FIELD.width / 2, FIELD.height / 2, '#ff8c5a', 60);
    fx.burst(FIELD.width / 2, FIELD.height / 2, '#ffffff', 30);
    fx.applyShake(12);
    sound.bomb();
  }
  if (events & EVENT_SHIELD) {
    fx.applyShake(5);
    sound.shieldBreak();
  }
  if (events & EVENT_HIT) {
    fx.applyShake(6);
    sound.hit();
  }
  if (events & EVENT_OVER) {
    screen = SCREEN_OVER;
    best = Math.max(best, state.score);
    saveBest(best);
    sound.over();
    announce(`Game over. Score ${state.score}.`);
  }
}

/** The controls for one live step: steering from keys or the mouse, colour from the last gesture. */
function liveControls() {
  let mouseX = null;
  const px = input.pointerX();
  if (px !== null) mouseX = renderer.toFieldX(px);
  return { dir: input.direction(), mouseX, color: input.takeWantedColor() };
}

function runShot(name) {
  const scene = stageShot(name, world);
  best = Math.max(best, scene.best);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, fx);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  paint();
}

function step() {
  // Screen plumbing: confirm on title/over starts, pause toggles, colour cycles in play.
  const actions = input.takeActions();
  if (screen === SCREEN_TITLE && (actions & ACTION_CONFIRM)) {
    startGame();
    return;
  }
  if (screen === SCREEN_OVER && (actions & ACTION_CONFIRM)) {
    startGame();
    return;
  }
  if (screen === SCREEN_PLAY && (actions & ACTION_PAUSE)) {
    screen = SCREEN_PAUSED;
    announce('Paused.');
    return;
  }
  if (screen === SCREEN_PAUSED && (actions & ACTION_PAUSE)) {
    screen = SCREEN_PLAY;
    announce('Resumed.');
    return;
  }
  if (screen === SCREEN_PLAY && (actions & ACTION_CYCLE)) {
    const next = (world.state.player.color + 1) % COLORS.length;
    world.state.player.color = next;
    sound.switchc();
  }
  if (screen !== SCREEN_PLAY) return;

  const events = world.step(STEP, liveControls(), false);
  if (events) onEvents(events);
}

function frame(now) {
  const delta = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  accumulator += delta;
  while (accumulator >= STEP) {
    step();
    accumulator -= STEP;
  }
  renderer.draw(world.state, screen, best, fx);
}

if (shot) {
  runShot(shot);
} else {
  last = performance.now();
  accumulator = 0;
  requestAnimationFrame(function loop(now) {
    frame(now);
    requestAnimationFrame(loop);
  });
}