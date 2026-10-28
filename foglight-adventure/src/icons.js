// Small inline SVG icons for the HUD and menus.

const svg = (body, vb = '0 0 32 32') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

const HEART_PATH = 'M16 28 C 6 20, 2 15, 2 10 C 2 5.5, 5.5 2.5, 9.5 2.5 C 12.5 2.5, 14.8 4.3, 16 6.8 C 17.2 4.3, 19.5 2.5, 22.5 2.5 C 26.5 2.5, 30 5.5, 30 10 C 30 15, 26 20, 16 28 Z';

export function heartIcon(fill) {
  // fill: 0 empty, 1 half, 2 full
  return svg(`
    <defs><clipPath id="hh"><rect x="0" y="0" width="16" height="32"/></clipPath></defs>
    <path d="${HEART_PATH}" fill="#3a2430" stroke="#1a0e14" stroke-width="2.4" stroke-linejoin="round"/>
    ${fill === 2 ? `<path d="${HEART_PATH}" fill="#f0405a"/><path d="M8 7 C 6 7.5, 5 9, 5.2 11" stroke="#ffd0d8" stroke-width="2.4" fill="none" stroke-linecap="round"/>` : ''}
    ${fill === 1 ? `<path d="${HEART_PATH}" fill="#f0405a" clip-path="url(#hh)"/><path d="M8 7 C 6 7.5, 5 9, 5.2 11" stroke="#ffd0d8" stroke-width="2.4" fill="none" stroke-linecap="round"/>` : ''}
  `);
}

