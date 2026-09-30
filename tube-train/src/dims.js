// Dimensions of the Victoria line's 2009 Stock, in metres.
//
// Most of these come from TfL's rolling stock data sheet for the 2009 Stock
// (January 2011) and the scale elevations on it; the rest are read off
// photographs. x runs along a car, y is the height above the top of the rails
// and z runs across the car (+z is the right-hand side looking towards +x).

export const TRACK = {
  gauge: 1.435,
  railHead: 0.07,            // width of the running rail's head
  railHeight: 0.145,
  // the positive conductor rail is outside the running rails, the negative one
  // between them; both stand a little higher than the running rails
  positiveZ: -(1.435 / 2 + 0.406),
  positiveTop: 0.076,
  negativeTop: 0.038,
};

export const BODY = {
  width: 2.616,
  height: 2.883,
  floor: 0.735,              // centre floor level above the rail
  bottom: 0.585,             // lower edge of the body sides
  sideTop: 1.62,             // where the sides start curving in towards the roof
  wall: 0.075,               // skin to inside lining
  blueTop: 1.10,             // top of the blue band along the bottom of the sides
  roofLine: 2.70,            // above this the roof is painted grey
  window: { sill: 0.735 + 0.8815, head: 0.735 + 0.8815 + 0.453, width: 1.65, radius: 0.085 },
  doorWindow: { sill: 0.735 + 0.7855, head: 0.735 + 0.7855 + 0.895, width: 0.565, radius: 0.085 },
  doorTop: 2.645,            // top of the door leaves
  openingTop: 2.60,          // top of the doorway behind them
  leafBottom: 0.70,
  leafWidth: 0.88,
  leafProud: 0.03,           // the doors hang on the outside of the body
  doorTravel: 0.80,
};

export const COUPLER = 0.12; // from the body end to the coupler face (0.1675 at the cab end)

export const BOGIE = {
  wheelRadius: 0.37,         // 740 mm new
  wheelbase: 2.05,
};

// Positions along a car are given here as distances from its "front" end, the
// cab end of a driving car, like the elevations on the data sheet. Each door
// is the doorway and the leaf (or leaves) that cover it.
function doubleDoor(centre) {
  return {
    doorway: [centre - 0.8, centre + 0.8],
    leaves: [
      { span: [centre - 0.88, centre], window: [centre - 0.70, centre - 0.135], opens: -1 },
      { span: [centre, centre + 0.88], window: [centre + 0.135, centre + 0.70], opens: +1 },
    ],
  };
}

// a single door at the far end of a car section; `opens` is the way it slides
function singleDoor(doorway, leaf, window, opens) {
  return { doorway, leaves: [{ span: leaf, window, opens }] };
}

// Trailer and non-driving motor cars (B, C and D): 16.345 m over the body
// ends, two double doors and a single door at each end on each side.
const B_LENGTH = 16.345;
export const B_CAR = {
  length: B_LENGTH,
  windows: [[2.3325, 3.9825], [7.3475, 8.9975], [12.3625, 14.0125]],
  doors: [
    singleDoor([0.70, 1.50], [0.67, 1.54], [0.82, 1.385], +1),
    doubleDoor(5.665),
    doubleDoor(10.68),
    singleDoor([B_LENGTH - 1.50, B_LENGTH - 0.70], [B_LENGTH - 1.54, B_LENGTH - 0.67], [B_LENGTH - 1.385, B_LENGTH - 0.82], -1),
  ],
  bogies: [3.125, B_LENGTH - 3.125],
  seatBays: [[1.56, 4.80], [6.53, 9.815], [11.545, 14.785]],
  shoes: false,
};

// Driving motor cars (A): 16.595 m, with the cab at the front, a cab door
// behind it, and a single door only at the inner end.
const A_LENGTH = 16.595;
export const A_CAR = {
  length: A_LENGTH,
  nose: 0.755,               // the rounded front, before the sides run straight
  cabDoor: { doorway: [0.84, 1.52], leaves: [{ span: [0.80, 1.56], window: [0.888, 1.453], opens: +1 }] },
  cabBack: 1.95,             // bulkhead between the cab and the saloon
  windows: [[2.5825, 4.2325], [7.5975, 9.2475], [12.6125, 14.2625]],
  doors: [
    doubleDoor(5.915),
    doubleDoor(10.93),
    singleDoor([A_LENGTH - 1.50, A_LENGTH - 0.70], [A_LENGTH - 1.54, A_LENGTH - 0.67], [A_LENGTH - 1.385, A_LENGTH - 0.82], -1),
  ],
  bogies: [3.375, A_LENGTH - 3.125],
  seatBays: [[2.00, 5.05], [6.78, 10.065], [11.795, 15.035]],
  shoes: true,
};

// The eight cars run A-B-C-D + D-C-B-A, the two units coupled back to back.
export const FORMATION = ['A', 'B', 'C', 'D', 'D', 'C', 'B', 'A'];

export const COLOURS = {
  red: 0xdc241f,             // doors and cab
  white: 0xeeeeea,
  blue: 0x0a1f8c,            // the band along the bottom of the sides
  roof: 0xb9bcbe,
  mask: 0x2b2e33,            // the dark panel around the windscreens
  victoria: 0x0098d4,        // the line's colour
  pole: 0x1f63c8,            // grab poles inside
};
