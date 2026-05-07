// Local-only toolbar: add new entry, import/export JSON, reset.

import { el } from "../dom.js?v=3";

export function createToolbar({ onAdd, onImport, onExport, onReset }) {
  const fileInput = el("input", {
    type: "file",
    accept: "application/json",
    class: "visually-hidden",
    onchange: (e) => {
      const f = e.target.files[0];
      if (f) onImport(f);
      e.target.value = "";
    },
  });

  const root = el("div", { class: "toolbar", "aria-label": "Redigeringsverktøy" }, [
    el("button", { type: "button", class: "btn btn-primary", textContent: "+ Legg til utstyr", onclick: onAdd }),
    el("span", { class: "toolbar-spacer" }),
    el("button", { type: "button", class: "btn btn-ghost", textContent: "Eksporter JSON", onclick: onExport }),
    el("button", { type: "button", class: "btn btn-ghost", textContent: "Importer JSON", onclick: () => fileInput.click() }),
    el("button", { type: "button", class: "btn btn-ghost", textContent: "Tilbakestill", onclick: onReset }),
    fileInput,
  ]);

  return { root };
}
