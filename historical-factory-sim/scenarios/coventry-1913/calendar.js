// The working timetables of the Sherbourne Works, 1913.
//
// Works hours follow a 53-hour week, the Coventry engineering standard in the
// Trades Council's 1913 report; the daily spells are a reconstruction (est.)
// that fits the 1910 agreement between the Coventry and District Engineering
// Employers' Association and the unions, and the Factory and Workshop Act
// 1901 limits for women and young persons. No documented 1913 Coventry
// timetable survives. Office and engine-house hours are estimates.
import { Timetable } from '../../engine/sim/calendar.js';

const hm = (h, m = 0) => h * 60 + m;

// Good Friday, Easter Monday, Whit Monday, August Bank Holiday, Christmas
// Day and Boxing Day, 1913. Unpaid for works hands.
export const HOLIDAYS = ['1913-03-21', '1913-03-24', '1913-05-12', '1913-08-04', '1913-12-25', '1913-12-26'];

const weekdays = (spells) => ({ 1: spells, 2: spells, 3: spells, 4: spells, 5: spells });

export function makeTimetables(cal) {
  const works = new Timetable(cal, {
    days: {
      ...weekdays([[hm(6), hm(8)], [hm(8, 30), hm(12, 30)], [hm(13, 30), hm(17)]]),
      6: [[hm(6), hm(8)], [hm(8, 30), hm(12)]],
    },
    holidays: HOLIDAYS,
  });
  const office = new Timetable(cal, {
    days: {
      ...weekdays([[hm(9), hm(13)], [hm(14), hm(18)]]),
      6: [[hm(9), hm(13)]],
    },
    holidays: HOLIDAYS,
  });
  // Works staff (works office, wages, stores clerks): in before the
  // commercial office, out after the works stops.
  const worksStaff = new Timetable(cal, {
    days: {
      ...weekdays([[hm(8), hm(12, 30)], [hm(13, 30), hm(17, 30)]]),
      6: [[hm(8), hm(12, 30)]],
    },
    holidays: HOLIDAYS,
  });
  // The wages clerks stay on on Friday to pay out, and on Thursday, which is
  // pay day in a week with a Good Friday in it.
  const wages = new Timetable(cal, {
    days: {
      1: [[hm(8), hm(12, 30)], [hm(13, 30), hm(17, 30)]], 2: [[hm(8), hm(12, 30)], [hm(13, 30), hm(17, 30)]],
      3: [[hm(8), hm(12, 30)], [hm(13, 30), hm(17, 30)]], 4: [[hm(8), hm(12, 30)], [hm(13, 30), hm(18, 45)]],
      5: [[hm(8), hm(12, 30)], [hm(13, 30), hm(18, 45)]],
      6: [[hm(8), hm(12, 30)]],
    },
    holidays: HOLIDAYS,
  });
  // The stokers come in to raise steam before the works starts, and the
  // engine-house crew eat at their posts.
  const engine = new Timetable(cal, {
    days: {
      ...weekdays([[hm(4, 45), hm(17, 30)]]),
      6: [[hm(4, 45), hm(12, 30)]],
    },
    holidays: HOLIDAYS,
  });
  // The gatekeeper opens up before the hands arrive.
  const gate = new Timetable(cal, {
    days: {
      ...weekdays([[hm(5, 30), hm(12, 30)], [hm(13, 15), hm(18, 30)]]),
      6: [[hm(5, 30), hm(13)]],
    },
    holidays: HOLIDAYS,
  });
  // Carmen: the horses are fed and harnessed before the works starts, and
  // the last lorry gets back from the goods yard after it stops (est.).
  const carmen = new Timetable(cal, {
    days: {
      ...weekdays([[hm(6), hm(8)], [hm(8, 30), hm(12, 30)], [hm(13, 30), hm(18, 30)]]),
      6: [[hm(6), hm(8)], [hm(8, 30), hm(13)]],
    },
    holidays: HOLIDAYS,
  });
  return { works, office, worksStaff, wages, engine, gate, carmen };
}
