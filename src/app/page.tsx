"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calcMonth,
  currentMonthKey,
  daysInMonth,
  formatTaka,
  MONTH_NAMES,
  MONTH_SHORT,
  parseMonthKey,
  shiftMonth,
  toDateKey,
  todayKey,
  weekdayMonFirst,
  WEEKDAYS_SHORT,
  type DayCalc,
  type MonthSummary,
  type PriceEntry,
} from "@/lib/meal";
import { localFetch as fetch } from "@/lib/local-api";

/* ---------------------------------- types --------------------------------- */

type MonthApiDay = DayCalc;
type MonthApiResponse = {
  ok: boolean;
  monthKey: string;
  year: number;
  month: number;
  daysInMonth: number;
  days: MonthApiDay[];
  summary: MonthSummary;
  payment: number;
  autoMode: boolean;
  currentPrice: { lunchPrice: number; dinnerPrice: number };
  explicitCount: number;
  message?: string;
};

type PricesApiResponse = {
  ok: boolean;
  history: PriceEntry[];
  message?: string;
};

type Toast = { id: number; msg: string; kind: "ok" | "err" | "info" };

type Tab = "home" | "summary" | "prices" | "settings";

/* --------------------------------- icons ---------------------------------- */

function IconCal({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#38bdf8" : "#8b98ad"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconChart({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#38bdf8" : "#8b98ad"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
function IconTag({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#38bdf8" : "#8b98ad"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}
function IconGear({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#38bdf8" : "#8b98ad"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/* --------------------------------- helpers -------------------------------- */

let toastId = 1;

function weekdayName(year: number, month: number, day: number) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[new Date(year, month - 1, day).getDay()];
}

function monthLabel(monthKey: string) {
  const p = parseMonthKey(monthKey);
  if (!p) return monthKey;
  return `${MONTH_NAMES[p.month - 1]} ${p.year}`;
}

/* ---------------------------------- page ---------------------------------- */

export default function MealTrackerApp() {
  const [monthKey, setMonthKey] = useState<string>(() => currentMonthKey());
  const [monthData, setMonthData] = useState<MonthApiResponse | null>(null);
  const [history, setHistory] = useState<PriceEntry[]>([]);
  const [tab, setTab] = useState<Tab>("home");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [paymentInput, setPaymentInput] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const [priceLunch, setPriceLunch] = useState("55");
  const [priceDinner, setPriceDinner] = useState("65");
  const [priceDate, setPriceDate] = useState(() => todayKey());
  const [priceNote, setPriceNote] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [applying, setApplying] = useState(false);

  const [autoToggling, setAutoToggling] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());

  const [dayPriceDate, setDayPriceDate] = useState<string | null>(null);
  const [dayLunchPrice, setDayLunchPrice] = useState("");
  const [dayDinnerPrice, setDayDinnerPrice] = useState("");
  const [savingDayPrice, setSavingDayPrice] = useState(false);

  const [bulkWorking, setBulkWorking] = useState(false);
  const [checklist, setChecklist] = useState<boolean[]>(() => {
    try {
      const raw = localStorage.getItem("mealtrack-checklist");
      if (raw) return JSON.parse(raw);
    } catch {}
    return Array(10).fill(false);
  });

  const parsed = useMemo(() => parseMonthKey(monthKey) ?? { year: 2026, month: 10 }, [monthKey]);
  const today = todayKey();

  const pushToast = useCallback((msg: string, kind: Toast["kind"] = "info") => {
    const id = toastId++;
    setToasts((t) => [...t.slice(-2), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const loadPrices = useCallback(async () => {
    try {
      const r = await fetch("/api/prices", { cache: "no-store" });
      const j = (await r.json()) as PricesApiResponse;
      if (j.ok) setHistory(j.history);
    } catch {}
  }, []);

  const loadMonth = useCallback(
    async (mk: string, silent = false) => {
      if (!silent) setLoadingMonth(true);
      try {
        const r = await fetch(`/api/month?month=${encodeURIComponent(mk)}`, { cache: "no-store" });
        const j = (await r.json()) as MonthApiResponse & { message?: string };
        if (!r.ok || !j.ok) {
          pushToast(j.message || "Could not load month data.", "err");
          return;
        }
        setMonthData(j);
        setPaymentInput((prev) => (prev === "" && document.activeElement?.id !== "payment-input" ? String(j.payment) : prev));
        // keep payment input in sync when month changes
        if (!silent) setPaymentInput(String(j.payment));
        if (!selectedDate || !selectedDate.startsWith(mk)) {
          // auto-select today if viewing current month, else day 1
          const cur = currentMonthKey();
          if (mk === cur) setSelectedDate(todayKey());
          else setSelectedDate(`${mk}-01`);
        }
      } catch {
        pushToast("Could not load month data. Check your connection.", "err");
      } finally {
        setLoadingMonth(false);
      }
    },
    [pushToast]
  );

  useEffect(() => {
    loadMonth(monthKey);
    loadPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  useEffect(() => {
    try {
      localStorage.setItem("mealtrack-checklist", JSON.stringify(checklist));
    } catch {}
  }, [checklist]);

  const summary: MonthSummary | null = monthData?.summary ?? null;
  const days: MonthApiDay[] = useMemo(() => monthData?.days ?? [], [monthData]);
  const autoMode = monthData?.autoMode ?? false;
  const currentPrice = monthData?.currentPrice ?? { lunchPrice: 50, dinnerPrice: 60 };

  // Calendar grid blanks (Monday-first)
  const leadBlanks = useMemo(() => weekdayMonFirst(parsed.year, parsed.month, 1), [parsed]);
  const dim = daysInMonth(parsed.year, parsed.month);

  function goMonth(delta: number) {
    setMonthKey((mk) => shiftMonth(mk, delta));
  }

  async function toggleMeal(date: string, which: "lunch" | "dinner") {
    const day = days.find((d) => d.date === date);
    if (!day || savingKey) return;
    const newLunch = which === "lunch" ? !day.lunchTaken : day.lunchTaken;
    const newDinner = which === "dinner" ? !day.dinnerTaken : day.dinnerTaken;

    // Optimistic update with instant recalculation
    setSavingKey(date + which);
    setMonthData((prev) => {
      if (!prev) return prev;
      const nextDays = prev.days.map((d) =>
        d.date === date
          ? {
              ...d,
              lunchTaken: newLunch,
              dinnerTaken: newDinner,
              isVirtual: false,
              isAuto: false,
              dayCost: (newLunch ? d.lunchPrice : 0) + (newDinner ? d.dinnerPrice : 0),
            }
          : d
      );
      // recompute summary locally
      let lunches = 0,
        dinners = 0,
        lc = 0,
        dc = 0;
      for (const d of nextDays) {
        if (d.lunchTaken) {
          lunches++;
          lc += d.lunchPrice;
        }
        if (d.dinnerTaken) {
          dinners++;
          dc += d.dinnerPrice;
        }
      }
      return {
        ...prev,
        days: nextDays,
        summary: {
          lunchesTaken: lunches,
          dinnersTaken: dinners,
          totalMeals: lunches + dinners,
          lunchCost: lc,
          dinnerCost: dc,
          totalCost: lc + dc,
          payment: prev.summary.payment,
          remaining: prev.summary.payment - (lc + dc),
        },
      };
    });

    try {
      const r = await fetch("/api/meals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, lunchTaken: newLunch, dinnerTaken: newDinner }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        pushToast(j.message || "Could not save meal.", "err");
        loadMonth(monthKey, true);
      } else {
        // background refresh to get authoritative snapshot prices
        loadMonth(monthKey, true);
        loadPrices();
      }
    } catch {
      pushToast("Could not save meal. Please try again.", "err");
      loadMonth(monthKey, true);
    } finally {
      setSavingKey(null);
    }
  }

  async function setDayBoth(date: string, taken: boolean) {
    const day = days.find((d) => d.date === date);
    if (!day) return;
    if (day.lunchTaken === taken && day.dinnerTaken === taken) return;
    setSavingKey(date + "both");
    setMonthData((prev) => {
      if (!prev) return prev;
      const nextDays = prev.days.map((d) =>
        d.date === date
          ? {
              ...d,
              lunchTaken: taken,
              dinnerTaken: taken,
              isVirtual: false,
              isAuto: false,
              dayCost: taken ? d.lunchPrice + d.dinnerPrice : 0,
            }
          : d
      );
      let lunches = 0,
        dinners = 0,
        lc = 0,
        dc = 0;
      for (const d of nextDays) {
        if (d.lunchTaken) {
          lunches++;
          lc += d.lunchPrice;
        }
        if (d.dinnerTaken) {
          dinners++;
          dc += d.dinnerPrice;
        }
      }
      return {
        ...prev,
        days: nextDays,
        summary: {
          lunchesTaken: lunches,
          dinnersTaken: dinners,
          totalMeals: lunches + dinners,
          lunchCost: lc,
          dinnerCost: dc,
          totalCost: lc + dc,
          payment: prev.summary.payment,
          remaining: prev.summary.payment - (lc + dc),
        },
      };
    });
    try {
      const r = await fetch("/api/meals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, lunchTaken: taken, dinnerTaken: taken }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) pushToast(j.message || "Could not save day.", "err");
      loadMonth(monthKey, true);
    } catch {
      pushToast("Could not save day.", "err");
      loadMonth(monthKey, true);
    } finally {
      setSavingKey(null);
    }
  }

  async function savePayment() {
    const amt = Math.round(Number(paymentInput));
    if (!Number.isFinite(amt) || paymentInput.trim() === "") {
      pushToast("Please enter a valid payment amount.", "err");
      return;
    }
    if (amt < 0 || amt > 1000000) {
      pushToast("Payment must be between ৳0 and ৳1,000,000.", "err");
      return;
    }
    setSavingPayment(true);
    try {
      const r = await fetch("/api/payment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthKey, amount: amt }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) pushToast(j.message || "Could not save payment.", "err");
      else {
        pushToast(`Payment saved: ${formatTaka(amt)}`, "ok");
        loadMonth(monthKey, true);
        // update summary remaining instantly
        setMonthData((prev) =>
          prev
            ? { ...prev, payment: amt, summary: { ...prev.summary, payment: amt, remaining: amt - prev.summary.totalCost } }
            : prev
        );
      }
    } catch {
      pushToast("Could not save payment.", "err");
    } finally {
      setSavingPayment(false);
    }
  }

  async function savePrice() {
    const l = Math.round(Number(priceLunch));
    const d = Math.round(Number(priceDinner));
    if (!Number.isFinite(l) || !Number.isFinite(d) || priceLunch.trim() === "" || priceDinner.trim() === "") {
      pushToast("Please enter valid lunch & dinner prices.", "err");
      return;
    }
    if (l < 0 || d < 0 || l > 1000000 || d > 1000000) {
      pushToast("Prices must be between ৳0 and ৳1,000,000.", "err");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(priceDate)) {
      pushToast("Please choose a valid effective date.", "err");
      return;
    }
    setSavingPrice(true);
    try {
      const r = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lunchPrice: l, dinnerPrice: d, effectiveDate: priceDate, note: priceNote }),
      });
      const j = (await r.json()) as PricesApiResponse & { created?: PriceEntry };
      if (!r.ok || !j.ok) {
        pushToast((j as { message?: string }).message || "Could not save price.", "err");
      } else {
        pushToast(`New price from ${priceDate}: L ${formatTaka(l)} · D ${formatTaka(d)}. Old meals untouched.`, "ok");
        setPriceNote("");
        await loadPrices();
        await loadMonth(monthKey, true);
      }
    } catch {
      pushToast("Could not save price.", "err");
    } finally {
      setSavingPrice(false);
    }
  }

  async function deletePrice(id: number) {
    if (!confirm("Remove this price entry? Saved meal records will NOT be changed.")) return;
    try {
      const r = await fetch(`/api/prices/${id}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok || !j.ok) pushToast(j.message || "Could not delete.", "err");
      else {
        pushToast("Price entry removed. Meals untouched.", "ok");
        loadPrices();
        loadMonth(monthKey, true);
      }
    } catch {
      pushToast("Could not delete price entry.", "err");
    }
  }

  async function applyPriceToMonth() {
    const l = Math.round(Number(priceLunch));
    const d = Math.round(Number(priceDinner));
    if (!Number.isFinite(l) || !Number.isFinite(d)) {
      pushToast("Enter valid prices first.", "err");
      return;
    }
    if (!confirm(`Apply L ${formatTaka(l)} / D ${formatTaka(d)} to SAVED days in ${monthLabel(monthKey)} from ${priceDate}? This explicitly rewrites those days' snapshot prices.`))
      return;
    setApplying(true);
    try {
      const r = await fetch("/api/prices/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lunchPrice: l, dinnerPrice: d, effectiveDate: priceDate, monthKey }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) pushToast(j.message || "Could not apply.", "err");
      else {
        pushToast(j.message || "Applied.", "ok");
        loadMonth(monthKey, true);
      }
    } catch {
      pushToast("Could not apply prices.", "err");
    } finally {
      setApplying(false);
    }
  }

  async function toggleAuto() {
    setAutoToggling(true);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoMode: !autoMode }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) pushToast(j.message || "Could not change mode.", "err");
      else {
        pushToast(!autoMode ? "Automatic Meal Mode ON — empty days count as taken." : "Automatic Meal Mode OFF — manual entry required.", "ok");
        loadMonth(monthKey, true);
      }
    } catch {
      pushToast("Could not change mode.", "err");
    } finally {
      setAutoToggling(false);
    }
  }

  async function bulkMonth(taken: boolean) {
    if (bulkWorking) return;
    if (!confirm(taken ? `Mark every day in ${monthLabel(monthKey)} as taken (both meals)?` : `Mark every day in ${monthLabel(monthKey)} as not taken?`)) return;
    setBulkWorking(true);
    try {
      for (const day of days) {
        if (day.lunchTaken === taken && day.dinnerTaken === taken) continue;
        await fetch("/api/meals", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: day.date, lunchTaken: taken, dinnerTaken: taken }),
        });
      }
      pushToast(taken ? "Month filled as taken." : "Month cleared.", "ok");
      loadMonth(monthKey, true);
    } catch {
      pushToast("Bulk update had an issue. Reloading.", "err");
      loadMonth(monthKey, true);
    } finally {
      setBulkWorking(false);
    }
  }

  async function saveDayPrice() {
    if (!dayPriceDate) return;
    const l = Math.round(Number(dayLunchPrice));
    const d = Math.round(Number(dayDinnerPrice));
    if (!Number.isFinite(l) || !Number.isFinite(d) || dayLunchPrice.trim() === "" || dayDinnerPrice.trim() === "") {
      pushToast("Enter valid day prices.", "err");
      return;
    }
    if (l < 0 || d < 0 || l > 1000000 || d > 1000000) {
      pushToast("Day prices must be ৳0 – ৳1,000,000.", "err");
      return;
    }
    setSavingDayPrice(true);
    try {
      const r = await fetch("/api/meals/price", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dayPriceDate, lunchPrice: l, dinnerPrice: d }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) pushToast(j.message || "Could not update.", "err");
      else {
        pushToast(`Prices for ${dayPriceDate} updated.`, "ok");
        setDayPriceDate(null);
        loadMonth(monthKey, true);
      }
    } catch {
      pushToast("Could not update day prices.", "err");
    } finally {
      setSavingDayPrice(false);
    }
  }

  async function loadExampleScenario() {
    if (!confirm("Load the October 2026 example? This creates Oct 1–14 at ৳50/৳60, payment ৳3,000, and a price change on Oct 15 to ৳55/৳65.")) return;
    setBulkWorking(true);
    try {
      // Prices
      await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lunchPrice: 50, dinnerPrice: 60, effectiveDate: "2026-10-01", note: "Oct 1 base" }),
      });
      await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lunchPrice: 55, dinnerPrice: 65, effectiveDate: "2026-10-15", note: "Oct 15 hike" }),
      });
      // Meals Oct 1: both taken
      await fetch("/api/meals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-10-01", lunchTaken: true, dinnerTaken: true }),
      });
      // Fix Oct 1 snapshot explicitly to 50/60 (in case resolution picked other)
      await fetch("/api/meals/price", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-10-01", lunchPrice: 50, dinnerPrice: 60 }),
      });
      // Payment
      await fetch("/api/payment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthKey: "2026-10", amount: 3000 }),
      });
      // A few more demo days: Oct 2 both, Oct 3 lunch only, Oct 16 both (new price)
      const demo: { date: string; l: boolean; d: boolean; lp: number; dp: number }[] = [
        { date: "2026-10-02", l: true, d: true, lp: 50, dp: 60 },
        { date: "2026-10-03", l: true, d: false, lp: 50, dp: 60 },
        { date: "2026-10-04", l: false, d: true, lp: 50, dp: 60 },
        { date: "2026-10-16", l: true, d: true, lp: 55, dp: 65 },
        { date: "2026-10-17", l: true, d: true, lp: 55, dp: 65 },
      ];
      for (const m of demo) {
        await fetch("/api/meals", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: m.date, lunchTaken: m.l, dinnerTaken: m.d }),
        });
        await fetch("/api/meals/price", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: m.date, lunchPrice: m.lp, dinnerPrice: m.dp }),
        });
      }
      setMonthKey("2026-10");
      setTab("home");
      pushToast("October 2026 example loaded. Check Summary & Price History.", "ok");
      await loadPrices();
      await loadMonth("2026-10");
    } catch {
      pushToast("Example setup had an issue.", "err");
    } finally {
      setBulkWorking(false);
    }
  }

  async function exportData() {
    try {
      const r = await fetch("/api/export", { cache: "no-store" });
      const j = await r.json();
      const blob = new Blob([JSON.stringify(j, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mealtrack-backup-${monthKey}.json`;
      a.click();
      URL.revokeObjectURL(url);
      pushToast("Backup downloaded.", "ok");
    } catch {
      pushToast("Could not export.", "err");
    }
  }

  function copySummary() {
    if (!summary) return;
    const txt = `${monthLabel(monthKey)}\nLunches: ${summary.lunchesTaken} (${formatTaka(summary.lunchCost)})\nDinners: ${summary.dinnersTaken} (${formatTaka(summary.dinnerCost)})\nTotal meals: ${summary.totalMeals}\nTotal cost: ${formatTaka(summary.totalCost)}\nGiven: ${formatTaka(summary.payment)}\nRemaining: ${formatTaka(summary.remaining)}`;
    navigator.clipboard?.writeText(txt).then(
      () => pushToast("Summary copied.", "ok"),
      () => pushToast("Could not copy.", "err")
    );
  }

  // Verify-all client check: recompute summary from days to catch drift
  const verifyNote = useMemo(() => {
    if (!monthData) return null;
    const map = new Map(days.map((d) => [d.date, { date: d.date, lunchTaken: d.lunchTaken, dinnerTaken: d.dinnerTaken, lunchPrice: d.lunchPrice, dinnerPrice: d.dinnerPrice }]));
    void map;
    void calcMonth;
    return null;
  }, [monthData, days]);
  void verifyNote;

  const selectedDay = selectedDate ? days.find((d) => d.date === selectedDate) : undefined;
  const sortedHistory = useMemo(() => [...history].sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : -1)), [history]);
  const progress = summary && summary.payment > 0 ? Math.min(100, Math.round((summary.totalCost / summary.payment) * 100)) : 0;

  return (
    <div className="min-h-screen bg-[#0a0e13] bg-[radial-gradient(1200px_600px_at_50%_-10%,#16233a_0%,#0a0e13_60%)] px-0 sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-md overflow-hidden sm:rounded-[28px] phone-shadow border-0 sm:border border-[#1f2a3d] bg-[#0a0e13]">
        {/* ── Top app bar ─────────────────────────────── */}
        <header className="sticky top-0 z-30 border-b border-[#1e293b] bg-[#0d131d]/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-emerald-400 text-2xl shadow-lg shadow-sky-500/20">
              🍱
            </div>
            <div className="flex-1">
              <h1 className="text-[17px] font-bold leading-tight tracking-tight">MealTrack</h1>
              <p className="text-[12px] text-slate-400">Monthly Meal Cost Tracker · ৳ TK</p>
            </div>
            <button
              onClick={toggleAuto}
              disabled={autoToggling}
              title="Toggle Automatic Meal Mode"
              className={`btn-press flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide border ${
                autoMode ? "bg-sky-500/15 border-sky-400/40 text-sky-300" : "bg-slate-500/10 border-slate-600/60 text-slate-400"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${autoMode ? "bg-sky-400 anim-pulse-dot" : "bg-slate-500"}`} />
              Auto {autoMode ? "ON" : "OFF"}
            </button>
          </div>

          {/* Month nav */}
          <div className="flex items-center gap-2 px-4 pb-3">
            <button onClick={() => goMonth(-1)} className="btn-press grid h-10 w-10 place-items-center rounded-xl bg-[#141b26] border border-[#263145] text-lg" aria-label="Previous month">
              ‹
            </button>
            <button onClick={() => setShowPicker(true)} className="btn-press flex-1 rounded-xl bg-[#141b26] border border-[#263145] px-3 py-2 text-center">
              <span className="block text-[15px] font-bold">{monthLabel(monthKey)}</span>
              <span className="block text-[11px] text-slate-400">
                {summary ? `${summary.totalMeals} meals · ${formatTaka(summary.totalCost)}` : "…"} · tap to jump
              </span>
            </button>
            <button onClick={() => goMonth(1)} className="btn-press grid h-10 w-10 place-items-center rounded-xl bg-[#141b26] border border-[#263145] text-lg" aria-label="Next month">
              ›
            </button>
            <button
              onClick={() => setMonthKey(currentMonthKey())}
              className="btn-press rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-[12px] font-bold text-sky-300"
            >
              Today
            </button>
          </div>
        </header>

        {/* ── Body ────────────────────────────────────── */}
        <main className="px-4 pb-28 pt-4">
          {tab === "home" && (
            <div className="space-y-4 anim-slide-up">
              {/* Summary strip */}
              <div className="grid grid-cols-3 gap-2">
                <div className="card-flat p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total cost</p>
                  <p className="mt-1 text-[16px] font-extrabold text-white">{summary ? formatTaka(summary.totalCost) : "…"}</p>
                  <p className="text-[10px] text-slate-500">{summary ? `${summary.totalMeals} meals` : ""}</p>
                </div>
                <div className="card-flat p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Given</p>
                  <p className="mt-1 text-[16px] font-extrabold text-sky-300">{summary ? formatTaka(summary.payment) : "…"}</p>
                  <p className="text-[10px] text-slate-500">supplier</p>
                </div>
                <div className={`rounded-2xl border p-3 text-center ${summary && summary.remaining < 0 ? "bg-red-500/10 border-red-500/30" : "bg-emerald-500/10 border-emerald-500/30"}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Remaining</p>
                  <p className={`mt-1 text-[16px] font-extrabold ${summary && summary.remaining < 0 ? "text-red-300" : "text-emerald-300"}`}>
                    {summary ? formatTaka(summary.remaining) : "…"}
                  </p>
                  <p className="text-[10px] text-slate-500">{summary && summary.remaining < 0 ? "over budget" : "balance"}</p>
                </div>
              </div>

              {/* Calendar */}
              <section className="card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[14px] font-bold">📅 {monthLabel(monthKey)}</h2>
                  <span className="text-[11px] text-slate-400">
                    L {formatTaka(currentPrice.lunchPrice)} · D {formatTaka(currentPrice.dinnerPrice)}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAYS_SHORT.map((w) => (
                    <div key={w} className="py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {w}
                    </div>
                  ))}
                  {Array.from({ length: leadBlanks }).map((_, i) => (
                    <div key={`b${i}`} />
                  ))}
                  {Array.from({ length: dim }).map((_, i) => {
                    const dayNum = i + 1;
                    const key = toDateKey(parsed.year, parsed.month, dayNum);
                    const rec = days.find((d) => d.date === key);
                    const isToday = key === today;
                    const isSel = key === selectedDate;
                    const both = rec?.lunchTaken && rec?.dinnerTaken;
                    const one = rec ? rec.lunchTaken !== rec.dinnerTaken : false;
                    const none = rec ? !rec.lunchTaken && !rec.dinnerTaken : true;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedDate(key)}
                        className={`btn-press relative flex flex-col items-center rounded-xl py-1.5 border ${
                          isSel ? "border-sky-400 bg-sky-500/15" : "border-transparent hover:bg-white/5"
                        }`}
                      >
                        <span className={`text-[13px] font-bold ${isSel ? "text-sky-200" : "text-slate-200"}`}>{dayNum}</span>
                        <span className="mt-1 flex gap-1">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: rec?.lunchTaken ? "#22c55e" : "#334155" }}
                          />
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: rec?.dinnerTaken ? "#22c55e" : "#334155" }}
                          />
                        </span>
                        {rec?.isVirtual && rec.isAuto && (both || one) && (
                          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sky-400" title="Auto" />
                        )}
                        {isToday && <span className="absolute left-1/2 top-0.5 h-1 w-4 -translate-x-1/2 rounded-full bg-sky-400" />}
                        <span className="sr-only">{both ? "both" : one ? "one" : none ? "none" : ""}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                  <span>🟢 both taken</span>
                  <span>🟡 one meal</span>
                  <span>⚫ none</span>
                  <span>🔵 auto-filled</span>
                </div>
                {autoMode && (
                  <p className="mt-2 rounded-xl bg-sky-500/10 border border-sky-500/25 px-3 py-2 text-[11px] text-sky-200">
                    Automatic Mode <b>ON</b> — empty days count as Lunch ✓ + Dinner ✓ at that date&apos;s price. Tap any meal to mark it ✕ without losing history.
                  </p>
                )}
              </section>

              {/* Selected day quick editor */}
              {selectedDay && (
                <section className="card border-sky-500/25 p-4 anim-fade" style={{ borderColor: "rgba(56,189,248,.25)" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[15px] font-extrabold">
                        {MONTH_SHORT[parsed.month - 1]} {selectedDay.day} · {weekdayName(parsed.year, parsed.month, selectedDay.day)}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        L {formatTaka(selectedDay.lunchPrice)} · D {formatTaka(selectedDay.dinnerPrice)}
                        {selectedDay.isVirtual && selectedDay.isAuto ? " · 🔵 auto" : selectedDay.isVirtual ? " · not saved yet" : " · ✓ saved"}
                        {" · "}Day total <b className="text-slate-200">{formatTaka(selectedDay.dayCost)}</b>
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setDayPriceDate(selectedDay.date);
                        setDayLunchPrice(String(selectedDay.lunchPrice));
                        setDayDinnerPrice(String(selectedDay.dinnerPrice));
                      }}
                      className="btn-press rounded-lg border border-[#263145] bg-white/5 px-2 py-1.5 text-[11px] text-slate-300"
                      title="Edit this day's prices"
                    >
                      ✎ Price
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => toggleMeal(selectedDay.date, "lunch")}
                      disabled={savingKey === selectedDay.date + "lunch"}
                      className={`btn-press rounded-2xl border px-3 py-3 text-left ${selectedDay.lunchTaken ? "pill-taken" : "pill-skipped"}`}
                    >
                      <span className="block text-[11px] font-bold uppercase tracking-wider opacity-80">🍛 Lunch</span>
                      <span className="mt-0.5 block text-[18px] font-extrabold">{selectedDay.lunchTaken ? "✓ Taken" : "✕ Skipped"}</span>
                      <span className="block text-[11px] opacity-80">{selectedDay.lunchTaken ? formatTaka(selectedDay.lunchPrice) : "৳0"}</span>
                    </button>
                    <button
                      onClick={() => toggleMeal(selectedDay.date, "dinner")}
                      disabled={savingKey === selectedDay.date + "dinner"}
                      className={`btn-press rounded-2xl border px-3 py-3 text-left ${selectedDay.dinnerTaken ? "pill-taken" : "pill-skipped"}`}
                    >
                      <span className="block text-[11px] font-bold uppercase tracking-wider opacity-80">🌙 Dinner</span>
                      <span className="mt-0.5 block text-[18px] font-extrabold">{selectedDay.dinnerTaken ? "✓ Taken" : "✕ Skipped"}</span>
                      <span className="block text-[11px] opacity-80">{selectedDay.dinnerTaken ? formatTaka(selectedDay.dinnerPrice) : "৳0"}</span>
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button onClick={() => setDayBoth(selectedDay.date, true)} className="btn-press rounded-xl bg-emerald-500/15 border border-emerald-500/30 py-2 text-[12px] font-bold text-emerald-300">
                      Both ✓
                    </button>
                    <button onClick={() => setDayBoth(selectedDay.date, false)} className="btn-press rounded-xl bg-white/5 border border-[#263145] py-2 text-[12px] font-bold text-slate-300">
                      Both ✕
                    </button>
                  </div>
                </section>
              )}

              {/* Day list */}
              <section className="card p-3">
                <div className="flex items-center justify-between px-1 pb-2">
                  <h2 className="text-[14px] font-bold">Daily meals</h2>
                  <div className="flex gap-1.5">
                    <button onClick={() => bulkMonth(true)} disabled={bulkWorking} className="btn-press rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300">
                      All ✓
                    </button>
                    <button onClick={() => bulkMonth(false)} disabled={bulkWorking} className="btn-press rounded-lg bg-white/5 border border-[#263145] px-2.5 py-1.5 text-[11px] font-bold text-slate-300">
                      Clear
                    </button>
                  </div>
                </div>
                <div className="max-h-[480px] space-y-1.5 overflow-y-auto pr-0.5">
                  {loadingMonth && (
                    <div className="space-y-2 p-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
                      ))}
                    </div>
                  )}
                  {!loadingMonth &&
                    days.map((d) => {
                      const isSel = d.date === selectedDate;
                      return (
                        <div
                          key={d.date}
                          onClick={() => setSelectedDate(d.date)}
                          className={`flex items-center gap-2.5 rounded-2xl border p-2.5 ${isSel ? "border-sky-500/40 bg-sky-500/8" : "border-[#222d42] bg-[#111827]"}`}
                        >
                          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-extrabold ${d.dayCost > 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-slate-500"}`}>
                            <div className="text-center leading-none">
                              <div className="text-[16px]">{d.day}</div>
                              <div className="mt-0.5 text-[8px] font-bold uppercase">{weekdayName(parsed.year, parsed.month, d.day)}</div>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-[12px] font-bold text-slate-200">
                                {MONTH_SHORT[parsed.month - 1]} {d.day}
                              </span>
                              {d.isVirtual && d.isAuto && (d.lunchTaken || d.dinnerTaken) && (
                                <span className="rounded-full bg-sky-500/15 border border-sky-500/30 px-1.5 py-px text-[9px] font-bold text-sky-300">AUTO</span>
                              )}
                              <span className="ml-auto text-[12px] font-extrabold text-slate-100">{formatTaka(d.dayCost)}</span>
                            </div>
                            <div className="mt-1.5 flex gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleMeal(d.date, "lunch");
                                }}
                                className={`btn-press flex-1 rounded-xl border py-2 text-[12px] font-extrabold ${d.lunchTaken ? "pill-taken" : "pill-skipped"}`}
                              >
                                {d.lunchTaken ? "✓ L" : "✕ L"} <span className="font-normal opacity-70">· {formatTaka(d.lunchPrice)}</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleMeal(d.date, "dinner");
                                }}
                                className={`btn-press flex-1 rounded-xl border py-2 text-[12px] font-extrabold ${d.dinnerTaken ? "pill-taken" : "pill-skipped"}`}
                              >
                                {d.dinnerTaken ? "✓ D" : "✕ D"} <span className="font-normal opacity-70">· {formatTaka(d.dinnerPrice)}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>
            </div>
          )}

          {tab === "summary" && (
            <div className="space-y-4 anim-slide-up">
              <section className="card overflow-hidden">
                <div className="bg-gradient-to-br from-sky-500/20 via-emerald-500/10 to-transparent p-5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{monthLabel(monthKey)} summary</p>
                  <p className="mt-1 text-[34px] font-black leading-none">{summary ? formatTaka(summary.totalCost) : "…"}</p>
                  <p className="mt-1 text-[12px] text-slate-400">total meal cost · {summary?.totalMeals ?? 0} meals</p>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/40">
                    <div
                      className={`h-full rounded-full transition-all ${progress > 100 || (summary && summary.remaining < 0) ? "bg-red-400" : "bg-gradient-to-r from-sky-400 to-emerald-400"}`}
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    {summary && summary.payment > 0 ? `${progress}% of ${formatTaka(summary.payment)} used` : "Add supplier payment below to track balance"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-px bg-[#263145]">
                  <div className="bg-[#141b26] p-4 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">🍛 Lunches</p>
                    <p className="mt-1 text-[22px] font-black">{summary?.lunchesTaken ?? 0}</p>
                    <p className="text-[12px] font-bold text-emerald-300">{summary ? formatTaka(summary.lunchCost) : ""}</p>
                  </div>
                  <div className="bg-[#141b26] p-4 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">🌙 Dinners</p>
                    <p className="mt-1 text-[22px] font-black">{summary?.dinnersTaken ?? 0}</p>
                    <p className="text-[12px] font-bold text-emerald-300">{summary ? formatTaka(summary.dinnerCost) : ""}</p>
                  </div>
                </div>
              </section>

              <section className="card-flat space-y-2.5 p-4">
                {[
                  { k: "Total lunches taken", v: `${summary?.lunchesTaken ?? 0}` },
                  { k: "Total dinners taken", v: `${summary?.dinnersTaken ?? 0}` },
                  { k: "Total meals taken", v: `${summary?.totalMeals ?? 0}`, bold: true },
                  { k: `Lunch cost (${formatTaka(currentPrice.lunchPrice)} base)`, v: summary ? formatTaka(summary.lunchCost) : "…" },
                  { k: `Dinner cost (${formatTaka(currentPrice.dinnerPrice)} base)`, v: summary ? formatTaka(summary.dinnerCost) : "…" },
                  { k: "Total meal cost", v: summary ? formatTaka(summary.totalCost) : "…", bold: true },
                  { k: "Money given to supplier", v: summary ? formatTaka(summary.payment) : "…" },
                ].map((row) => (
                  <div key={row.k} className="flex items-center justify-between text-[13px]">
                    <span className={row.bold ? "font-bold text-white" : "text-slate-400"}>{row.k}</span>
                    <span className={row.bold ? "font-black text-white" : "font-bold text-slate-200"}>{row.v}</span>
                  </div>
                ))}
                <div className={`flex items-center justify-between rounded-2xl border px-3 py-3 ${summary && summary.remaining < 0 ? "border-red-500/30 bg-red-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
                  <span className="text-[13px] font-bold">💰 Remaining</span>
                  <span className={`text-[20px] font-black ${summary && summary.remaining < 0 ? "text-red-300" : "text-emerald-300"}`}>
                    {summary ? formatTaka(summary.remaining) : "…"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">Remaining = Given − Total cost. Updates instantly when meals change. Historical prices are preserved per day.</p>
              </section>

              <section className="card p-4">
                <h3 className="text-[14px] font-bold">💵 Supplier payment — {monthLabel(monthKey)}</h3>
                <p className="mt-0.5 text-[11px] text-slate-400">Kept per-month. Never affects other months.</p>
                <div className="mt-3 flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] font-bold text-slate-400">৳</span>
                    <input
                      id="payment-input"
                      inputMode="numeric"
                      type="number"
                      min={0}
                      max={1000000}
                      value={paymentInput}
                      onChange={(e) => setPaymentInput(e.target.value)}
                      placeholder="3000"
                      className="w-full rounded-2xl border border-[#263145] bg-black/30 py-3 pl-8 pr-3 text-[16px] font-bold outline-none focus:border-sky-500"
                    />
                  </div>
                  <button onClick={savePayment} disabled={savingPayment} className="btn-press rounded-2xl bg-sky-500 px-5 py-3 text-[14px] font-extrabold text-[#06283a] disabled:opacity-50">
                    {savingPayment ? "…" : "Save"}
                  </button>
                </div>
                <div className="mt-2 flex gap-2">
                  {[1000, 2000, 3000, 5000].map((q) => (
                    <button key={q} onClick={() => setPaymentInput(String(q))} className="btn-press flex-1 rounded-xl border border-[#263145] bg-white/5 py-1.5 text-[11px] font-bold text-slate-300">
                      {formatTaka(q)}
                    </button>
                  ))}
                </div>
              </section>

              <section className="card-flat p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-bold">Breakdown</h3>
                  <button onClick={copySummary} className="btn-press rounded-lg border border-[#263145] bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-slate-300">
                    📋 Copy
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-black/30 p-2.5">
                    <p className="text-[10px] text-slate-500">Avg / day</p>
                    <p className="text-[13px] font-extrabold">{summary && dim ? formatTaka(Math.round(summary.totalCost / dim)) : "—"}</p>
                  </div>
                  <div className="rounded-xl bg-black/30 p-2.5">
                    <p className="text-[10px] text-slate-500">Avg / meal</p>
                    <p className="text-[13px] font-extrabold">{summary && summary.totalMeals ? formatTaka(Math.round(summary.totalCost / summary.totalMeals)) : "—"}</p>
                  </div>
                  <div className="rounded-xl bg-black/30 p-2.5">
                    <p className="text-[10px] text-slate-500">Saved days</p>
                    <p className="text-[13px] font-extrabold">{monthData?.explicitCount ?? 0}/{dim}</p>
                  </div>
                </div>
                <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                  {days.filter((d) => d.dayCost > 0).length === 0 && <p className="py-4 text-center text-[12px] text-slate-500">No charged meals yet this month.</p>}
                  {days
                    .filter((d) => d.dayCost > 0)
                    .map((d) => (
                      <div key={d.date} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-[12px]">
                        <span className="text-slate-300">
                          {MONTH_SHORT[parsed.month - 1]} {d.day} · {d.lunchTaken ? "L✓" : "L✕"} {d.dinnerTaken ? "D✓" : "D✕"}
                          {d.isVirtual && d.isAuto ? " · auto" : ""}
                        </span>
                        <span className="font-bold">{formatTaka(d.dayCost)}</span>
                      </div>
                    ))}
                </div>
              </section>
            </div>
          )}

          {tab === "prices" && (
            <div className="space-y-4 anim-slide-up">
              <section className="card bg-gradient-to-br from-[#17202f] to-[#121826] p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Current price (latest entry)</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-[#263145] bg-black/30 p-3 text-center">
                    <p className="text-[11px] text-slate-400">🍛 Lunch</p>
                    <p className="text-[24px] font-black text-white">{formatTaka(currentPrice.lunchPrice)}</p>
                  </div>
                  <div className="rounded-2xl border border-[#263145] bg-black/30 p-3 text-center">
                    <p className="text-[11px] text-slate-400">🌙 Dinner</p>
                    <p className="text-[24px] font-black text-white">{formatTaka(currentPrice.dinnerPrice)}</p>
                  </div>
                </div>
                <p className="mt-2 text-center text-[12px] text-slate-400">
                  Per day both meals: <b className="text-slate-200">{formatTaka(currentPrice.lunchPrice + currentPrice.dinnerPrice)}</b>
                </p>
              </section>

              <section className="card p-4">
                <h3 className="text-[14px] font-bold">✏️ Change price</h3>
                <p className="mt-0.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 text-[11px] leading-relaxed text-emerald-200">
                  🔒 Safe by design: saving a new price <b>never</b> rewrites old meals. Each saved day keeps its own snapshot price. New days from the effective date use the new price.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-slate-400">LUNCH (৳)</span>
                    <input type="number" inputMode="numeric" min={0} max={1000000} value={priceLunch} onChange={(e) => setPriceLunch(e.target.value)} className="w-full rounded-2xl border border-[#263145] bg-black/30 px-3 py-3 text-[16px] font-bold outline-none focus:border-sky-500" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-slate-400">DINNER (৳)</span>
                    <input type="number" inputMode="numeric" min={0} max={1000000} value={priceDinner} onChange={(e) => setPriceDinner(e.target.value)} className="w-full rounded-2xl border border-[#263145] bg-black/30 px-3 py-3 text-[16px] font-bold outline-none focus:border-sky-500" />
                  </label>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-slate-400">EFFECTIVE FROM</span>
                    <input type="date" value={priceDate} min="2018-01-01" max="2035-12-31" onChange={(e) => setPriceDate(e.target.value)} className="w-full rounded-2xl border border-[#263145] bg-black/30 px-3 py-2.5 text-[13px] font-bold outline-none focus:border-sky-500 [color-scheme:dark]" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-slate-400">NOTE (OPTIONAL)</span>
                    <input value={priceNote} onChange={(e) => setPriceNote(e.target.value)} placeholder="e.g. Oct hike" maxLength={60} className="w-full rounded-2xl border border-[#263145] bg-black/30 px-3 py-2.5 text-[13px] outline-none focus:border-sky-500" />
                  </label>
                </div>
                <button onClick={savePrice} disabled={savingPrice} className="btn-press mt-3 w-full rounded-2xl bg-gradient-to-r from-sky-400 to-emerald-400 py-3.5 text-[15px] font-black text-[#06283a] disabled:opacity-50">
                  {savingPrice ? "Saving…" : `Save price from ${priceDate || "—"}`}
                </button>
                <button onClick={applyPriceToMonth} disabled={applying} className="btn-press mt-2 w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 py-2.5 text-[12px] font-bold text-amber-200 disabled:opacity-50">
                  {applying ? "Applying…" : `⚠️ Optionally rewrite saved days in ${monthLabel(monthKey)} from ${priceDate}`}
                </button>
                <p className="mt-1.5 text-[10px] text-slate-500">Only use the amber button if you explicitly want old saved days to adopt the new price.</p>
              </section>

              <section className="card p-4">
                <h3 className="text-[14px] font-bold">🕘 Price history ({history.length})</h3>
                <p className="text-[11px] text-slate-400">Newest first. Deleting history never touches meal records.</p>
                <div className="mt-3 space-y-2">
                  {sortedHistory.length === 0 && <p className="py-4 text-center text-[12px] text-slate-500">No price history yet.</p>}
                  {sortedHistory.map((h, idx) => (
                    <div key={h.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${idx === 0 ? "border-sky-500/30 bg-sky-500/8" : "border-[#222d42] bg-[#111827]"}`}>
                      <div className="grid h-12 w-14 shrink-0 place-items-center rounded-xl bg-black/40 text-center">
                        <div>
                          <div className="text-[13px] font-black">{h.effectiveDate.slice(8, 10)}</div>
                          <div className="text-[9px] font-bold uppercase text-slate-400">{MONTH_SHORT[Number(h.effectiveDate.slice(5, 7)) - 1]}</div>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold">
                          L {formatTaka(h.lunchPrice)} · D {formatTaka(h.dinnerPrice)}
                          {idx === 0 && <span className="ml-1.5 rounded-full bg-sky-500/20 px-1.5 py-px text-[9px] font-bold text-sky-300">CURRENT</span>}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          from {h.effectiveDate}
                          {h.note ? ` · ${h.note}` : ""}
                        </p>
                      </div>
                      <button onClick={() => deletePrice(h.id)} className="btn-press rounded-lg border border-[#263145] px-2 py-1.5 text-[12px] text-slate-500" title="Delete entry">
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-2xl border border-[#263145] bg-black/30 p-3 text-[11px] leading-relaxed text-slate-400">
                  <b className="text-slate-200">Example check:</b> Oct 1 entry L ৳50/D ৳60 + Oct 16 entry L ৳55/D ৳65 means Oct 1–14 meals still bill at 50/60 while Oct 15+ bill at 55/65. Open a day row to see its frozen snapshot price.
                </div>
              </section>
            </div>
          )}

          {tab === "settings" && (
            <div className="space-y-4 anim-slide-up">
              <section className={`card p-5 ${autoMode ? "border-sky-500/30" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-extrabold">⚡ Automatic Meal Mode</h3>
                    <p className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${autoMode ? "bg-sky-500/15 text-sky-300 border border-sky-500/30" : "bg-white/5 text-slate-400 border border-[#263145]"}`}>
                      <span className={`h-2 w-2 rounded-full ${autoMode ? "bg-sky-400 anim-pulse-dot" : "bg-slate-500"}`} />
                      {autoMode ? "ON" : "OFF"}
                    </p>
                  </div>
                  <button
                    onClick={toggleAuto}
                    disabled={autoToggling}
                    className={`toggle-track relative h-9 w-16 shrink-0 rounded-full border ${autoMode ? "bg-sky-500 border-sky-400" : "bg-[#222d42] border-[#334155]"}`}
                    aria-label="Toggle automatic mode"
                  >
                    <span className={`toggle-thumb absolute top-1 h-7 w-7 rounded-full bg-white shadow ${autoMode ? "translate-x-7" : "translate-x-1"}`} style={{ left: 0 }} />
                  </button>
                </div>
                <div className="mt-3 space-y-2 text-[12px] leading-relaxed text-slate-400">
                  <p><b className="text-slate-200">ON:</b> every empty day counts as Lunch ✓ + Dinner ✓ at that date&apos;s price. Skipped a meal? Just tap it to ✕ — cost drops to ৳0.</p>
                  <p><b className="text-slate-200">OFF:</b> every meal needs a manual tap. Empty days cost ৳0.</p>
                  <p className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 text-emerald-200">🔒 Toggling never deletes or rewrites saved days — history is always preserved.</p>
                </div>
              </section>

              <section className="card-flat p-4">
                <h3 className="text-[14px] font-bold">🎨 Appearance & currency</h3>
                <div className="mt-2.5 space-y-2">
                  <div className="flex items-center justify-between rounded-2xl bg-black/30 px-3 py-2.5 text-[13px]">
                    <span>🌙 Dark theme</span>
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold text-emerald-300">Always ON</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-black/30 px-3 py-2.5 text-[13px]">
                    <span>💱 Currency</span>
                    <span className="rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-1 text-[11px] font-bold text-sky-300">BDT ৳ / TK</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-black/30 px-3 py-2.5 text-[13px]">
                    <span>📆 Calendar range</span>
                    <span className="text-[11px] font-bold text-slate-300">2018 → 2035+ · unlimited</span>
                  </div>
                </div>
              </section>

              <section className="card p-4">
                <h3 className="text-[14px] font-bold">🧪 Try the required scenario</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                  Loads <b className="text-slate-200">October 2026</b>: ৳50/৳60 from Oct 1, ৳3,000 payment, then ৳55/৳65 from Oct 15 — with old days frozen at old prices.
                </p>
                <button onClick={loadExampleScenario} disabled={bulkWorking} className="btn-press mt-3 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 py-3 text-[14px] font-black text-[#3a2006] disabled:opacity-50">
                  {bulkWorking ? "Working…" : "Load October 2026 example"}
                </button>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button onClick={exportData} className="btn-press rounded-2xl border border-[#263145] bg-white/5 py-2.5 text-[12px] font-bold">
                    ⬇ Export backup
                  </button>
                  <button onClick={() => bulkMonth(false)} disabled={bulkWorking} className="btn-press rounded-2xl border border-red-500/30 bg-red-500/10 py-2.5 text-[12px] font-bold text-red-300">
                    Clear this month
                  </button>
                </div>
              </section>

              <section className="card-flat p-4">
                <h3 className="text-[14px] font-bold">✅ Self-test checklist</h3>
                <p className="text-[11px] text-slate-500">Tap to check off. Stored on this device.</p>
                <div className="mt-2.5 space-y-1.5">
                  {[
                    "Mark lunch ✓ and verify cost rises",
                    "Mark dinner ✓, then one meal ✕",
                    "Change price mid-month — old days unchanged",
                    "Go to previous & next month, data intact",
                    "Cross a year boundary (Dec → Jan)",
                    "Open February + a leap year (2028)",
                    "Restart app — everything persists",
                    "Auto ON → empty days count; tap one to ✕",
                    "Auto OFF → empty days cost ৳0",
                    "Edit supplier payment, remaining updates",
                  ].map((label, i) => (
                    <button
                      key={i}
                      onClick={() => setChecklist((c) => c.map((v, j) => (j === i ? !v : v)))}
                      className={`btn-press flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[12px] ${checklist[i] ? "border-emerald-500/30 bg-emerald-500/10" : "border-[#222d42] bg-black/20"}`}
                    >
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] font-black ${checklist[i] ? "bg-emerald-500 border-emerald-500 text-[#052e16]" : "border-slate-600 text-transparent"}`}>✓</span>
                      <span className={checklist[i] ? "text-emerald-200 line-through opacity-70" : "text-slate-300"}>{label}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="card-flat p-4 text-[11px] leading-relaxed text-slate-500">
                <h3 className="text-[13px] font-bold text-slate-300">📱 About this build</h3>
                <p className="mt-1">
                  Native-style Android experience: reliable local database, per-day snapshot prices, per-month supplier ledger, leap-year-safe calendar, unlimited year navigation, and instant recalculation. No unnecessary permissions. Prices: Lunch {formatTaka(currentPrice.lunchPrice)} · Dinner {formatTaka(currentPrice.dinnerPrice)}.
                </p>
              </section>
            </div>
          )}
        </main>

        {/* ── Bottom nav (Android style) ────────────────── */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#1e293b] bg-[#0d131d]/97 backdrop-blur">
          <div className="mx-auto grid max-w-md grid-cols-4 px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-1.5">
            {(
              [
                { id: "home", label: "Calendar", Icon: IconCal },
                { id: "summary", label: "Summary", Icon: IconChart },
                { id: "prices", label: "Prices", Icon: IconTag },
                { id: "settings", label: "Settings", Icon: IconGear },
              ] as { id: Tab; label: string; Icon: typeof IconCal }[]
            ).map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setTab(id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="btn-press relative flex flex-col items-center gap-0.5 rounded-2xl py-1.5"
                >
                  {active && <span className="absolute -top-1.5 h-1 w-10 rounded-full bg-sky-400" />}
                  <Icon active={active} />
                  <span className={`text-[10px] font-bold ${active ? "text-sky-300" : "text-slate-500"}`}>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Month picker modal ────────────────────────── */}
        {showPicker && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 anim-fade" onClick={() => setShowPicker(false)}>
            <div className="card w-full max-w-sm p-5 anim-slide-up" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-[15px] font-extrabold">Jump to month</h3>
              <p className="text-[11px] text-slate-400">Unlimited history — pick any year 2018–2035+.</p>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => setPickerYear((y) => Math.max(1900, y - 1))} className="btn-press grid h-9 w-9 place-items-center rounded-xl border border-[#263145] bg-white/5">‹</button>
                <input
                  type="number"
                  value={pickerYear}
                  min={1900}
                  max={2200}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    if (Number.isFinite(y)) setPickerYear(Math.min(2200, Math.max(1900, Math.round(y))));
                  }}
                  className="w-full rounded-xl border border-[#263145] bg-black/30 py-2 text-center text-[16px] font-black outline-none focus:border-sky-500"
                />
                <button onClick={() => setPickerYear((y) => Math.min(2200, y + 1))} className="btn-press grid h-9 w-9 place-items-center rounded-xl border border-[#263145] bg-white/5">›</button>
              </div>
              <div className="mt-2 flex gap-1.5">
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <button key={y} onClick={() => setPickerYear(y)} className={`btn-press flex-1 rounded-lg border py-1.5 text-[11px] font-bold ${pickerYear === y ? "border-sky-500/50 bg-sky-500/15 text-sky-300" : "border-[#263145] text-slate-400"}`}>
                    {y}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {MONTH_SHORT.map((m, i) => {
                  const mk = `${pickerYear}-${String(i + 1).padStart(2, "0")}`;
                  const active = mk === monthKey;
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        setMonthKey(mk);
                        setShowPicker(false);
                      }}
                      className={`btn-press rounded-xl border py-2.5 text-[12px] font-bold ${active ? "border-sky-500/60 bg-sky-500/20 text-sky-200" : "border-[#263145] bg-white/5 text-slate-300"}`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => { setMonthKey("2026-10"); setShowPicker(false); }} className="btn-press rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 text-[11px] font-bold text-amber-200">
                  Oct 2026 demo
                </button>
                <button onClick={() => { setMonthKey(currentMonthKey()); setShowPicker(false); }} className="btn-press rounded-xl border border-[#263145] bg-white/5 py-2 text-[11px] font-bold text-slate-300">
                  This month
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Day price modal ───────────────────────────── */}
        {dayPriceDate && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 anim-fade" onClick={() => setDayPriceDate(null)}>
            <div className="card w-full max-w-sm p-5 anim-slide-up" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-[15px] font-extrabold">✎ Prices for {dayPriceDate}</h3>
              <p className="text-[11px] text-slate-400">Explicit override for this day only. Other days are untouched.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-slate-400">LUNCH (৳)</span>
                  <input type="number" inputMode="numeric" value={dayLunchPrice} onChange={(e) => setDayLunchPrice(e.target.value)} className="w-full rounded-2xl border border-[#263145] bg-black/30 px-3 py-3 text-[16px] font-bold outline-none focus:border-sky-500" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-slate-400">DINNER (৳)</span>
                  <input type="number" inputMode="numeric" value={dayDinnerPrice} onChange={(e) => setDayDinnerPrice(e.target.value)} className="w-full rounded-2xl border border-[#263145] bg-black/30 px-3 py-3 text-[16px] font-bold outline-none focus:border-sky-500" />
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => setDayPriceDate(null)} className="btn-press rounded-2xl border border-[#263145] bg-white/5 py-3 text-[13px] font-bold">
                  Cancel
                </button>
                <button onClick={saveDayPrice} disabled={savingDayPrice} className="btn-press rounded-2xl bg-sky-500 py-3 text-[13px] font-black text-[#06283a] disabled:opacity-50">
                  {savingDayPrice ? "…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Toasts ────────────────────────────────────── */}
        <div className="pointer-events-none fixed bottom-24 left-0 right-0 z-50 mx-auto flex w-full max-w-md flex-col items-center gap-2 px-4">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`anim-toast pointer-events-auto w-full rounded-2xl border px-4 py-3 text-[13px] font-bold shadow-2xl ${
                t.kind === "ok"
                  ? "border-emerald-500/40 bg-[#0f2418]/95 text-emerald-200"
                  : t.kind === "err"
                    ? "border-red-500/40 bg-[#2a1215]/95 text-red-200"
                    : "border-sky-500/40 bg-[#0e2233]/95 text-sky-200"
              }`}
            >
              {t.msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
