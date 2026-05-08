// Admin page entry. Localhost-only: redirects elsewhere if not local.

import { isLocal } from "./env.js?v=3";
import { el, clear } from "./dom.js?v=3";
import { HOUSES } from "./supabaseConfig.js?v=4";
import { loadItems } from "./serverApi.js?v=3";
import { getAllHistory, cancelReservation } from "./state.js?v=8";
import { confirmDialog } from "./components/confirmDialog.js?v=1";
import { createDropdown } from "./components/dropdown.js?v=1";
import { toast } from "./toast.js?v=1";
import { formatBlock, formatWhen } from "./util/dates.js?v=1";
import { friendlyError } from "./util/errors.js?v=1";

const root = document.getElementById("admin-root");

if (!isLocal()) {
  root.appendChild(el("p", { class: "admin-empty", textContent: "Admin er kun tilgjengelig på localhost." }));
  throw new Error("admin: not local");
}

// ----- Filters state -------------------------------------------------------
const filters = { house: "", slug: "", limit: 500 };
let allRows = [];
let items = [];
const itemBySlug = new Map();

// ----- Dropdowns ----------------------------------------------------------
const houseDropdown = createDropdown({
  options: [{ value: "", label: "Alle hus" }, ...HOUSES.map((h) => ({ value: h, label: h }))],
  value: "",
  onChange: (v) => { filters.house = v; refresh(); },
});

const itemDropdown = createDropdown({
  options: [{ value: "", label: "Alle gjenstander" }],
  value: "",
  onChange: (v) => { filters.slug = v; refresh(); },
});

const limitDropdown = createDropdown({
  options: [100, 250, 500, 1000, 2500].map((n) => ({ value: String(n), label: `${n} rader` })),
  value: "500",
  onChange: (v) => { filters.limit = parseInt(v, 10) || 500; refresh(); },
});

const reloadBtn = el("button", { type: "button", class: "btn btn-small", textContent: "Oppdater", onclick: refresh });

const filterBar = el("div", { class: "admin-filters" }, [
  field("Hus", houseDropdown.root),
  field("Gjenstand", itemDropdown.root),
  field("Antall", limitDropdown.root),
  reloadBtn,
]);

const summaryEl = el("p", { class: "admin-summary" });
const tableWrap = el("div", { class: "admin-table-wrap" });

root.append(filterBar, summaryEl, tableWrap);

function field(label, control) {
  return el("label", { class: "admin-field" }, [
    el("span", { class: "admin-field-label", textContent: label }),
    control,
  ]);
}

// ----- Init ---------------------------------------------------------------
init();

async function init() {
  items = (await loadItems()) || [];
  items.sort((a, b) => (a.name || "").localeCompare(b.name || "", "no"));
  itemBySlug.clear();
  for (const it of items) itemBySlug.set(it.slug || slugify(it.name), it);
  itemDropdown.setOptions([
    { value: "", label: "Alle gjenstander" },
    ...items.map((it) => ({ value: it.slug || slugify(it.name), label: it.name })),
  ]);
  await refresh();
}

async function refresh() {
  summaryEl.textContent = "Laster…";
  try {
    allRows = await getAllHistory({
      house: filters.house || null,
      slug: filters.slug || null,
      limit: filters.limit,
    });
    render();
  } catch (err) {
    summaryEl.textContent = friendlyError(err);
  }
}

function render() {
  clear(tableWrap);
  if (allRows.length === 0) {
    summaryEl.textContent = "Ingen historikk for valgt filter.";
    return;
  }
  summaryEl.textContent = `${allRows.length} oppføring${allRows.length === 1 ? "" : "er"}.`;

  const headRow = el("tr", {}, [
    el("th", { textContent: "Hus" }),
    el("th", { textContent: "Gjenstand" }),
    el("th", { textContent: "Periode" }),
    el("th", { textContent: "Avsluttet" }),
    el("th", { class: "admin-th-actions", textContent: "" }),
  ]);
  const tbody = el("tbody");
  for (const row of allRows) {
    const item = itemBySlug.get(row.slug);
    tbody.appendChild(
      el("tr", {}, [
        el("td", { textContent: row.house || "?" }),
        el("td", { textContent: item ? item.name : row.slug }),
        el("td", { textContent: formatBlock(row.period_from, row.period_to) }),
        el("td", { textContent: formatWhen(row.period_to) }),
        el("td", { class: "admin-td-actions" }, [
          el("button", {
            type: "button",
            class: "id-history-delete",
            title: "Slett oppføring",
            "aria-label": "Slett oppføring",
            textContent: "×",
            onclick: () => onDelete(row),
          }),
        ]),
      ])
    );
  }
  const table = el("table", { class: "admin-table" }, [
    el("thead", {}, [headRow]),
    tbody,
  ]);
  tableWrap.appendChild(table);
}

async function onDelete(row) {
  const item = itemBySlug.get(row.slug);
  const itemName = item ? item.name : row.slug;
  const ok = await confirmDialog({
    title: "Slett historikkoppføring?",
    message: `${row.house || "?"} — ${itemName} (${formatBlock(row.period_from, row.period_to)}). Dette kan ikke angres.`,
    confirmLabel: "Slett",
    cancelLabel: "Avbryt",
    danger: true,
  });
  if (!ok) return;
  try {
    await cancelReservation(row.id);
    toast("Oppføringen er slettet.", { kind: "success" });
    await refresh();
  } catch (err) {
    toast(friendlyError(err), { kind: "error", duration: 8000 });
  }
}

function slugify(name) {
  return (name || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
