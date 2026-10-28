// Lighting presets for each kind of place.

import { hexLin } from '../math.js';

export const ENVS = {
  day: (g) => {
    const clear = g.flag('lighthouseLit');
    return {
      sunDir: [-0.42, 1, 0.38],
      sunCol: clear ? [0.86, 0.79, 0.66] : [0.8, 0.77, 0.7],
      skyCol: clear ? [0.34, 0.39, 0.48] : [0.36, 0.39, 0.45],
      gndCol: [0.17, 0.15, 0.12],
      fogCol: clear ? [0.62, 0.78, 0.92] : [0.62, 0.66, 0.72],
      fog: [1, 14, clear ? 0.35 : 0.5],
      clear: clear ? [0.55, 0.75, 0.9] : [0.58, 0.62, 0.68],
      gloom: clear ? 0 : 0.5,
      gloomCol: [0.7, 0.73, 0.78],
    };
  },
  cave: {
    sunDir: [-0.3, 1, 0.5], sunCol: [0.12, 0.11, 0.1], skyCol: [0.1, 0.1, 0.12], gndCol: [0.06, 0.05, 0.05],
    fogCol: [0.02, 0.02, 0.03], fog: [0, 9, 0.9], clear: [0.02, 0.02, 0.03], heroLight: [5.5, 1.1, 0.85, 0.55], rim: 0.15,
  },
  house: {
    sunDir: [-0.3, 1, 0.6], sunCol: [0.42, 0.36, 0.28], skyCol: [0.36, 0.3, 0.24], gndCol: [0.2, 0.15, 0.1],
    fogCol: [0.03, 0.02, 0.02], fog: [2, 12, 0.8], clear: [0.03, 0.02, 0.02], rim: 0.2,
  },
  shrine: {
    sunDir: [-0.35, 1, 0.45], sunCol: [0.2, 0.3, 0.32], skyCol: [0.14, 0.2, 0.22], gndCol: [0.06, 0.08, 0.08],
    fogCol: [0.02, 0.05, 0.06], fog: [0, 10, 0.9], clear: [0.01, 0.03, 0.04], heroLight: [4.5, 0.6, 0.75, 0.8], rim: 0.25,
    deep: hexLin(0x0f4a5a), shallow: hexLin(0x2f9aa8),
  },
  lighthouse: {
    sunDir: [-0.4, 1, 0.4], sunCol: [0.3, 0.3, 0.34], skyCol: [0.22, 0.22, 0.28], gndCol: [0.1, 0.09, 0.1],
    fogCol: [0.04, 0.04, 0.06], fog: [0, 10, 0.9], clear: [0.03, 0.03, 0.05], heroLight: [4.5, 0.9, 0.8, 0.7], rim: 0.25,
  },
};
