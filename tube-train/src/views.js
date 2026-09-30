// Camera presets. Positions are in metres, with the front of the train at
// x = 0 and the train running back along -x; `scene` is where each one is set.
// `look` views are from a fixed spot (inside the train): dragging turns the
// camera rather than orbiting it. `trackside` stands in the tunnel instead of
// riding with the train.

export const VIEWS = {
  front:     { scene: 'depot',  label: 'Front',     pos: [6.2, 1.9, 5.2],      target: [-3.5, 1.35, 0] },
  side:      { scene: 'depot',  label: 'Side',      pos: [-8.6, 1.5, 10.5],    target: [-8.6, 1.45, 0] },
  along:     { scene: 'depot',  label: 'Along',     pos: [-24, 3.1, -5.2],     target: [-6, 1.3, 0] },
  bogie:     { scene: 'depot',  label: 'Bogie',     pos: [-1.6, 0.55, 2.7],    target: [-3.4, 0.42, 0] },
  saloon:    { scene: 'depot',  label: 'Inside',    pos: [-15.2, 1.62, 0.25],  target: [-3.0, 1.45, -0.05], fov: 62, look: true },
  tunnel:    { scene: 'tunnel', label: 'Chase',     pos: [5.5, 1.75, 1.05],    target: [-6, 1.35, 0] },
  cab:       { scene: 'tunnel', label: 'Cab',       pos: [-0.95, 2.02, -0.74], target: [30, 1.25, -0.45], fov: 62, look: true },
  passing:   { scene: 'tunnel', label: 'Alongside', pos: [-4.5, 1.72, 1.58],   target: [-40, 1.45, 0.9] },
  window:    { scene: 'tunnel', label: 'Window',    pos: [-22.4, 1.75, -0.35], target: [-22.9, 1.7, 3.0], fov: 60, look: true },
  trackside: { scene: 'tunnel', label: 'Trackside', pos: [0, 1.1, 1.35],       target: [30, 1.4, 0], trackside: true },
};

// the view each scene opens on
export const DEFAULT_VIEW = { depot: 'front', tunnel: 'tunnel' };

export const DESTINATIONS = ['Walthamstow Central', 'Brixton', 'Seven Sisters', 'Victoria', 'Northumberland Park'];