export const ICONS = {
  shell: svg(`<path d="M16 28 L4 12 C 6 6, 11 3.5, 16 3.5 C 21 3.5, 26 6, 28 12 Z" fill="#ff9a8a" stroke="#7a2e2a" stroke-width="2" stroke-linejoin="round"/>
    <path d="M16 28 L10 6 M16 28 L16 4 M16 28 L22 6 M16 28 L6 10 M16 28 L26 10" stroke="#c8564a" stroke-width="1.6"/>
    <rect x="12" y="25" width="8" height="4" rx="1.5" fill="#ff9a8a" stroke="#7a2e2a" stroke-width="1.6"/>`),
  key: svg(`<circle cx="11" cy="11" r="6.5" fill="none" stroke="#f2c23c" stroke-width="4"/><path d="M15.5 15.5 L27 27 M22 22 L19 25 M25.5 25.5 L23 28" stroke="#f2c23c" stroke-width="4" stroke-linecap="round"/>`),
  bigKey: svg(`<circle cx="11" cy="11" r="7" fill="none" stroke="#f2c23c" stroke-width="4.5"/><circle cx="11" cy="11" r="2.6" fill="#ff5a6a"/><path d="M16 16 L28 28 M22.5 22.5 L19 26 M26 26 L23 29" stroke="#f2c23c" stroke-width="4.5" stroke-linecap="round"/>`),
  boomerang: svg(`<path d="M3 20 C 6 10, 12 6, 16 12 C 20 6, 26 10, 29 20 C 25 15, 20 15, 16 18 C 12 15, 7 15, 3 20 Z" fill="#5cc65a" stroke="#235a24" stroke-width="2" stroke-linejoin="round"/><path d="M5 18 C 10 14, 13 14, 16 16 C 19 14, 22 14, 27 18" stroke="#2f7a32" stroke-width="1.5" fill="none"/>`),
  bombs: svg(`<rect x="11" y="22" width="10" height="6" rx="2" fill="#f4e8cc" stroke="#6a4a2a" stroke-width="1.8"/><circle cx="16" cy="15" r="10" fill="#e04a3a" stroke="#6a1a14" stroke-width="2"/><circle cx="12" cy="11" r="2.2" fill="#fff4e0"/><circle cx="19" cy="9" r="1.6" fill="#fff4e0"/><circle cx="21" cy="16" r="2" fill="#fff4e0"/><circle cx="13" cy="18" r="1.4" fill="#fff4e0"/><path d="M16 5 L17 2" stroke="#6a4a2a" stroke-width="2" stroke-linecap="round"/><circle cx="17.5" cy="2" r="1.6" fill="#ffcf4a"/>`),
  bow: svg(`<path d="M8 3 C 22 8, 22 24, 8 29" fill="none" stroke="#9a6a3a" stroke-width="3.2" stroke-linecap="round"/><path d="M8 3 L8 29" stroke="#f4f0e4" stroke-width="1.4"/><path d="M4 16 L26 16" stroke="#c49a64" stroke-width="2"/><path d="M26 16 L22 13.5 L22 18.5 Z" fill="#c8ccd4"/><path d="M4 16 L2 13 M4 16 L2 19" stroke="#e04848" stroke-width="2"/>`),
  feather: svg(`<path d="M24 3 C 12 6, 6 16, 7 27 C 16 26, 26 16, 24 3 Z" fill="#f8f8ff" stroke="#6a8ab0" stroke-width="2" stroke-linejoin="round"/><path d="M5 30 L20 10" stroke="#6a8ab0" stroke-width="2" stroke-linecap="round"/><path d="M10 21 L14 21 M12 17 L17 17 M15 13 L20 12" stroke="#a8c4e4" stroke-width="1.5"/>`),
  frost: svg(`<path d="M8 29 L17 13" stroke="#8a6a4a" stroke-width="3.2" stroke-linecap="round"/><path d="M20 3 L25 10 L20 17 L15 10 Z" fill="#9ae6ff" stroke="#2a6a8a" stroke-width="2" stroke-linejoin="round"/><path d="M20 6 L20 14 M17 10 L23 10" stroke="#ffffff" stroke-width="1.4"/><circle cx="27" cy="4" r="1.3" fill="#d8f4ff"/><circle cx="12" cy="7" r="1" fill="#d8f4ff"/>`),
  sword: svg(`<path d="M25 3 L28 4 L27 7 L12 22 L9 19 Z" fill="#e4ecf4" stroke="#5a6a7a" stroke-width="1.8" stroke-linejoin="round"/><path d="M6 17 L14 25" stroke="#f2c23c" stroke-width="3.2" stroke-linecap="round"/><path d="M9 22 L4 27" stroke="#6a3e22" stroke-width="3.4" stroke-linecap="round"/>`),
  sunstone: svg(`<g stroke="#ffb030" stroke-width="2.4" stroke-linecap="round"><path d="M16 1 L16 5 M16 27 L16 31 M1 16 L5 16 M27 16 L31 16 M5 5 L8 8 M24 24 L27 27 M27 5 L24 8 M8 24 L5 27"/></g><path d="M16 7 L23 16 L16 25 L9 16 Z" fill="#ffd25a" stroke="#c87a10" stroke-width="2" stroke-linejoin="round"/>`),
  heartPiece: svg(`<path d="${HEART_PATH}" fill="#3a2430" opacity="0.35"/><path d="M16 6.8 C 14.8 4.3, 12.5 2.5, 9.5 2.5 C 5.5 2.5, 2 5.5, 2 10 C 2 12.5, 3 15, 5 17.5 L16 17.5 Z" fill="#f0405a" stroke="#1a0e14" stroke-width="1.8"/>`),
  map: svg(`<path d="M3 7 L11 4 L21 7 L29 4 L29 25 L21 28 L11 25 L3 28 Z" fill="#f0e2c0" stroke="#7a5a32" stroke-width="2" stroke-linejoin="round"/><path d="M11 4 L11 25 M21 7 L21 28" stroke="#7a5a32" stroke-width="1.5"/><path d="M14 13 L18 17 M18 13 L14 17" stroke="#e04848" stroke-width="2.2" stroke-linecap="round"/>`),
  arrow: svg(`<path d="M4 28 L24 8" stroke="#c49a64" stroke-width="2.6" stroke-linecap="round"/><path d="M28 4 L20 7 L25 12 Z" fill="#c8ccd4" stroke="#5a6a7a" stroke-width="1.2"/><path d="M4 28 L4 23 M4 28 L9 28" stroke="#e04848" stroke-width="2.4" stroke-linecap="round"/>`),
};
