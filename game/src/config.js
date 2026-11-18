// Every tuning number, colour and the colour set live here, in one place. The playfield is a
// fixed 1280x720 logical area; the renderer scales it to the window, so no rule depends on the
// screen size. PRISMATIC is a colour-matching arcade game: the prism ship fires a beam of its
// current colour, such a beam shatters a shard of the same colour and splits one of a different
// colour, and a shard that reaches the bottom edge costs a life.

export const FIELD = { width: 1280, height: 720, groundY: 700 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The three beam/shield colours the ship cycles through, in fixed order. Each also names its
 *  keyboard key (Digit1..3 and KeyQ..E) and the canvas colour used for its shards and beam. */
export const COLORS = [
  { id: 0, name: 'rose',        hue: 350, key: 'Digit1', altKey: 'KeyQ', fill: '#ff4d6d' },
  { id: 1, name: 'mint',        hue: 158, key: 'Digit2', altKey: 'KeyW', fill: '#2cf08f' },
  { id: 2, name: 'azure',       hue: 214, key: 'Digit3', altKey: 'KeyE', fill: '#4d8bff' },
];

/** The player's prism ship: size, steering speed, fire rate and the beam it projects. */
export const SHIP = {
  width: 56,
  height: 40,
  speed: 660,
  invulnerable: 1.4,
  y: FIELD.groundY - 56,
};

export const BEAM = {
  width: 6,
  speed: 780,
  fireInterval: 0.14,
  max: 24,
};

/** A falling shard: size, speed and how it grows each level, and how a wrong-colour hit splits it. */
export const SHARD = {
  size: 44,
  speed: 150,
  speedPerLevel: 26,
  speedJitter: 70,
  interval: 0.55,
  intervalScale: 0.9,
  minInterval: 0.16,
  splitCount: 2,
  splitLevelFade: 0.5,
  points: 10,
};

/** The gold bonus shard: worth points and a life now and then; it never splits. */
export const GOLD = {
  size: 28,
  speed: 175,
  speedPerLevel: 12,
  interval: 9,
  intervalJitter: 4,
  points: 60,
  lifeEvery: 4,
};

/** A falling power-up: touch one with the ship to arm it. */
export const POWERUP = {
  size: 26,
  speed: 115,
  interval: 11,
  intervalJitter: 5,
  points: 25,
};

/** The four power-ups: shield (absorb a hit), triple (three beams), slow (halve shard speed),
 *  bomb (clear every shard on screen). duration 0 means it acts once, not over time. */
export const POWERUP_DEFS = {
  shield: { fill: '#7ff0ff', duration: 0, label: 'SHIELD' },
  triple: { fill: '#ffd24d', duration: 9, label: 'TRIPLE' },
  slow: { fill: '#b18bff', duration: 6, label: 'SLOW' },
  bomb: { fill: '#ff8c5a', duration: 0, label: 'BOMB' },
};

export const POWERUP_ORDER = ['shield', 'triple', 'slow', 'bomb'];

/** Seconds of play per level and the last level: speeds and spawn rates stop growing there. */
export const LEVEL = { seconds: 14, max: 12 };

/** How many live objects can exist at once; the pools are allocated once, at boot, never grown. */
export const POOL_SHARDS = 112;
export const POOL_BEAMS = 40;
export const POOL_POWERUPS = 6;

export const LIVES = 3;

/** The streak bonus: a match on the Nth same-colour hit in a row is worth points * (1 + N/4). */
export const COMBO_MAX = 9;

export const PALETTE = {
  backdrop: '#070a14',
  voidA: '#101d33',
  voidB: '#1b3260',
  star: '#33507f',
  panel: '#182642',
  panelEdge: '#3c5c8f',
  text: '#eef2ff',
  muted: '#a3b0cf',
  gold: '#ffd24d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'prismatic.best';