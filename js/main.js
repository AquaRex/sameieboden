import { isLocal } from "./env.js?v=4";
import { store } from "./store.js?v=3";
import { filterItems } from "./search.js?v=3";
import { createSearchBar } from "./components/searchBar.js?v=3";
import { createTagFilters } from "./components/tagFilters.js?v=3";
import { createGrid } from "./components/grid.js?v=3";
import { createViewToggle } from "./components/viewToggle.js?v=3";
import { createLightbox } from "./components/lightbox.js?v=3";
import { createItemDetail } from "./components/itemDetail.js?v=22";
import { createHousePicker } from "./components/housePicker.js?v=1";
import { createHouseBadge } from "./components/houseBadge.js?v=2";
import { createCalendarView } from "./components/calendarView.js?v=7";
import { createButton } from "./components/button.js?v=1";
import { createInstallButton } from "./components/installButton.js?v=2";
import { confirmDialog } from "./components/confirmDialog.js?v=1";
import { createHamburgerMenu } from "./components/hamburgerMenu.js?v=1";
import { getCurrentHouse, subscribeCurrentHouse } from "./currentHouse.js?v=1";
import { loadItems } from "./serverApi.js?v=3";
import { loadAllState, startRealtime, subscribeState } from "./state.js?v=13";

const editable = isLocal();
let currentQuery = "";
let currentTag = null;
let editor = null; // populated by editable bootstrap

const controls = document.getElementById("controls");
const gridSection = document.getElementById("grid-section");
const toolbarMount = document.getElementById("toolbar-mount");

const searchBar = createSearchBar({
  onChange: (q) => { currentQuery = q; rerender(); },
});

const housePicker = createHousePicker();
const houseBadge = createHouseBadge({
  onClick: () => housePicker.open({ dismissable: true }),
});

