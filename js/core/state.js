// Reservations-backed state.
//
// Single table `reservations`:
//   { id, slug, house, period_from, period_to (nullable), created_at }
//
//   - period_to = null  => open-ended use ("Bruk nå", no scheduled end)
//   - period_from <= now < (period_to ?? +inf)  => currently in use
//   - period_from > now  => future reservation
//   - period_to <= now   => past (history)
//
// Each item can have many rows. Disconnected reservation days are stored as
// separate rows, one per contiguous block.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseConfig.js?v=1778488612";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 5 } },
});

// slug -> array of "current+future" reservation rows, sorted by period_from.
const cache = new Map();
const listeners = new Set();

function notify() {
  for (const fn of listeners) {
    try { fn(cache); } catch (err) { console.warn(err); }
  }
}

export function subscribeState(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function isActive(row, nowMs) {
  const start = Date.parse(row.period_from);
  if (!Number.isFinite(start) || start > nowMs) return false;
  if (!row.period_to) return true;
  return Date.parse(row.period_to) > nowMs;
}

function isFuture(row, nowMs) {
  return Date.parse(row.period_from) > nowMs;
}

function isPast(row, nowMs) {
  return row.period_to && Date.parse(row.period_to) <= nowMs;
}

// Returns the current view: { status, holder, period_from, period_to, next }
export function getState(slug, now = Date.now()) {
  const rows = cache.get(slug) || [];
  const active = rows.find((r) => isActive(r, now));
  const future = rows
    .filter((r) => isFuture(r, now))
    .sort((a, b) => Date.parse(a.period_from) - Date.parse(b.period_from));
  const next = future[0] || null;

  if (active) {
    return {
      status: "in_use",
      holder: active.house,
      period_from: active.period_from,
      period_to: active.period_to,
      next,
      activeId: active.id,
    };
  }
  if (next) {
    return {
      status: "reserved",
      holder: next.house,
      period_from: next.period_from,
      period_to: next.period_to,
      next,
      activeId: null,
    };
  }
  return { status: "available", holder: null, period_from: null, period_to: null, next: null, activeId: null };
}

// All upcoming reservations (active + future) for a slug.
export function getUpcoming(slug, now = Date.now()) {
  const rows = cache.get(slug) || [];
  return rows
    .filter((r) => !isPast(r, now))
    .sort((a, b) => Date.parse(a.period_from) - Date.parse(b.period_from));
}

// Past reservations for the "Sist brukt" list.
export async function getHistory(slug, limit = 10) {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("slug", slug)
    .not("period_to", "is", null)
    .lte("period_to", new Date().toISOString())
    .order("period_to", { ascending: false })
    .limit(limit);
  if (error) { console.warn("getHistory", error); return []; }
  return data || [];
}

// All past reservations across every slug, with optional filters.
// Used by the localhost-only admin page.
export async function getAllHistory({ house = null, slug = null, limit = 500 } = {}) {
  let q = supabase
    .from("reservations")
    .select("*")
    .not("period_to", "is", null)
    .lte("period_to", new Date().toISOString())
    .order("period_to", { ascending: false })
    .limit(limit);
  if (house) q = q.eq("house", house);
  if (slug) q = q.eq("slug", slug);
  const { data, error } = await q;
  if (error) { console.warn("getAllHistory", error); return []; }
  return data || [];
}

// Past reservations within the last `daysBack` days (default 14), newest first.
// Used by the public "Sist brukt" line and by the upcoming calendar view.
export async function getRecentHistory(slug, daysBack = 14, limit = 50) {
  const cutoff = new Date(Date.now() - daysBack * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("slug", slug)
    .not("period_to", "is", null)
    .lte("period_to", new Date().toISOString())
    .gte("period_to", cutoff)
    .order("period_to", { ascending: false })
    .limit(limit);
  if (error) { console.warn("getRecentHistory", error); return []; }
  return data || [];
}

// Returns reservations for a slug within a +/- window around today, combining
// past rows (fetched fresh) with the in-memory cache for current+future.
// Intended for the upcoming calendar view (currently unused; the API is
// stable so the calendar component can be added without further changes).
export async function getCalendarWindow(slug, { daysBack = 14, daysAhead = 14 } = {}) {
  const past = await getRecentHistory(slug, daysBack, 200);
  const upcoming = getUpcoming(slug); // active + future from cache
  const horizonMs = Date.now() + daysAhead * 24 * 3600 * 1000;
  const futureBounded = upcoming.filter((r) => Date.parse(r.period_from) <= horizonMs);
  return { past, upcoming: futureBounded };
}

// All reservations across every slug whose period overlaps a window of
// [today - daysBack, today + daysAhead] inclusive. Used by the global
// calendar view that shows events for all items at once.
export async function getAllCalendar({ daysBack = 14, daysAhead = 14 } = {}) {
  const dayMs = 24 * 3600 * 1000;
  const fromIso = new Date(Date.now() - daysBack * dayMs).toISOString();
  const toIso = new Date(Date.now() + (daysAhead + 1) * dayMs).toISOString();
  // overlap test: period_from <= window_end AND (period_to is null OR period_to >= window_start)
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .lte("period_from", toIso)
    .or(`period_to.is.null,period_to.gte.${fromIso}`)
    .order("period_from", { ascending: true });
  if (error) { console.warn("getAllCalendar", error); return []; }
  return data || [];
}

// ---- User-created calendar events --------------------------------------
// Stored in `events` table:
//   { id, house, title, description, event_date (date), created_at }
// Anyone can read; anyone can insert; only the row's house can edit/delete
// (enforced client-side here, since RLS is disabled for this project).

function dateOnlyIso(ts) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function getEventsInWindow({ daysBack = 14, daysAhead = 14 } = {}) {
  const dayMs = 24 * 3600 * 1000;
  const fromDate = dateOnlyIso(Date.now() - daysBack * dayMs);
  const toDate = dateOnlyIso(Date.now() + daysAhead * dayMs);
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .gte("event_date", fromDate)
    .lte("event_date", toDate)
    .order("event_date", { ascending: true });
  if (error) { console.warn("getEventsInWindow", error); return []; }
  return data || [];
}

export async function createEvent({ house, title, description, event_date, time_from, time_to, created_by_house }) {
  const row = {
    house,
    title: String(title || "").trim(),
    description: (description == null ? null : String(description).trim()) || null,
    event_date,
    time_from: time_from || null,
    time_to: time_to || null,
    created_by_house: created_by_house || house || null,
  };
  const { data, error } = await supabase.from("events").insert(row).select().single();
  if (error) throw error;
  notify();
  return data;
}

export async function updateEvent(id, { house, title, description, event_date, time_from, time_to }) {
  const patch = {};
  if (house != null) patch.house = String(house);
  if (title != null) patch.title = String(title).trim();
  if (description !== undefined) patch.description = description ? String(description).trim() : null;
  if (event_date != null) patch.event_date = event_date;
  if (time_from !== undefined) patch.time_from = time_from || null;
  if (time_to !== undefined) patch.time_to = time_to || null;
  const { data, error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  notify();
  return data;
}

export async function deleteEvent(id) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
  notify();
}

// Admin: delete every event row.
export async function deleteAllEvents() {
  const { error } = await supabase.from("events").delete().not("id", "is", null);
  if (error) throw error;
  notify();
}

// Admin: delete every reservation row (current, future, and history).
export async function deleteAllReservations() {
  const { error } = await supabase.from("reservations").delete().not("id", "is", null);
  if (error) throw error;
  cache.clear();
  notify();
}

// Admin: fetch all events across all houses, optionally filtered.
export async function getAllEvents({ house = null, limit = 500 } = {}) {
  let q = supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: false })
    .order("time_from", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (house) q = q.eq("house", house);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function loadAllState() {
  // Pull only current + future rows. History is fetched on demand.
  const nowISO = new Date().toISOString();
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .or(`period_to.is.null,period_to.gt.${nowISO}`);
  if (error) { console.warn("loadAllState", error); return; }
  cache.clear();
  for (const row of data || []) {
    if (!cache.has(row.slug)) cache.set(row.slug, []);
    cache.get(row.slug).push(row);
  }
  notify();
}

export function startRealtime() {
  supabase
    .channel("reservations-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "reservations" },
      (payload) => {
        const row = payload.new || payload.old;
        if (!row || !row.slug) return;
        const list = cache.get(row.slug) || [];
        if (payload.eventType === "DELETE") {
          cache.set(row.slug, list.filter((r) => r.id !== row.id));
        } else {
          const idx = list.findIndex((r) => r.id === row.id);
          const nowMs = Date.now();
          if (isPast(payload.new, nowMs)) {
            // Drop from current/future cache when a row is closed out.
            if (idx >= 0) list.splice(idx, 1);
          } else if (idx >= 0) {
            list[idx] = payload.new;
          } else {
            list.push(payload.new);
          }
          cache.set(row.slug, list);
        }
        notify();
      }
    )
    .subscribe();

  // Events table: any change just kicks listeners so the calendar reloads.
  supabase
    .channel("events-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "events" },
      () => notify(),
    )
    .subscribe();

  // Tick once a minute so reservations that pass their start time flip to
  // "in use" in the UI without a page reload.
  setInterval(() => notify(), 60_000);
}

// ---- Public actions -----------------------------------------------------

// Start using right now, no scheduled end.
export async function useItem(slug, house) {
  const row = {
    slug, house,
    period_from: new Date().toISOString(),
    period_to: null,
  };
  const { data, error } = await supabase.from("reservations").insert(row).select().single();
  if (error) throw error;
  applyLocal(data);
}

// Reserve one or more contiguous blocks.
// `blocks` is an array of { from: ISOString, to: ISOString }.
export async function reserveBlocks(slug, house, blocks) {
  if (!blocks.length) return;
  const rows = blocks.map((b) => ({
    slug, house, period_from: b.from, period_to: b.to,
  }));
  const { data, error } = await supabase.from("reservations").insert(rows).select();
  if (error) throw error;
  for (const r of data || []) applyLocal(r);
}

// End the currently-active period for this slug. If there is no active
// period (only a future reservation), this does nothing — the caller should
// use cancelReservation for that case.
export async function endActive(slug, now = new Date()) {
  const rows = cache.get(slug) || [];
  const active = rows.find((r) => isActive(r, now.getTime()));
  if (!active) return false;
  const { data, error } = await supabase
    .from("reservations")
    .update({ period_to: now.toISOString() })
    .eq("id", active.id)
    .select()
    .single();
  if (error) throw error;
  applyLocal(data);
  return true;
}

// Cancel a single future reservation (no history written).
export async function cancelReservation(id) {
  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) throw error;
  // Local cleanup
  for (const [slug, list] of cache) {
    const idx = list.findIndex((r) => r.id === id);
    if (idx >= 0) {
      list.splice(idx, 1);
      cache.set(slug, list);
    }
  }
  notify();
}

function applyLocal(row) {
  const list = cache.get(row.slug) || [];
  const idx = list.findIndex((r) => r.id === row.id);
  const nowMs = Date.now();
  if (isPast(row, nowMs)) {
    if (idx >= 0) list.splice(idx, 1);
  } else if (idx >= 0) {
    list[idx] = row;
  } else {
    list.push(row);
  }
  cache.set(row.slug, list);
  notify();
}

// Persist last-used house in localStorage so the picker pre-selects it.
const HOUSE_KEY = "sb.lastHouse";
export function getLastHouse() {
  try { return localStorage.getItem(HOUSE_KEY) || ""; } catch { return ""; }
}
export function setLastHouse(h) {
  try { localStorage.setItem(HOUSE_KEY, h); } catch {}
}
