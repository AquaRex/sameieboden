/* Sameieboden — service worker
 * Goal: full app shell works offline. Items list (the primary purpose
 * of this site) must render even with no network.
 *
 * Strategy:
 *   - Precache the entire app shell on install (HTML, CSS partials,
 *     every JS module, items.json, icons, manifest).
 *   - Navigation: network-first, fall back to cached index.html.
 *   - data/items.json: network-first so users see fresh stock when
 *     online, but always fall back to cached copy when offline.
 *   - Other own-origin GETs (JS, CSS, images): cache-first.
 *   - Cache lookups use { ignoreSearch: true } so `?v=1` cache-busting
 *     query strings still hit the precached entries.
 *   - Bump CACHE_VERSION on any deploy that needs forced eviction.
 */
const CACHE_VERSION = "v109";
const STATIC_CACHE = `sb-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `sb-runtime-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./data/items.json",

  // Stylesheet entry. The @imported partials are cached lazily on first
  // request, but we list them here so first offline visit also works.
  "./styles/main.css",
  "./styles/base.css",
  "./styles/layout.css",
  "./styles/utilities.css",
  "./styles/components/interactives/button.css",
  "./styles/components/interactives/icon-button.css",
  "./styles/components/interactives/tag-chip.css",
  "./styles/components/interactives/view-toggle.css",
  "./styles/components/interactives/house-badge.css",
  "./styles/components/interactives/hamburger.css",
  "./styles/components/interactives/install-button.css",
  "./styles/components/forms/search-bar.css",
  "./styles/components/forms/dropdown.css",
  "./styles/components/forms/date-picker.css",
  "./styles/components/forms/time-picker.css",
  "./styles/components/forms/day-picker.css",
  "./styles/components/forms/editor-fields.css",
  "./styles/components/overlays/modal.css",
  "./styles/components/overlays/lightbox.css",
  "./styles/components/overlays/toast.css",
  "./styles/components/overlays/confirm-dialog.css",
  "./styles/components/overlays/house-picker.css",
  "./styles/components/items/grid.css",
  "./styles/components/items/card.css",
  "./styles/components/items/item-detail.css",
  "./styles/components/calendar/calendar.css",
  "./styles/components/calendar/event-editor.css",
  "./styles/components/chat/chat.css",
  "./styles/components/chat/message-bubble.css",

  // Public JS modules. Admin/local-only modules are not precached.
  "./js/main.js",
  "./js/core/env.js",
  "./js/core/store.js",
  "./js/core/state.js",
  "./js/core/search.js",
  "./js/core/currentHouse.js",
  "./js/core/serverApi.js",
  "./js/core/supabaseConfig.js",
  "./js/core/defaultData.js",
  "./js/helpers/dom.js",
  "./js/helpers/dates.js",
  "./js/helpers/errors.js",
  "./js/helpers/toast.js",
  "./js/components/interactives/button.js",
  "./js/components/interactives/viewToggle.js",
  "./js/components/interactives/houseBadge.js",
  "./js/components/interactives/installButton.js",
  "./js/components/interactives/hamburgerMenu.js",
  "./js/components/forms/searchBar.js",
  "./js/components/forms/tagFilters.js",
  "./js/components/forms/dropdown.js",
  "./js/components/forms/datePicker.js",
  "./js/components/forms/timePicker.js",
  "./js/components/forms/dayPicker.js",
  "./js/components/overlays/lightbox.js",
  "./js/components/overlays/confirmDialog.js",
  "./js/components/overlays/housePicker.js",
  "./js/components/items/grid.js",
  "./js/components/items/card.js",
  "./js/components/items/itemDetail.js",
  "./js/components/calendar/calendarView.js",
  "./js/components/calendar/eventEditor.js",
  "./js/components/chat/chatLauncher.js",
  "./js/components/chat/chatWindow.js",
  "./js/components/chat/messageBubble.js",
  "./js/components/chat/chatInput.js",
  "./js/core/chat.js",
  "./js/core/push.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // addAll is atomic: if one URL fails, nothing is cached. Cache
      // entries individually so a single 404 doesn't break offline.
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("[sw] precache failed:", url, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Match against any cache, ignoring ?v=N cache-busting queries so the
// precached shell still satisfies versioned imports.
function matchAnyCache(req) {
  return caches.match(req, { ignoreSearch: true });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept the local dev API.
  if (url.pathname.startsWith("/api/")) return;

  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    // Network-first for navigation. Falls back to cached index.html
    // so the app shell renders even when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          matchAnyCache(req).then(
            (hit) => hit || matchAnyCache(new Request("./index.html"))
          )
        )
    );
    return;
  }

  const isJSON = url.pathname.endsWith(".json");
  if (isJSON) {
    // items.json must be fresh when online, but should always fall back
    // to the last cached copy so the equipment list still renders offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => matchAnyCache(req))
    );
    return;
  }

  // Cache-first for static assets (JS modules, CSS, images, icons).
  event.respondWith(
    matchAnyCache(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});

// ---------------------------------------------------------------------------
// Web Push — display a notification when a chat message arrives. Payload
// is JSON: { from, to, body }. `to` is null for broadcast messages.
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }

  const from = data.from || "Nabo";
  const isBroadcast = data.to == null;
  const title = isBroadcast
    ? `Alle hus · ${from}`
    : `Melding fra ${from}`;
  const body = (data.body || "").slice(0, 220);

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      tag: isBroadcast ? "chat-all" : `chat-${from}`,
      renotify: true,
      data: { from, to: data.to },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(self.registration.scope)) {
          w.focus();
          w.postMessage({ type: "open-chat", from: event.notification.data?.from });
          return;
        }
      }
      return self.clients.openWindow("./");
    })
  );
});
