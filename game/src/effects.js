// Transient visual juice: a pool of glowing particles, short-lived floating score text and a
// screen-shake magnitude. These are updated and drawn on top of the field, in field coordinates,
// so the renderer sets its transform and then calls draw. Nothing here is part of the game's rules.
const MAX_PARTICLES = 420;
const MAX_FLOATS = 24;

export function createEffects() {
  const particles = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    particles.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0, size: 0, color: '#fff' });
  }
  const floats = [];
  for (let i = 0; i < MAX_FLOATS; i += 1) {
    floats.push({ alive: false, x: 0, y: 0, life: 0, max: 0, text: '', color: '#fff' });
  }
  let particleIndex = 0;
  let floatIndex = 0;
  let shake = 0;

  function nextParticle() {
    const p = particles[particleIndex];
    particleIndex = (particleIndex + 1) % MAX_PARTICLES;
    return p;
  }

  function nextFloat() {
    const f = floats[floatIndex];
    floatIndex = (floatIndex + 1) % MAX_FLOATS;
    return f;
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const p = nextParticle();
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 220;
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.max = p.life = 0.3 + Math.random() * 0.5;
      p.size = 2 + Math.random() * 4;
      p.color = color;
    }
  }

  function floatText(x, y, text, color) {
    const f = nextFloat();
    f.alive = true;
    f.x = x;
    f.y = y;
    f.max = f.life = 0.9;
    f.text = text;
    f.color = color;
  }

  function applyShake(amount) {
    shake = Math.min(14, shake + amount);
  }

  function update(dt) {
    for (const p of particles) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.94 + 0.02;
    }
    for (const f of floats) {
      if (!f.alive) continue;
      f.life -= dt;
      f.y -= 42 * dt;
      if (f.life <= 0) f.alive = false;
    }
    shake = Math.max(0, shake - shake * 5 * dt - 0.4 * dt);
  }

  /** The small random offset the current shake applies; the renderer adds it to the world view. */
  function shakeOffset() {
    if (shake <= 0) return 0;
    return (Math.random() * 2 - 1) * shake;
  }

  function draw(context, scale) {
    context.save();
    for (const p of particles) {
      if (!p.alive) continue;
      const t = p.life / p.max;
      context.globalAlpha = t;
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    if (floats.some((f) => f.alive)) {
      context.font = `${Math.round(22 * scale)}px system-ui, sans-serif`;
      context.textAlign = 'center';
      for (const f of floats) {
        if (!f.alive) continue;
        context.globalAlpha = Math.min(1, f.life / f.max);
        context.fillStyle = f.color;
        context.fillText(f.text, f.x, f.y);
      }
      context.globalAlpha = 1;
    }
    context.restore();
  }

  return { burst, floatText, applyShake, update, shakeOffset, draw };
}