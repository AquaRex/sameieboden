// Wrapper around the local dev server API (dev_server.py). All calls
// fail safely when the server isn't running so the static site keeps
// working.

const API_TIMEOUT_MS = 10000;

async function request(method, url, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status} ${text}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

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

export async function saveItems(items) {
  return request("PUT", "/api/items", items);
}

export async function uploadImage(slug, dataUrl) {
  const res = await request("POST", "/api/upload", { slug, dataUrl });
  return res.path;
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
