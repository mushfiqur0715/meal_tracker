export function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toDateKey(year: number, month1to12: number, day: number) {
  return `${year}-${pad2(month1to12)}-${pad2(day)}`;
}

export function toMonthKey(year: number, month1to12: number) {
  return `${year}-${pad2(month1to12)}`;
}

export function parseMonthKey(monthKey: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 1900 || year > 2200) return null;
  return { year, month };
}

export function parseDateKey(dateKey: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  const dim = daysInMonth(year, month);
  if (day < 1 || day > dim) return null;
  if (year < 1900 || year > 2200) return null;
  return { year, month, day };
}

export function daysInMonth(year: number, month1to12: number): number {
  // Handles Feb, leap years, all month lengths correctly.
  return new Date(year, month1to12, 0).getDate();
}

export function monthKeysInRange(): string[] {
  return [];
}

export function formatTaka(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(Math.round(n));
  const grouped = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}৳${grouped}`;
}

export function formatTakaCompact(n: number): string {
  return formatTaka(n);
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const WEEKDAYS_SHORT = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
export const WEEKDAYS_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Monday-first weekday index: 0=Mon ... 6=Sun
export function weekdayMonFirst(year: number, month1to12: number, day: number): number {
  const js = new Date(year, month1to12 - 1, day).getDay(); // 0=Sun
  return (js + 6) % 7;
}

export function todayKey(): string {
  const d = new Date();
  return toDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function currentMonthKey(): string {
  const d = new Date();
  return toMonthKey(d.getFullYear(), d.getMonth() + 1);
}

export function shiftMonth(monthKey: string, delta: number): string {
  const p = parseMonthKey(monthKey);
  if (!p) return currentMonthKey();
  let total = p.year * 12 + (p.month - 1) + delta;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return toMonthKey(y, m);
}

export type PriceEntry = {
  id: number;
  effectiveDate: string;
  lunchPrice: number;
  dinnerPrice: number;
  note?: string | null;
  createdAt?: string | null;
};

// Resolve applicable price for a given date key using price history.
// Rule: latest entry with effectiveDate <= dateKey wins.
// Fallback: earliest entry if none is <= date (so old dates still have a price).
// If history empty: return defaults.
export function resolvePriceForDate(
  dateKey: string,
  history: PriceEntry[],
  fallback = { lunchPrice: 0, dinnerPrice: 0 }
): { lunchPrice: number; dinnerPrice: number } {
  if (history.length === 0) return fallback;
  const sorted = [...history].sort((a, b) =>
    a.effectiveDate < b.effectiveDate ? -1 : a.effectiveDate > b.effectiveDate ? 1 : a.id - b.id
  );
  let chosen: PriceEntry | null = null;
  for (const h of sorted) {
    if (h.effectiveDate <= dateKey) chosen = h;
    else break;
  }
  if (!chosen) chosen = sorted[0];
  return { lunchPrice: chosen.lunchPrice, dinnerPrice: chosen.dinnerPrice };
}

export type MealRow = {
  date: string;
  lunchTaken: boolean;
  dinnerTaken: boolean;
  lunchPrice: number;
  dinnerPrice: number;
};

export type DayCalc = {
  date: string;
  day: number;
  lunchTaken: boolean;
  dinnerTaken: boolean;
  lunchPrice: number;
  dinnerPrice: number;
  isVirtual: boolean; // true when auto-mode filled (no explicit DB row)
  isAuto: boolean;
  dayCost: number;
};

export type MonthSummary = {
  lunchesTaken: number;
  dinnersTaken: number;
  totalMeals: number;
  lunchCost: number;
  dinnerCost: number;
  totalCost: number;
  payment: number;
  remaining: number;
};

export function calcMonth(
  year: number,
  month: number,
  recordsMap: Map<string, MealRow>,
  history: PriceEntry[],
  payment: number,
  autoMode: boolean
): { days: DayCalc[]; summary: MonthSummary } {
  const dim = daysInMonth(year, month);
  const days: DayCalc[] = [];
  let lunchesTaken = 0;
  let dinnersTaken = 0;
  let lunchCost = 0;
  let dinnerCost = 0;

  for (let d = 1; d <= dim; d++) {
    const key = toDateKey(year, month, d);
    const rec = recordsMap.get(key);
    if (rec) {
      const lc = rec.lunchTaken ? rec.lunchPrice : 0;
      const dc = rec.dinnerTaken ? rec.dinnerPrice : 0;
      if (rec.lunchTaken) {
        lunchesTaken += 1;
        lunchCost += lc;
      }
      if (rec.dinnerTaken) {
        dinnersTaken += 1;
        dinnerCost += dc;
      }
      days.push({
        date: key,
        day: d,
        lunchTaken: rec.lunchTaken,
        dinnerTaken: rec.dinnerTaken,
        lunchPrice: rec.lunchPrice,
        dinnerPrice: rec.dinnerPrice,
        isVirtual: false,
        isAuto: false,
        dayCost: lc + dc,
      });
    } else if (autoMode) {
      const p = resolvePriceForDate(key, history, { lunchPrice: 0, dinnerPrice: 0 });
      lunchesTaken += 1;
      dinnersTaken += 1;
      lunchCost += p.lunchPrice;
      dinnerCost += p.dinnerPrice;
      days.push({
        date: key,
        day: d,
        lunchTaken: true,
        dinnerTaken: true,
        lunchPrice: p.lunchPrice,
        dinnerPrice: p.dinnerPrice,
        isVirtual: true,
        isAuto: true,
        dayCost: p.lunchPrice + p.dinnerPrice,
      });
    } else {
      const p = resolvePriceForDate(key, history, { lunchPrice: 0, dinnerPrice: 0 });
      days.push({
        date: key,
        day: d,
        lunchTaken: false,
        dinnerTaken: false,
        lunchPrice: p.lunchPrice,
        dinnerPrice: p.dinnerPrice,
        isVirtual: true,
        isAuto: false,
        dayCost: 0,
      });
    }
  }

  const totalMeals = lunchesTaken + dinnersTaken;
  const totalCost = lunchCost + dinnerCost;
  return {
    days,
    summary: {
      lunchesTaken,
      dinnersTaken,
      totalMeals,
      lunchCost,
      dinnerCost,
      totalCost,
      payment,
      remaining: payment - totalCost,
    },
  };
}

export function validatePrice(v: unknown): number | null {
  if (typeof v === "string") {
    if (v.trim() === "") return null;
    v = Number(v);
  }
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  if (n < 0 || n > 1000000) return null;
  return n;
}

export function validatePayment(v: unknown): number | null {
  return validatePrice(v);
}

export function friendlyError(): string {
  return "Something went wrong. Please try again.";
}
