// Drawing only: the world's state, the current screen and the effect layer go in, pixels come out.
// The 1280x720 playfield is scaled to fit the window and centred, the margin filled with the
// backdrop colour. A "glow" is two fills — a wide low-alpha halo and a bright core — which reads as
// neon without the cost of shadowBlur. Text that holds a number is rebuilt only when the number
// changes, so a frame allocates nothing. Shards are faceted crystals; the ship has an engine
// trail and a shield ring; power-ups carry a glyph.
import { COLORS, FIELD, FONT, LEVEL, LIVES, PALETTE, POWERUP_DEFS, SHIP } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 660, line: 34, top: 84, bottom: 66 };
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
  const waveFinalLabel = cachedLabel('WAVE ');
  const comboFinalLabel = cachedLabel('BEST COMBO x');

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
    context.strokeStyle = 'rgba(120,150,210,0.05)';
    context.lineWidth = 1;
    const gap = 74;
    for (let gx = -gap; gx < FIELD.width + gap; gx += gap) {
      for (let gy = -gap; gy < FIELD.height + gap; gy += gap * 1.5) {
        context.beginPath();
        context.moveTo(gx + gap / 2, gy);
        context.lineTo(gx, gy + gap * 0.5);
        context.lineTo(gx + gap / 2, gy + gap);
        context.lineTo(gx + gap, gy + gap * 0.5);
        context.closePath();
        context.stroke();
      }
    }
    for (const star of stars) {
      context.globalAlpha = star.a;
      context.fillStyle = PALETTE.star;
      context.beginPath();
      context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    context.fillStyle = 'rgba(255,255,255,0.06)';
    context.fillRect(0, FIELD.groundY, FIELD.width, 2);
  }

  function drawBeams(state) {
    for (const beam of state.beams) {
      if (!beam.active) continue;
      const color = COLORS[beam.color].fill;
      const x = beam.x + 3;
      context.globalAlpha = 0.35;
      context.fillStyle = color;
      context.fillRect(x - 7, beam.y - 8, 20, 44);
      context.globalAlpha = 1;
      context.fillStyle = color;
      context.fillRect(x, beam.y, 6, 30);
      context.fillStyle = '#ffffff';
      context.globalAlpha = 0.9;
      context.fillRect(x - 1, beam.y - 3, 8, 4);
      context.globalAlpha = 1;
    }
  }

  function drawGem(cx, cy, r, color, spin) {
    context.save();
    context.translate(cx, cy);
    context.rotate(spin || 0);
    context.globalAlpha = 0.3;
    context.fillStyle = color;
    context.beginPath();
    context.arc(0, 0, r * 2.4, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, -r);
    context.lineTo(r * 0.82, 0);
    context.lineTo(0, r);
    context.lineTo(-r * 0.82, 0);
    context.closePath();
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.35)';
    context.beginPath();
    context.moveTo(0, -r);
    context.lineTo(r * 0.36, -r * 0.2);
    context.lineTo(0, r * 0.3);
    context.lineTo(-r * 0.36, -r * 0.2);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawShards(state) {
    for (const shard of state.shards) {
      if (!shard.active) continue;
      const cx = shard.x + shard.size / 2;
      const cy = shard.y + shard.size / 2;
      if (shard.gold) {
        glowDot(context, cx, cy, shard.size * 0.4, PALETTE.gold, 1);
        context.fillStyle = '#fff8e0';
        context.beginPath();
        context.arc(cx, cy, shard.size * 0.16, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      drawGem(cx, cy, shard.size * 0.5, COLORS[shard.color].fill, shard.spin);
    }
  }

  function drawPowerupGlyph(type, cx, cy, s) {
    context.lineWidth = 2.5;
    context.strokeStyle = '#ffffff';
    context.fillStyle = '#ffffff';
    if (type === 'shield') {
      context.beginPath();
      context.arc(cx, cy, s, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.arc(cx, cy, s * 0.5, 0, Math.PI * 2);
      context.stroke();
    } else if (type === 'triple') {
      for (let k = -1; k <= 1; k += 1) {
        const bx = cx + k * s * 0.8;
        context.beginPath();
        context.moveTo(bx - s * 0.4, cy - s * 0.3);
        context.lineTo(bx, cy - s * 0.85);
        context.lineTo(bx + s * 0.4, cy - s * 0.3);
        context.closePath();
        context.fill();
      }
    } else if (type === 'slow') {
      context.beginPath();
      context.arc(cx, cy, s, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(cx, cy);
      context.lineTo(cx, cy - s * 0.6);
      context.moveTo(cx, cy);
      context.lineTo(cx + s * 0.5, cy);
      context.stroke();
    } else if (type === 'bomb') {
      context.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI) / 4;
        const rr = i % 2 === 0 ? s : s * 0.42;
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
    }
  }

  function drawPowerups(state) {
    for (const powerup of state.powerups) {
      if (!powerup.active) continue;
      const def = POWERUP_DEFS[powerup.type];
      const cx = powerup.x + powerup.size / 2;
      const cy = powerup.y + powerup.size / 2;
      context.fillStyle = def.fill;
      context.globalAlpha = 0.9;
      context.beginPath();
      context.arc(cx, cy, powerup.size * 0.62, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.strokeStyle = def.fill;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(cx, cy, powerup.size * 0.72, 0, Math.PI * 2);
      context.stroke();
      drawPowerupGlyph(powerup.type, cx, cy, powerup.size * 0.34);
    }
  }

  function drawEngine(state) {
    const player = state.player;
    const color = COLORS[player.color].fill;
    const cx = player.x + SHIP.width / 2;
    const ey = player.y + SHIP.height;
    const g = context.createLinearGradient(0, ey, 0, ey + 22);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    context.globalAlpha = 0.55;
    context.fillStyle = g;
    context.beginPath();
    context.moveTo(cx - SHIP.width * 0.22, ey);
    context.lineTo(cx + SHIP.width * 0.22, ey);
    context.lineTo(cx, ey + 22);
    context.closePath();
    context.fill();
    context.globalAlpha = 1;
  }

  function drawShip(state) {
    const player = state.player;
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0) return;
    const color = COLORS[player.color].fill;
    const cx = player.x + SHIP.width / 2;
    const top = player.y - 6;
    const bottom = player.y + SHIP.height;
    drawEngine(state);
    if (player.shield > 0) {
      context.strokeStyle = '#7ff0ff';
      context.lineWidth = 3;
      context.globalAlpha = 0.9;
      context.beginPath();
      context.arc(cx, (top + bottom) / 2, SHIP.width * 0.78, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
    }
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
    const prog = (state.elapsed % LEVEL.seconds) / LEVEL.seconds;
    const bw = 160;
    context.fillStyle = 'rgba(255,255,255,0.22)';
    context.fillRect(FIELD.width / 2 - bw / 2, 54, bw, 5);
    context.fillStyle = COLORS[state.player.color].fill;
    context.fillRect(FIELD.width / 2 - bw / 2, 54, bw * prog, 5);
    // Lives, as hearts: the one icon that needs no label.
    const start = FIELD.width - 24 - LIVES * (LIFE_SIZE + LIFE_GAP) + LIFE_GAP;
    for (let life = 0; life < LIVES; life += 1) {
      const cx = start + life * (LIFE_SIZE + LIFE_GAP) + LIFE_SIZE / 2;
      const cy = 24 + LIFE_SIZE / 2;
      const s = LIFE_SIZE * 0.42;
      context.fillStyle = life < state.lives ? PALETTE.text : 'rgba(255,255,255,0.14)';
      context.beginPath();
      context.moveTo(cx, cy + s);
      context.bezierCurveTo(cx - s * 1.5, cy - s * 0.3, cx - s * 0.7, cy - s * 1.2, cx, cy - s * 0.35);
      context.bezierCurveTo(cx + s * 0.7, cy - s * 1.2, cx + s * 1.5, cy - s * 0.3, cx, cy + s);
      context.fill();
    }
    const ringY = 32;
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
      // The key that selects this colour, under its diamond: the legend doubles as a control hint.
      text(String(color.id + 1), cx, ringY + COLOR_SIZE + 6, 13, PALETTE.muted, 'center');
    }
    context.globalAlpha = 1;
    if (state.combo >= 2) text(comboLabel(state.combo), 24, 56, 22, PALETTE.gold, 'left');
    // Active-effect chips, top-left under the score, where nothing clips at the field edge.
    let chipY = 84;
    if (state.player.shield > 0) {
      text('SHIELD', 24, chipY, 18, '#7ff0ff', 'left');
      chipY += 24;
    }
    if (state.player.tripleTime > 0) {
      text(`TRIPLE ${Math.ceil(state.player.tripleTime)}s`, 24, chipY, 18, '#ffd24d', 'left');
      chipY += 24;
    }
    if (state.slowTime > 0) {
      text(`SLOW ${Math.ceil(state.slowTime)}s`, 24, chipY, 18, '#b18bff', 'left');
    }
  }

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
    text('Catch power-ups: shield, triple shot, slow-mo and bomb. Gold shards heal.', FIELD.width / 2, 508, 22, PALETTE.muted, 'center');
    text('Move with the mouse or \u2190 \u2192  \u00b7  colour with 1 2 3, Q W E or the wheel', FIELD.width / 2, 540, 22, PALETTE.muted, 'center');
    if (best > 0) text(bestLabel(best), FIELD.width / 2, 576, 24, PALETTE.muted, 'center');
    text('Press Space or click to begin', FIELD.width / 2, 636, 32, PALETTE.gold, 'center');
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
    const lines = [
      finalLabel(state.score),
      bestLabel(best),
      `${waveFinalLabel(state.maxLevel)} \u00b7 ${comboFinalLabel(state.bestCombo)}`,
      `${state.destroyed} shards \u00b7 ${state.powerupsCollected} power-ups`,
    ];
    drawPanel('Game Over', lines, 'Press Space or click to play again', COLORS[0].fill);
  }

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
    drawPowerups(state);
    drawShip(state);
    if (fx) fx.draw(context, view.scale);
    // A cinematic vignette: the corners fall into shadow, the action stays lit.
    const vg = context.createRadialGradient(FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42, FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(2,2,12,0.34)');
    context.fillStyle = vg;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume', PALETTE.text);
    else if (screen === SCREEN_OVER) drawOver(state, best);
  }

  function toFieldX(clientX) {
    return (clientX * dpr - view.x) / view.scale;
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toFieldX };
}