// Single source of truth for equipment data.
// Pub/sub so any component can react to changes without
// knowing about other components.

import { DEFAULT_EQUIPMENT } from "./defaultData.js?v=3";
import { uid } from "./dom.js?v=3";

const STORAGE_KEY = "bvs.equipment.v1";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_EQUIPMENT);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return clone(DEFAULT_EQUIPMENT);
    return parsed.map(normalize);
  } catch {
    return clone(DEFAULT_EQUIPMENT);
  }
}

function persist(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Quota or private mode — ignore; in-memory state still works.
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(raw) {
  return {
    id: raw.id || uid(),
    name: String(raw.name || "").trim(),
    description: String(raw.description || "").trim(),
    tags: Array.isArray(raw.tags)
      ? raw.tags.map((t) => String(t).trim()).filter(Boolean)
      : [],
    image: typeof raw.image === "string" ? raw.image : "",
    imageThumb: typeof raw.imageThumb === "string" ? raw.imageThumb : "",
    imagePos: typeof raw.imagePos === "string" && raw.imagePos.trim()
      ? raw.imagePos.trim()
      : "50% 50%",
    imageZoom: Number.isFinite(raw.imageZoom) && raw.imageZoom >= 1
      ? Math.min(5, raw.imageZoom)
      : 1,
  };
}

const listeners = new Set();
let items = load();

function emit() {
  for (const fn of listeners) fn(items);
}

export const store = {
  getAll() {
    return items;
  },
  get(id) {
    return items.find((it) => it.id === id) || null;
  },
  subscribe(fn) {
    listeners.add(fn);
    fn(items);
    return () => listeners.delete(fn);
  },
  add(partial) {
    const item = normalize({ ...partial, id: uid() });
    items = [...items, item];
    persist(items);
    emit();
    return item;
  },
  update(id, patch) {
    items = items.map((it) => (it.id === id ? normalize({ ...it, ...patch, id }) : it));
    persist(items);
    emit();
  },
  remove(id) {
    items = items.filter((it) => it.id !== id);
    persist(items);
    emit();
  },
  replaceAll(newItems) {
    items = newItems.map(normalize);
    persist(items);
    emit();
  },
  resetToDefaults() {
    items = clone(DEFAULT_EQUIPMENT).map(normalize);
    persist(items);
    emit();
  },
  allTags() {
    const set = new Set();
    for (const it of items) for (const t of it.tags) set.add(t);
    return [...set].sort((a, b) => a.localeCompare(b, "no"));
  },
};
