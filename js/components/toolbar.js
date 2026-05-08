// Local-only toolbar: add, reset.

import { el } from "../dom.js?v=3";

export function createToolbar({ onAdd, onReset }) {
  const root = el("div", { class: "toolbar", "aria-label": "Redigeringsverktøy" }, [
    el("button", { type: "button", class: "btn btn-primary", textContent: "+ Legg til utstyr", onclick: onAdd }),
    el("span", { class: "toolbar-spacer" }),
    el("button", { type: "button", class: "btn btn-ghost", textContent: "Tilbakestill", onclick: onReset }),
  ]);

  return { root };
}
