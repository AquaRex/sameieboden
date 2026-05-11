import { el } from "../../helpers/dom.js?v=1778489126";

const STORAGE_KEY = "bvs.viewMode.v1";
const VALID = new Set(["grid", "list"]);

function loadInitial() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return VALID.has(saved) ? saved : "grid";
}

export function createViewToggle({ onChange }) {
  let mode = loadInitial();

  const gridIcon = `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg" focusable="false">
    <rect x="0" y="0" width="2" height="2"/>
    <rect x="4" y="0" width="2" height="2"/>
    <rect x="8" y="0" width="2" height="2"/>
    <rect x="0" y="4" width="2" height="2"/>
    <rect x="4" y="4" width="2" height="2"/>
    <rect x="8" y="4" width="2" height="2"/>
    <rect x="0" y="8" width="2" height="2"/>
    <rect x="4" y="8" width="2" height="2"/>
    <rect x="8" y="8" width="2" height="2"/>
  </svg>`;
  const listIcon = `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg" focusable="false">
    <rect x="0" y="0" width="2" height="2"/>
    <rect x="3" y="0.5" width="7" height="1"/>
    <rect x="0" y="4" width="2" height="2"/>
    <rect x="3" y="4.5" width="7" height="1"/>
    <rect x="0" y="8" width="2" height="2"/>
    <rect x="3" y="8.5" width="7" height="1"/>
  </svg>`;
  const gridBtn = makeBtn("grid", "Rutenett", gridIcon);
  const listBtn = makeBtn("list", "Liste", listIcon);

  const root = el(
    "div",
    { class: "view-toggle", role: "group", "aria-label": "Visningsmodus" },
    [gridBtn, listBtn]
  );

  function makeBtn(value, label, icon) {
    return el("button", {
      type: "button",
      class: "view-btn",
      title: label,
      "aria-label": label,
      "aria-pressed": String(value === mode),
      dataset: { mode: value },
      onclick: () => set(value),
    }, [
      el("span", { class: "view-btn-icon", "aria-hidden": "true", innerHTML: icon }),
      el("span", { class: "view-btn-label", textContent: label }),
    ]);
  }

  function set(next) {
    if (!VALID.has(next) || next === mode) return;
    mode = next;
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
    refresh();
    onChange(mode);
  }

  function refresh() {
    for (const b of root.querySelectorAll(".view-btn")) {
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    }
  }

  return { root, get value() { return mode; } };
}
