import { isLocal } from "./env.js?v=3";
import { store } from "./store.js?v=3";
import { filterItems } from "./search.js?v=3";
import { createSearchBar } from "./components/searchBar.js?v=3";
import { createTagFilters } from "./components/tagFilters.js?v=3";
import { createGrid } from "./components/grid.js?v=3";
import { createEditor } from "./components/editor.js?v=3";
import { createToolbar } from "./components/toolbar.js?v=3";
import { createViewToggle } from "./components/viewToggle.js?v=3";
import { createLightbox } from "./components/lightbox.js?v=3";
import { loadItems, saveItems, uploadImage, slugify } from "./serverApi.js?v=3";

const editable = isLocal();
let currentQuery = "";
let currentTag = null;

const controls = document.getElementById("controls");
const gridSection = document.getElementById("grid-section");
const toolbarMount = document.getElementById("toolbar-mount");

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
    })
  : null;

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

// In edit mode, persist changes back to disk via the dev server so they
// can be committed to git.
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