const calendarView = createCalendarView({ getItems: () => store.getAll() });
const calendarButton = createButton({
  label: "Kalender",
  icon: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><path fill="currentColor" d="M6 5 h3 V3 a1.5 1.5 0 0 1 3 0 v2 h8 V3 a1.5 1.5 0 0 1 3 0 v2 h3 a2 2 0 0 1 2 2 v4 H4 V7 a2 2 0 0 1 2 -2 z M4 13 h24 v14 a2 2 0 0 1 -2 2 H6 a2 2 0 0 1 -2 -2 z"/></svg>`,
  variant: "default",
  onClick: () => calendarView.open(),
  title: "Vis kalender",
  ariaLabel: "Vis kalender",
});

const tagFilters = createTagFilters({
  onChange: (t) => { currentTag = t; rerender(); },
});

const viewToggle = createViewToggle({
  onChange: (mode) => grid.setView(mode),
});

const grid = createGrid({
  editable,
  view: viewToggle.value,
  onEdit: (item) => editor && editor.open(item),
  onDelete: async (item) => {
    const ok = await confirmDialog({
      title: "Slett gjenstand?",
      message: `"${item.name}" blir fjernet fra listen.`,
      confirmLabel: "Slett",
      cancelLabel: "Avbryt",
      danger: true,
    });
    if (ok) store.remove(item.id);
  },
  onOpen: (item) => {
    itemDetail.open(item);
  },
});

const lightbox = createLightbox();
const itemDetail = createItemDetail({
  onOpenImage: (item) => {
    const list = lastFiltered.length ? lastFiltered : store.getAll();
    const idx = list.findIndex((it) => it.id === item.id);
    lightbox.open(list, Math.max(0, idx));
  },
  onChangeHouse: () => housePicker.open({ dismissable: true }),
  showHistory: editable,
  allowHistoryDelete: editable,
});
let lastFiltered = [];

const countRow = document.createElement("div");
countRow.className = "count-row";
countRow.append(grid.count, viewToggle.root);

const searchRow = document.createElement("div");
searchRow.className = "search-row";
searchRow.append(searchBar.root);

const hamMenu = createHamburgerMenu({ ariaLabel: "Meny" });
hamMenu.panel.append(calendarButton.root);
const hamMount = document.getElementById("ham-mount");
if (hamMount) hamMount.appendChild(hamMenu.root);

const houseMount = document.getElementById("house-mount");
if (houseMount) houseMount.appendChild(houseBadge.root);

const installButton = createInstallButton();
if (installButton) {
  const mount = document.getElementById("install-mount");
  if (mount) mount.appendChild(installButton.root);
}
controls.append(searchRow, tagFilters.root, countRow);
gridSection.append(grid.list, grid.empty);

store.subscribe((items) => {
  tagFilters.setTags(store.allTags());
  rerender(items);
});

// data/items.json is the source of truth for the public site.
let initialLoadDone = false;
loadItems().then((items) => {
  if (items) store.replaceAll(items);
  initialLoadDone = true;
});

function rerender(items = store.getAll()) {
  const filtered = filterItems(items, { query: currentQuery, tag: currentTag });
  lastFiltered = filtered;
  grid.render(filtered, items.length);
}

// Live status: load once, subscribe to changes, re-render cards when state shifts.
loadAllState().then(() => { rerender(); startRealtime(); });
subscribeState(() => rerender());

// Re-render cards when the user switches house (active/own indicators may change).
subscribeCurrentHouse(() => rerender());

// First visit: ask which house this device belongs to. Mandatory.
if (!getCurrentHouse()) {
  housePicker.open({ dismissable: false });
}

// ---------------------------------------------------------------------------
// Editable bootstrap. All localhost-only modules are dynamically imported so
// they can be excluded from the public build entirely. If they're missing,
// the public site loads fine and just skips edit features.
// ---------------------------------------------------------------------------
if (editable) {
  bootstrapEditable().catch((err) => {
    console.warn("Edit features unavailable:", err);
  });
}

async function bootstrapEditable() {
  document.body.classList.add("is-editable");

  const [
    editorMod,
    toolbarMod,
    serverApiMod,
  ] = await Promise.all([
    import("../sameiebodenlocal/js/components/editor.js?v=3"),
    import("../sameiebodenlocal/js/components/toolbar.js?v=4"),
    import("../sameiebodenlocal/js/serverWriteApi.js?v=1"),
  ]);
  const { createEditor } = editorMod;
  const { createToolbar } = toolbarMod;
  const { saveItems, uploadImage, slugify } = serverApiMod;

  editor = createEditor({
    getKnownTags: () => store.allTags(),
    onSave: async (mode, id, data) => {
      // Upload fresh data-URL images so the public site can serve them
      // from images/. Cache-bust both URLs with the same timestamp so a
      // replaced file doesn't get served from the browser cache.
      const cacheBust = Date.now();
      if (data.image && data.image.startsWith("data:")) {
        try {
          const slug = slugify(data.name);
          const fullPath = await uploadImage(slug, data.image);
          data.image = `${fullPath}?v=${cacheBust}`;
          if (data.imageThumb && data.imageThumb.startsWith("data:")) {
            const thumbPath = await uploadImage(`${slug}-thumb`, data.imageThumb);
            data.imageThumb = `${thumbPath}?v=${cacheBust}`;
          }
        } catch (err) {
          console.warn("Image upload failed, keeping inline data URL:", err);
        }
      } else if (data.imageThumb && data.imageThumb.startsWith("data:")) {
        try {
          const slug = slugify(data.name);
          const thumbPath = await uploadImage(`${slug}-thumb`, data.imageThumb);
          data.imageThumb = `${thumbPath}?v=${cacheBust}`;
        } catch (err) {
          console.warn("Thumb upload failed:", err);
        }
      }
      if (mode === "edit" && id) store.update(id, data);
      else store.add(data);
    },
  });

  const toolbar = createToolbar({
    onAdd: () => editor.open(null),
    onReset: async () => {
      const ok = await confirmDialog({
        title: "Tilbakestill listen?",
        message: "Dette sletter dine endringer og henter standardverdier.",
        confirmLabel: "Tilbakestill",
        cancelLabel: "Avbryt",
        danger: true,
      });
      if (ok) store.resetToDefaults();
    },
  });
  if (toolbarMount) toolbarMount.appendChild(toolbar.root);

  // Persist store changes to disk via the local dev server.
  let saveTimer = null;
  store.subscribe(() => {
    if (!initialLoadDone) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveItems(store.getAll()).catch((err) => {
        console.warn("Could not save items.json (is dev_server.py running?)", err);
      });
    }, 250);
  });
}
