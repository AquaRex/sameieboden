// Privacy-respecting usage analytics.
//
// Currently tracks one event: "user picked a house in the house-picker".
// Stored in Supabase table `house_picks` (see supabase/sql/house_picks_setup.sql).
//
// What we collect (all already available client-side, no fingerprinting):
//   - house, previous_house
//   - user_agent, language, timezone, screen size, referrer, is_pwa
// What we deliberately do NOT collect: IP, geolocation, persistent
// visitor id, cookies. Country is only inferred loosely from timezone.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseConfig.js?v=1778517012";
import { isLocal } from "./env.js?v=1778517012";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// Skip writes when running on localhost so dev/test traffic doesn't pollute
// the production analytics. Reads (admin page) still work normally.
const TRACKING_DISABLED = isLocal();

function safe(fn, fallback = null) {
  try { return fn(); } catch { return fallback; }
}

function isStandalone() {
  return safe(
    () =>
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      window.navigator.standalone === true,
    false
  );
}

function collectContext() {
  return {
    user_agent: safe(() => navigator.userAgent || null),
    language: safe(() => navigator.language || null),
    timezone: safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone || null),
    screen_size: safe(() => {
      const w = window.screen?.width;
      const h = window.screen?.height;
      return w && h ? `${w}x${h}` : null;
    }),
    referrer: safe(() => document.referrer || null),
    is_pwa: isStandalone(),
  };
}

// Fire-and-forget. Never throws, never blocks the UI.
export function logHousePick(house, { previousHouse = null } = {}) {
  if (!house) return;
  if (TRACKING_DISABLED) return;
  const row = { house, previous_house: previousHouse || null, source: "pick", ...collectContext() };
  supabase
    .from("house_picks")
    .insert(row)
    .then(({ error }) => {
      if (error) console.warn("[analytics] logHousePick", error);
    })
    .catch((err) => console.warn("[analytics] logHousePick", err));
}

// Log a "page open" event — same shape as a house pick, but `previous_house`
// is null and we mark the source as "open" so the admin view can tell
// picks vs opens apart. We throttle per session (sessionStorage) so a
// single real app launch only creates one row, even if React-style
// refreshes happen during the same tab/PWA session.
const OPEN_SESSION_KEY = "sb.analytics.openLogged";

export function logSessionOpen(house) {
  if (!house) return;
  if (TRACKING_DISABLED) return;
  try {
    if (sessionStorage.getItem(OPEN_SESSION_KEY) === "1") return;
    sessionStorage.setItem(OPEN_SESSION_KEY, "1");
  } catch {
    // sessionStorage might be unavailable (private mode, etc) — log anyway.
  }
  const row = {
    house,
    previous_house: null,
    source: "open",
    ...collectContext(),
  };
  supabase
    .from("house_picks")
    .insert(row)
    .then(({ error }) => {
      if (error) console.warn("[analytics] logSessionOpen", error);
    })
    .catch((err) => console.warn("[analytics] logSessionOpen", err));
}

// Admin helpers (used by the localhost admin page).
export async function adminListHousePicks({ house = null, limit = 500 } = {}) {
  let q = supabase
    .from("house_picks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (house) q = q.eq("house", house);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function adminDeleteAllHousePicks() {
  // Match all rows: id is always > 0.
  const { error } = await supabase.from("house_picks").delete().gt("id", 0);
  if (error) throw error;
}
