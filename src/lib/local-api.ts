import {
  calcMonth,
  daysInMonth,
  parseDateKey,
  parseMonthKey,
  resolvePriceForDate,
  toDateKey,
  validatePayment,
  validatePrice,
  type MealRow,
  type PriceEntry,
} from "@/lib/meal";

type LocalMeal = MealRow & { createdAt?: string; updatedAt?: string };
type LocalState = {
  meals: LocalMeal[];
  prices: PriceEntry[];
  payments: Record<string, number>;
  autoMode: boolean;
  nextPriceId: number;
};

const KEY = "mealtrack-local-v1";

function emptyState(): LocalState {
  return {
    meals: [],
    prices: [{ id: 1, effectiveDate: "2020-01-01", lunchPrice: 50, dinnerPrice: 60, note: "Initial price", createdAt: new Date().toISOString() }],
    payments: {},
    autoMode: false,
    nextPriceId: 2,
  };
}

function readState(): LocalState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = emptyState();
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
    const parsed = JSON.parse(raw) as Partial<LocalState>;
    return {
      meals: Array.isArray(parsed.meals) ? parsed.meals : [],
      prices: Array.isArray(parsed.prices) && parsed.prices.length ? parsed.prices : emptyState().prices,
      payments: parsed.payments && typeof parsed.payments === "object" ? parsed.payments : {},
      autoMode: parsed.autoMode === true,
      nextPriceId: Number.isInteger(parsed.nextPriceId) && (parsed.nextPriceId as number) > 0 ? parsed.nextPriceId as number : 1,
    };
  } catch {
    return emptyState();
  }
}

function writeState(s: LocalState) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function currentPrice(prices: PriceEntry[]) {
  const sorted = [...prices].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.id - b.id);
  if (!sorted.length) return { lunchPrice: 50, dinnerPrice: 60 };
  const p = sorted[sorted.length - 1];
  return { lunchPrice: p.lunchPrice, dinnerPrice: p.dinnerPrice };
}

