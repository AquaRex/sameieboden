// "Which house am I" — global per-device setting.
// Stored in localStorage; listeners notified on change.

const KEY = "sb.currentHouse";
const listeners = new Set();

export function getCurrentHouse() {
  try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
}

export function setCurrentHouse(house) {
  try {
    if (house) localStorage.setItem(KEY, house);
    else localStorage.removeItem(KEY);
  } catch {}
  for (const fn of listeners) {
    try { fn(house); } catch (err) { console.warn(err); }
  }
}

export function subscribeCurrentHouse(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
