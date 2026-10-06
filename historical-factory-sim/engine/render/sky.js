// The sun's position for a place and a moment, and the sky and light that
// go with it.
import * as THREE from 'three';

const RAD = Math.PI / 180;

// Solar elevation and azimuth (radians; azimuth clockwise from north) for a
// civil time that is mean time at longitude 0 (GMT). A standard
// approximation, good to a fraction of a degree, which is plenty for shadows.
export function sunPosition(dayOfYear, minutesGMT, latDeg, lonDeg) {
  const g = (2 * Math.PI / 365) * (dayOfYear - 1 + (minutesGMT / 60 - 12) / 24);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const trueSolar = minutesGMT + eqTime + 4 * lonDeg;
  const ha = (trueSolar / 4 - 180) * RAD;
  const lat = latDeg * RAD;
  const cosZen = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const zen = Math.acos(Math.max(-1, Math.min(1, cosZen)));
  const elevation = Math.PI / 2 - zen;
  let az = Math.acos(Math.max(-1, Math.min(1, (Math.sin(lat) * Math.cos(zen) - Math.sin(decl)) / (Math.cos(lat) * Math.sin(zen)))));
  az = ha > 0 ? (az + Math.PI) % (2 * Math.PI) : (3 * Math.PI - az) % (2 * Math.PI);
  return { elevation, azimuth: az };
}

// Unit vector towards the sun in scene axes (x east, y up, z south).
export function sunDirection({ elevation, azimuth }, out = new THREE.Vector3()) {
  const ce = Math.cos(elevation);
  return out.set(ce * Math.sin(azimuth), Math.sin(elevation), -ce * Math.cos(azimuth));
}

const NIGHT = new THREE.Color('#1d2a3f');
const DAWN = new THREE.Color('#c9a58a');
const DAY = new THREE.Color('#b8c4c8'); // a smoky Midlands sky, not a blue one
const HAZE = new THREE.Color('#a7a49a');

// Sky colour, sun and ambient intensities from the sun's elevation.
export function lighting(elevation) {
  const e = elevation / RAD; // degrees
  const day = smooth(-6, 10, e);
  const golden = smooth(-4, 3, e) * (1 - smooth(4, 18, e));
  const sky = NIGHT.clone().lerp(DAY, day).lerp(DAWN, golden * 0.6);
  const fog = sky.clone().lerp(HAZE, 0.35 * day);
  return {
    sky,
    fog,
    sun: 2.6 * smooth(-1, 12, e),
    sunColour: new THREE.Color('#fff1dc').lerp(new THREE.Color('#ffb070'), golden),
    // Night is kept light enough to watch: moonlight, gaslight and a
    // forgiving eye.
    hemi: 1.15 + 0.15 * day,
    night: 1 - day,
  };
}

function smooth(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
