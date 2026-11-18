// Keyboard and pointer input. Held keys give a steering direction; the colour ring is switched by
// the number keys, the QWE keys, the mouse wheel or a click; one-shot presses (start, restart,
// pause, colour cycle) are queued as bit flags and taken once by the loop, so a press between two
// frames is never lost and never counted twice.
import { COLORS } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CYCLE = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

/** Map every colour key (Digit1..3 and KeyQ..E) to its colour index. */
function colorKeys() {
  const map = {};
  for (const color of COLORS) {
    map[color.key] = color.id;
    map[color.altKey] = color.id;
  }
  return map;
}

export function createInput(target) {
  let left = false;
  let right = false;
  let actions = 0;
  let pointerX = null;
  let wantedColor = null;

  const colorKey = colorKeys();

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (colorKey[event.code] !== undefined) wantedColor = colorKey[event.code];
    else return;
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });

  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
  });

  // The mouse steers (its x is read each frame) and cycles the colour by click and by wheel.
  window.addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
  });
  window.addEventListener('wheel', (event) => {
    if (event.deltaY !== 0) actions |= ACTION_CYCLE;
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM | ACTION_CYCLE;
  });

  return {
    /** -1 for left, 1 for right, 0 for neither or both. */
    direction() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** The pointer's client x, or null until the pointer has moved. */
    pointerX() {
      return pointerX;
    },
    /** The colour index the last colour gesture asked for, consumed once; null = none. */
    takeWantedColor() {
      const value = wantedColor;
      wantedColor = null;
      return value;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}