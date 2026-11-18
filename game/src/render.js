// Drawing only: the world's state, the current screen and the effect layer go in, pixels come out.
// The 1280x720 playfield is scaled to fit the window and centred, the margin filled with the
// backdrop colour. A "glow" is two fills — a wide low-alpha halo and a bright core — which reads as
// neon without the cost of shadowBlur. Text that holds a number is rebuilt only when the number
// changes, so a frame allocates nothing.
import { COLORS, FIELD, FONT, LIVES, PALETTE, SHIP } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, line: 34, top: 84, bottom: 66 };
const LIFE_SIZE = 20;
const LIFE_GAP = 9;
const COLOR_SIZE = 17;

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

/** A deterministic star field: positions vary with the index, so the same code always gives the
 *  same sky, which keeps the screenshot scenes stable. */
function makeStars(count) {
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    const x = ((i * 137.508) % FIELD.width);
    const y = ((i * 89.7 + 13) % FIELD.height);
    const r = 0.6 + ((i * 31) % 10) / 8;
    stars.push({ x, y, r, a: 0.25 + ((i * 17) % 40) / 100 });
  }
  return stars;
}

/** Draw a glowing dot: a wide faint halo then a small bright core. */
function glowDot(context, x, y, radius, color, alpha) {
  context.globalAlpha = alpha * 0.22;
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, radius * 3.2, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = alpha;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  let dpr = 1;
  const view = { scale: 1, x: 0, y: 0 };
  const stars = makeStars(140);

  const scoreLabel = cachedLabel('SCORE ');
  const waveLabel = cachedLabel('WAVE ');
  const comboLabel = cachedLabel('COMBO x');
  const finalLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * dpr);
    const height = Math.round(window.innerHeight * dpr);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    const px = Math.round(size * view.scale);
    if (!fonts.has(px)) fonts.set(px, `${px}px ${FONT}`);
    context.font = fonts.get(px);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  /** A soft, deterministic nebula of the three colours, so even the idle scenes are vivid. */
  function drawNebula() {
    const blobs = [
      { x: 260, y: 170, r: 360, c: 'rgba(255,77,109,0.11)' },
      { x: 1020, y: 230, r: 400, c: 'rgba(77,139,255,0.13)' },
      { x: 640, y: 560, r: 440, c: 'rgba(44,240,143,0.08)' },
    ];
    for (const b of blobs) {
      const g = context.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, b.c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = g;
      context.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
  }

  function drawBackground() {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.voidA);
    gradient.addColorStop(1, PALETTE.voidB);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    drawNebula();
    for (const star of stars) {
      context.globalAlpha = star.a;
      context.fillStyle = PALETTE.star;
      context.beginPath();
      context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // A faint horizon line where shards land, so the danger zone reads at a glance.
    context.fillStyle = 'rgba(255,255,255,0.06)';
    context.fillRect(0, FIELD.groundY, FIELD.width, 2);
  }

  function drawBeams(state) {
    for (const beam of state.beams) {
      if (!beam.active) continue;
      const color = COLORS[beam.color].fill;
      const x = beam.x + 3;
      context.globalAlpha = 0.3;
      context.fillStyle = color;
      context.fillRect(x - 4, beam.y - 6, 14, 40);
      context.globalAlpha = 1;
      context.fillStyle = color;
      context.fillRect(x, beam.y, 6, 30);
    }
  }

  function drawShards(state) {
    for (const shard of state.shards) {
      if (!shard.active) continue;
      const cx = shard.x + shard.size / 2;
      const cy = shard.y + shard.size / 2;
      if (shard.gold) {
        glowDot(context, cx, cy, shard.size * 0.4, PALETTE.gold, 1);
        continue;
      }
      const color = COLORS[shard.color].fill;
      glowDot(context, cx, cy, shard.size * 0.46, color, 1);
      const r = shard.size * 0.5;
      context.strokeStyle = color;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(cx, cy - r);
      context.lineTo(cx + r, cy);
      context.lineTo(cx, cy + r);
      context.lineTo(cx - r, cy);
      context.closePath();
      context.stroke();
      // A white glint so the diamond reads as a solid crystal.
      context.fillStyle = 'rgba(255,255,255,0.85)';
      context.beginPath();
      context.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawShip(state) {
    const player = state.player;
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0) return;
    const color = COLORS[player.color].fill;
    const cx = player.x + SHIP.width / 2;
    const top = player.y - 6;
    const bottom = player.y + SHIP.height;
    context.globalAlpha = 0.4;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(cx, top - 20);
    context.lineTo(cx + SHIP.width * 0.66, bottom + 16);
    context.lineTo(cx - SHIP.width * 0.66, bottom + 16);
    context.closePath();
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(cx, top);
    context.lineTo(cx + SHIP.width / 2, bottom);
    context.lineTo(cx - SHIP.width / 2, bottom);
    context.closePath();
    context.fill();
    // A small star cut into the hull, in the void colour, so it reads as a solid shape.
    context.fillStyle = PALETTE.backdrop;
    context.beginPath();
    const inner = SHIP.width * 0.17;
    context.moveTo(cx, top + inner + 8);
    context.lineTo(cx + inner, bottom - 6);
    context.lineTo(cx - inner, bottom - 6);
    context.closePath();
    context.fill();
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 30, PALETTE.text, 'left');
    text(waveLabel(state.level), FIELD.width / 2, 18, 30, PALETTE.text, 'center');
    const start = FIELD.width - 24 - LIVES * (LIFE_SIZE + LIFE_GAP) + LIFE_GAP;
    for (let life = 0; life < LIVES; life += 1) {
      const cx = start + life * (LIFE_SIZE + LIFE_GAP);
      context.fillStyle = life < state.lives ? PALETTE.text : 'rgba(255,255,255,0.12)';
      context.beginPath();
      context.moveTo(cx, 22 + LIFE_SIZE);
      context.lineTo(cx + LIFE_SIZE / 2, 22);
      context.lineTo(cx + LIFE_SIZE, 22 + LIFE_SIZE);
      context.closePath();
      context.fill();
    }
    const ringY = 30;
    const ringX = start - 26 - COLORS.length * (COLOR_SIZE + 10);
    for (const color of COLORS) {
      const cx = ringX + color.id * (COLOR_SIZE + 10);
      context.globalAlpha = color.id === state.player.color ? 1 : 0.3;
      context.fillStyle = color.fill;
      context.beginPath();
      context.moveTo(cx, ringY - COLOR_SIZE);
      context.lineTo(cx + COLOR_SIZE, ringY);
      context.lineTo(cx, ringY + COLOR_SIZE);
      context.lineTo(cx - COLOR_SIZE, ringY);
      context.closePath();
      context.fill();
    }
    context.globalAlpha = 1;
    if (state.combo >= 2) {
      text(comboLabel(state.combo), 24, 54, 22, PALETTE.gold, 'left');
    }
  }

  /** A glass prism splitting white light into the three beam colours — the game's logo. */
  function drawPrismLogo(cx, cy, size) {
    context.fillStyle = '#cfe0ff';
    context.beginPath();
    context.moveTo(cx, cy - size);
    context.lineTo(cx - size * 0.7, cy + size);
    context.lineTo(cx + size * 0.7, cy + size);
    context.closePath();
    context.fill();
    const spread = [-0.5, 0, 0.5];
    for (let i = 0; i < 3; i += 1) {
      context.strokeStyle = COLORS[i].fill;
      context.lineWidth = 6;
      context.globalAlpha = 0.95;
      context.beginPath();
      context.moveTo(cx, cy + size);
      context.lineTo(cx + spread[i] * size * 1.5, cy + size + size * 1.7);
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  function drawTitle(state, best) {
    text('PRISMATIC', FIELD.width / 2, 176, 80, PALETTE.text, 'center');
    const barW = 330;
    for (let i = 0; i < 3; i += 1) {
      context.fillStyle = COLORS[i].fill;
      context.fillRect(FIELD.width / 2 - barW / 2 + i * (barW / 3), 196, barW / 3 - 4, 7);
    }
    drawPrismLogo(FIELD.width / 2, 344, 92);
    text('Match the colour to shatter the shards. A wrong colour splits one into two.', FIELD.width / 2, 470, 25, PALETTE.muted, 'center');
    text('Move with the mouse or \u2190 \u2192  \u00b7  switch beam colour with 1 2 3, Q W E or the wheel', FIELD.width / 2, 508, 22, PALETTE.muted, 'center');
    if (best > 0) text(bestLabel(best), FIELD.width / 2, 552, 24, PALETTE.muted, 'center');
    text('Press Space or click to begin', FIELD.width / 2, 618, 32, PALETTE.gold, 'center');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x + 1, y + 1, PANEL.width - 2, height - 2);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 72, 56, accent || PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + PANEL.top + 12 + i * PANEL.line, 24, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 34, 24, PALETTE.gold, 'center');
  }

  const PAUSED_LINES = ['The storm waits for you.'];

  function drawOver(state, best) {
    drawPanel('Game Over', [finalLabel(state.score), bestLabel(best)], 'Press Space or click to play again', COLORS[0].fill);
  }

  /** Paint one frame: the field (with any shake), the effect layer, then the HUD or a panel. */
  function draw(state, screen, best, fx) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const ox = fx ? fx.shakeOffset() : 0;
    const oy = fx ? fx.shakeOffset() : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + ox * view.scale, view.y + oy * view.scale);
    drawBackground();
    drawBeams(state);
    drawShards(state);
    drawShip(state);
    if (fx) fx.draw(context, view.scale);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume', PALETTE.text);
    else if (screen === SCREEN_OVER) drawOver(state, best);
  }

  /** Map a pointer's client x to a playfield x, for mouse steering. */
  function toFieldX(clientX) {
    return (clientX * dpr - view.x) / view.scale;
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toFieldX };
}