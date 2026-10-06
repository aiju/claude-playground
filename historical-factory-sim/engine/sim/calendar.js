// Dates, times and working timetables.
//
// Sim time is minutes since the scenario's epoch (midnight at the start of
// its first day, in the scenario's civil time). We do the date arithmetic with
// UTC Date objects, so there are no daylight-saving jumps: right for Britain
// before 1916, and for any scenario that keeps one civil time all year.

export const MIN_PER_DAY = 24 * 60;
const MS_PER_MIN = 60 * 1000;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

export class Calendar {
  constructor({ year, month = 1, day = 1 }) {
    this.epochMs = Date.UTC(year, month - 1, day);
  }

  parts(t) {
    const d = new Date(this.epochMs + Math.floor(t) * MS_PER_MIN);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      dow: d.getUTCDay(),
    };
  }

  at(year, month, day, hour = 0, minute = 0) {
    return (Date.UTC(year, month - 1, day, hour, minute) - this.epochMs) / MS_PER_MIN;
  }

  // "1913-03-03"
  dateKey(t) {
    const p = this.parts(t);
    return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  }

  dayStart(t) {
    return Math.floor(t / MIN_PER_DAY) * MIN_PER_DAY;
  }

  minuteOfDay(t) {
    return t - this.dayStart(t);
  }

  dow(t) {
    return this.parts(t).dow;
  }

  dayName(t) {
    return DAY_NAMES[this.dow(t)];
  }

  // "Monday 3 March 1913"
  longDate(t) {
    const p = this.parts(t);
    return `${DAY_NAMES[p.dow]} ${p.day} ${MONTH_NAMES[p.month - 1]} ${p.year}`;
  }

  // "3rd March, 1913", as written at the head of a letter or form
  docDate(t) {
    const p = this.parts(t);
    return `${p.day}${ordinal(p.day)} ${MONTH_NAMES[p.month - 1]}, ${p.year}`;
  }

  // "3/3/13"
  shortDate(t) {
    const p = this.parts(t);
    return `${p.day}/${p.month}/${String(p.year).slice(2)}`;
  }

  // "10.42 a.m.", "12 noon", "5.30 p.m."
  clockTime(t) {
    const p = this.parts(t);
    if (p.hour === 12 && p.minute === 0) return '12 noon';
    if (p.hour === 0 && p.minute === 0) return '12 midnight';
    const h12 = ((p.hour + 11) % 12) + 1;
    const ampm = p.hour < 12 ? 'a.m.' : 'p.m.';
    return `${h12}.${pad(p.minute)} ${ampm}`;
  }

  // "06:00", for logs and dense tables
  hhmm(t) {
    const p = this.parts(t);
    return `${pad(p.hour)}:${pad(p.minute)}`;
  }

  monthName(month) {
    return MONTH_NAMES[month - 1];
  }
}

// A working timetable: spells of work for each day of the week, minus
// holidays. Spells are [start, end) in minutes after midnight.
//
//   new Timetable(cal, {
//     days: { 1: [[360, 480], [510, 750], [810, 1020]], 6: [[360, 480], [510, 720]] },
//     holidays: ['1913-03-21'],
//   })
export class Timetable {
  constructor(calendar, { days, holidays = [] }) {
    this.cal = calendar;
    this.days = {};
    for (let d = 0; d < 7; d++) this.days[d] = (days[d] || []).map(([a, b]) => [a, b]);
    this.holidays = new Set(holidays);
  }

  isHoliday(t) {
    return this.holidays.has(this.cal.dateKey(t));
  }

  // Absolute [start, end] spells on the day containing t.
  spellsOn(t) {
    if (this.isHoliday(t)) return [];
    const day0 = this.cal.dayStart(t);
    return this.days[this.cal.dow(t)].map(([a, b]) => [day0 + a, day0 + b]);
  }

  currentSpell(t) {
    for (const s of this.spellsOn(t)) if (t >= s[0] && t < s[1]) return s;
    return null;
  }

  isWorking(t) {
    return this.currentSpell(t) !== null;
  }

  // The first spell that starts at or after t, or the one in progress.
  nextSpell(t) {
    let day = this.cal.dayStart(t);
    for (let i = 0; i < 400; i++, day += MIN_PER_DAY) {
      for (const s of this.spellsOn(day)) if (s[1] > t) return s;
    }
    return null;
  }

  // Last spell of the working day that contains or follows t.
  lastSpellOfDay(t) {
    const s = this.nextSpell(t);
    if (!s) return null;
    const spells = this.spellsOn(s[0]);
    return spells[spells.length - 1];
  }

  // Working minutes in [t0, t1).
  workingMinutes(t0, t1) {
    let total = 0;
    let day = this.cal.dayStart(t0);
    for (; day < t1; day += MIN_PER_DAY) {
      for (const [a, b] of this.spellsOn(day)) {
        const lo = Math.max(a, t0);
        const hi = Math.min(b, t1);
        if (hi > lo) total += hi - lo;
      }
    }
    return total;
  }

  weeklyHours() {
    let total = 0;
    for (let d = 0; d < 7; d++) for (const [a, b] of this.days[d]) total += b - a;
    return total / 60;
  }
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function ordinal(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
}