export async function localFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const raw = typeof input === "string" ? input : input.toString();
  const u = new URL(raw, window.location.origin);
  const path = u.pathname;
  const method = (init.method || "GET").toUpperCase();
  let body: Record<string, unknown> = {};
  try { body = init.body ? JSON.parse(String(init.body)) : {}; } catch {}
  const s = readState();

  if (path === "/api/prices" && method === "GET") {
    const history = [...s.prices].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.id - b.id);
    writeState(s);
    return json({ ok: true, history });
  }

  if (path === "/api/prices" && method === "POST") {
    const lunchPrice = validatePrice(body.lunchPrice);
    const dinnerPrice = validatePrice(body.dinnerPrice);
    const effectiveDate = typeof body.effectiveDate === "string" ? body.effectiveDate.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 120) : null;
    if (lunchPrice === null || dinnerPrice === null) return json({ ok: false, message: "Please enter valid prices (0 – 1,000,000 TK)." }, 400);
    if (!parseDateKey(effectiveDate)) return json({ ok: false, message: "Please choose a valid effective date." }, 400);
    const created: PriceEntry = { id: s.nextPriceId++, effectiveDate, lunchPrice, dinnerPrice, note, createdAt: new Date().toISOString() };
    s.prices.push(created);
    writeState(s);
    return json({ ok: true, created, history: [...s.prices].sort((a,b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.id-b.id), message: "Price saved. Existing meal records were not changed." });
  }

  const priceIdMatch = path.match(/^\/api\/prices\/(\d+)$/);
  if (priceIdMatch && method === "DELETE") {
    const id = Number(priceIdMatch[1]);
    if (s.prices.length <= 1) return json({ ok: false, message: "You need at least one price entry. Edit it instead of deleting." }, 400);
    s.prices = s.prices.filter(p => p.id !== id);
    writeState(s);
    return json({ ok: true, message: "Price entry removed. Meal records were not changed." });
  }

  if (path === "/api/prices/apply" && method === "POST") {
    const lunchPrice = validatePrice(body.lunchPrice), dinnerPrice = validatePrice(body.dinnerPrice);
    const effectiveDate = typeof body.effectiveDate === "string" ? body.effectiveDate.trim() : "";
    const monthKey = typeof body.monthKey === "string" ? body.monthKey.trim() : "";
    if (lunchPrice === null || dinnerPrice === null || !parseDateKey(effectiveDate)) return json({ ok: false, message: "Please enter valid prices and effective date." }, 400);
    let updated = 0;
    let end = "9999-12-31";
    if (monthKey && parseMonthKey(monthKey)) {
      const { year, month } = parseMonthKey(monthKey)!;
      end = toDateKey(year, month, daysInMonth(year, month));
    }
    for (const m of s.meals) {
      if (m.date >= effectiveDate && m.date <= end) { m.lunchPrice = lunchPrice; m.dinnerPrice = dinnerPrice; m.updatedAt = new Date().toISOString(); updated++; }
    }
    writeState(s);
    return json({ ok: true, updated, message: `Updated ${updated} saved day(s).` });
  }

  if (path === "/api/meals" && method === "PUT") {
    const date = typeof body.date === "string" ? body.date.trim() : "";
    if (!parseDateKey(date) || typeof body.lunchTaken !== "boolean" || typeof body.dinnerTaken !== "boolean") return json({ ok: false, message: "Invalid meal status." }, 400);
    const now = new Date().toISOString();
    const existing = s.meals.find(m => m.date === date);
    if (existing) {
      existing.lunchTaken = body.lunchTaken as boolean;
      existing.dinnerTaken = body.dinnerTaken as boolean;
      existing.updatedAt = now;
      writeState(s);
      return json({ ok: true, record: { ...existing, preserved: true }, message: "Saved. Original meal prices kept." });
    }
    const p = resolvePriceForDate(date, s.prices, { lunchPrice: 50, dinnerPrice: 60 });
    const record: LocalMeal = { date, lunchTaken: body.lunchTaken as boolean, dinnerTaken: body.dinnerTaken as boolean, lunchPrice: p.lunchPrice, dinnerPrice: p.dinnerPrice, createdAt: now, updatedAt: now };
    s.meals.push(record); writeState(s);
    return json({ ok: true, record: { ...record, preserved: false }, message: "Saved." });
  }

  if (path === "/api/meals/price" && method === "PUT") {
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const lunchPrice = validatePrice(body.lunchPrice), dinnerPrice = validatePrice(body.dinnerPrice);
    if (!parseDateKey(date) || lunchPrice === null || dinnerPrice === null) return json({ ok: false, message: "Please enter valid prices." }, 400);
    const existing = s.meals.find(m => m.date === date);
    if (existing) { existing.lunchPrice = lunchPrice; existing.dinnerPrice = dinnerPrice; existing.updatedAt = new Date().toISOString(); }
    else s.meals.push({ date, lunchTaken: false, dinnerTaken: false, lunchPrice, dinnerPrice, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    writeState(s); return json({ ok: true, message: "Day prices updated." });
  }

  if (path === "/api/payment" && method === "PUT") {
    const monthKey = typeof body.monthKey === "string" ? body.monthKey.trim() : "";
    const amount = validatePayment(body.amount);
    if (!parseMonthKey(monthKey) || amount === null) return json({ ok: false, message: "Please enter a valid amount (0 – 1,000,000 TK)." }, 400);
    s.payments[monthKey] = amount; writeState(s); return json({ ok: true, monthKey, amount, message: "Payment saved." });
  }

  if (path === "/api/settings" && method === "GET") return json({ ok: true, autoMode: s.autoMode, currentPrice: currentPrice(s.prices), priceCount: s.prices.length });
  if (path === "/api/settings" && method === "PUT") {
    if (typeof body.autoMode !== "boolean") return json({ ok: false, message: "Invalid setting value." }, 400);
    s.autoMode = body.autoMode as boolean; writeState(s); return json({ ok: true, autoMode: s.autoMode, currentPrice: currentPrice(s.prices) });
  }

  if (path === "/api/month" && method === "GET") {
    const monthKey = u.searchParams.get("month") || "";
    const parsed = parseMonthKey(monthKey);
    if (!parsed) return json({ ok: false, message: "Invalid month." }, 400);
    const { year, month } = parsed;
    const recordsMap = new Map<string, MealRow>(s.meals.filter(m => m.date.startsWith(`${monthKey}-`)).map(m => [m.date, m]));
    const payment = s.payments[monthKey] ?? 0;
    const { days, summary } = calcMonth(year, month, recordsMap, s.prices, payment, s.autoMode);
    return json({ ok: true, monthKey, year, month, daysInMonth: daysInMonth(year, month), days, summary, payment, autoMode: s.autoMode, currentPrice: currentPrice(s.prices), explicitCount: recordsMap.size });
  }

  if (path === "/api/export" && method === "GET") return json({ ok: true, meals: s.meals, prices: s.prices, payments: Object.entries(s.payments).map(([monthKey, amount]) => ({ monthKey, amount })), settings: [{ key: "auto_mode", value: String(s.autoMode) }], exportedAt: new Date().toISOString() });

  return json({ ok: false, message: "Offline API route not found." }, 404);
}
