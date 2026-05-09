// Public read-only API. Loads items.json so the static site can render
// even without the dev server running.

export async function loadItems() {
  try {
    const res = await fetch("data/items.json", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

export function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "oe")
    .replaceAll("å", "aa")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "image";
}
