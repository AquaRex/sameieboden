// Application entry point. Wires together store, components and events.
// Each module knows as little as possible about the others.

import { isLocal } from "./env.js";
import { store } from "./store.js";
import { filterItems } from "./search.js";
import { createSearchBar } from "./components/searchBar.js";
import { createTagFilters } from "./components/tagFilters.js";
import { createGrid } from "./components/grid.js";
import { createEditor } from "./components/editor.js";
import { createToolbar } from "./components/toolbar.js";
import { createViewToggle } from "./components/viewToggle.js";
import { createLightbox } from "./components/lightbox.js";
import { loadItems, saveItems, uploadImage, slugify } from "./serverApi.js";

const editable = isLocal();
let currentQuery = "";
let currentTag = null;

// --- mount points ---
const controls = document.getElementById("controls");
const gridSection = document.getElementById("grid-section");
const toolbarMount = document.getElementById("toolbar-mount");

// --- components ---
const searchBar = createSearchBar({
  onChange: (q) => { currentQuery = q; rerender(); },
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
  onEdit: (item) => editor.open(item),
  onDelete: (item) => {
    if (confirm(`Slette "${item.name}"?`)) store.remove(item.id);
  },
  onOpen: (item) => {
    const list = lastFiltered;
    const idx = list.findIndex((it) => it.id === item.id);
    lightbox.open(list, Math.max(0, idx));
  },
});

const lightbox = createLightbox();
let lastFiltered = [];

const editor = editable
  ? createEditor({
      getKnownTags: () => store.allTags(),
      onSave: async (mode, id, data) => {
        // If a fresh image was dropped (data URL), upload it as a real file
        // first so the public site can serve it from images/.
        if (data.image && data.image.startsWith("data:")) {
          try {
            const path = await uploadImage(slugify(data.name), data.image);
            // Cache-bust so a replaced image at the same path shows up
            // immediately in the browser (the file on disk is overwritten,
            // but its URL is otherwise identical).
            data.image = `${path}?v=${Date.now()}`;
          } catch (err) {
            console.warn("Image upload failed, keeping inline data URL:", err);
          }
        }
        if (mode === "edit" && id) store.update(id, data);
        else store.add(data);
      },
    })
  : null;

// --- mount DOM ---
const countRow = document.createElement("div");
countRow.className = "count-row";
countRow.append(grid.count, viewToggle.root);
controls.append(searchBar.root, tagFilters.root, countRow);
gridSection.append(grid.list, grid.empty);

if (editable) {
  document.body.classList.add("is-editable");
  const toolbar = createToolbar({
    onAdd: () => editor.open(null),
    onExport: exportJson,
    onImport: importJson,
    onReset: () => {
      if (confirm("Tilbakestill listen til standardverdier? Dette sletter dine endringer.")) {
        store.resetToDefaults();
      }
    },
  });
  toolbarMount.appendChild(toolbar.root);
}

// --- reactive rendering ---
store.subscribe((items) => {
  tagFilters.setTags(store.allTags());
  rerender(items);
});

// --- bootstrap from data/items.json (source of truth for the public site) ---
let initialLoadDone = false;
loadItems().then((items) => {
  if (items) store.replaceAll(items);
  initialLoadDone = true;
});

// --- push edits back to the dev server so they end up in git ---
if (editable) {
  let saveTimer = null;
  store.subscribe(() => {
    if (!initialLoadDone) return; // don't echo the initial load back
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveItems(store.getAll()).catch((err) => {
        console.warn("Could not save items.json (is dev_server.py running?)", err);
      });
    }, 250);
  });
}

function rerender(items = store.getAll()) {
  const filtered = filterItems(items, { query: currentQuery, tag: currentTag });
  lastFiltered = filtered;
  grid.render(filtered, items.length);
}

// --- import/export ---
function exportJson() {
  const data = JSON.stringify(store.getAll(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "utstyr.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importJson(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("Forventet en liste i JSON-filen.");
    store.replaceAll(parsed);
  } catch (err) {
    alert("Kunne ikke importere: " + err.message);
  }
}
