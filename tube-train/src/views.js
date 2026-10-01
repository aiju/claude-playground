// Camera presets, grouped by where they are: the depot, the tunnel, or a
// station. Positions are in metres, with the front of the train at x = 0 and
// the train running back along -x. Station views are in the station's own
// coordinates (x from 0 where the trains come in, the platform on the +z
// side) and move with it.
//
// `look` views are from a fixed spot (inside the train): dragging turns the
// camera rather than orbiting it. `trackside` stands in the tunnel instead of
// riding with the train. Other tunnel views ride with the car they are next
// to, except `follow: 'track'` ones, which keep to the track a fixed distance
// from the front of the train (x along it, so the target is on the track
// too), and so see the train swing round the bends.

export const VIEWS = {
  front:     { group: 'depot',   label: 'Front',     pos: [6.2, 1.9, 5.2],      target: [-3.5, 1.35, 0] },
  side:      { group: 'depot',   label: 'Side',      pos: [-8.6, 1.5, 10.5],    target: [-8.6, 1.45, 0] },
  along:     { group: 'depot',   label: 'Along',     pos: [-24, 3.1, -5.2],     target: [-6, 1.3, 0] },
  bogie:     { group: 'depot',   label: 'Bogie',     pos: [-1.6, 0.55, 2.7],    target: [-3.4, 0.42, 0] },
  saloon:    { group: 'depot',   label: 'Inside',    pos: [-15.2, 1.62, 0.25],  target: [-3.0, 1.45, -0.05], fov: 62, look: true },
  tunnel:    { group: 'tunnel',  label: 'Chase',     pos: [9, 2.05, 0.3],       target: [-10, 1.45, 0], fov: 50, follow: 'track' },
  cab:       { group: 'tunnel',  label: 'Cab',       pos: [-0.95, 2.02, -0.74], target: [30, 1.25, -0.45], fov: 62, look: true },
  passing:   { group: 'tunnel',  label: 'Alongside', pos: [-4.5, 1.72, 1.58],   target: [-40, 1.45, 0.9] },
  window:    { group: 'tunnel',  label: 'Window',    pos: [-22.4, 1.75, -0.35],  target: [-22.9, 1.7, 3.0], fov: 60, look: true },
  trackside: { group: 'tunnel',  label: 'Trackside', pos: [0, 1.1, 1.35],       target: [30, 1.4, 0], trackside: true },
  platform:  { group: 'station', label: 'Platform',  pos: [84, 2.35, 3.5],      target: [35, 1.5, 0.6], anchor: 'station' },
  arriving:  { group: 'station', label: 'Arriving',  pos: [137.4, 2.3, 2.35],   target: [100, 1.4, 0.1], anchor: 'station' },
  doorway:   { group: 'station', label: 'Doors',     pos: [116.6, 2.25, 3.9],   target: [114.3, 1.45, 1.0], anchor: 'station' },
};

for (const v of Object.values(VIEWS)) v.scene = v.group === 'depot' ? 'depot' : 'tunnel';

// the view each place opens on
export const DEFAULT_VIEW = { depot: 'front', tunnel: 'tunnel', station: 'platform' };

export const DESTINATIONS = ['Walthamstow Central', 'Brixton', 'Seven Sisters', 'Victoria', 'Northumberland Park'];
