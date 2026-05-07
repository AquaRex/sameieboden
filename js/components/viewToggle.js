import { el } from "../dom.js";

const STORAGE_KEY = "bvs.viewMode.v1";
const VALID = new Set(["grid", "list"]);

function loadInitial() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return VALID.has(saved) ? saved : "grid";
}

export function createViewToggle({ onChange }) {
  let mode = loadInitial();

  const gridBtn = makeBtn("grid", "Rutenett", "▦");
  const listBtn = makeBtn("list", "Liste", "☰");

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
      el("span", { class: "view-btn-icon", "aria-hidden": "true", textContent: icon }),
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
