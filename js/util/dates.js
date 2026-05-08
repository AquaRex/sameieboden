// Date and time helpers shared across components.

export const DAY_MS = 86400000;

export function startOfDay(d) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function startOfDayMs(d = new Date()) {
  return startOfDay(d).getTime();
}

export function labelForDay(ts) {
  const today = startOfDayMs();
  if (ts === today) return "i dag";
  if (ts === today + DAY_MS) return "i morgen";
  const d = new Date(ts);
  return d.toLocaleDateString("no-NO", { weekday: "short", day: "numeric", month: "short" });
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const today = new Date();
  const sameDay = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  const time = d.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `i dag ${time}`;
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.getFullYear() === tomorrow.getFullYear() && d.getMonth() === tomorrow.getMonth() && d.getDate() === tomorrow.getDate())
    return `i morgen ${time}`;
  return `${d.toLocaleDateString("no-NO", { day: "numeric", month: "short" })} ${time}`;
}

export function formatBlock(fromISO, toISO) {
  const from = new Date(fromISO);
  if (!toISO) return `siden ${formatDateTime(fromISO)}`;
  const to = new Date(toISO);
  const sameDay = from.toDateString() === to.toDateString();
  if (sameDay) return from.toLocaleDateString("no-NO", { weekday: "short", day: "numeric", month: "short" });
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  const fromStr = sameMonth
    ? String(from.getDate())
    : from.toLocaleDateString("no-NO", { day: "numeric", month: "short" });
  const toStr = to.toLocaleDateString("no-NO", { day: "numeric", month: "short" });
  return `${fromStr}.–${toStr}`;
}

export function formatWhen(iso) {
  const then = new Date(iso);
  const diffMs = Date.now() - then.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return " · nå";
  if (min < 60) return ` · ${min} min siden`;
  const hr = Math.round(min / 60);
  if (hr < 24) return ` · ${hr} t siden`;
  const days = Math.round(hr / 24);
  if (days < 7) return ` · ${days} d siden`;
  return ` · ${then.toLocaleDateString("no-NO", { day: "numeric", month: "short" })}`;
}

// Group consecutive day timestamps into [{from, to}] ISO ranges (whole-day).
export function daysToBlocks(sortedDayMs) {
  const blocks = [];
  let runStart = null, runEnd = null;
  for (const ts of sortedDayMs) {
    if (runStart == null) { runStart = ts; runEnd = ts; }
    else if (ts === runEnd + DAY_MS) { runEnd = ts; }
    else { blocks.push(makeBlock(runStart, runEnd)); runStart = ts; runEnd = ts; }
  }
  if (runStart != null) blocks.push(makeBlock(runStart, runEnd));
  return blocks;
}

function makeBlock(startMs, endMs) {
  const from = new Date(startMs);
  const to = new Date(endMs);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}
