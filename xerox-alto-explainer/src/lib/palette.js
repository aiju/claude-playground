// The whole video uses five colours: the Alto's black-on-white, plus the
// three mouse-button names (the Alto's buttons were called RED, YELLOW and
// BLUE). Every frame is snapped to this palette after drawing.

export const PAL = {
  paper: [238, 235, 225],
  ink: [20, 20, 22],
  red: [214, 44, 52],
  yellow: [244, 184, 20],
  blue: [34, 92, 176],
};

export const css = (name) => {
  const [r, g, b] = PAL[name];
  return `rgb(${r},${g},${b})`;
};

export const PALETTE_LIST = Object.values(PAL);
