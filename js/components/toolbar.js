// Local-only toolbar: add, reset, admin link.

import { el } from "../dom.js?v=3";
import { createButton } from "./button.js?v=1";

export function createToolbar({ onAdd, onReset }) {
  const root = el("div", { class: "toolbar", "aria-label": "Redigeringsverktøy" }, [
    createButton({ label: "+ Legg til utstyr", variant: "confirm", onClick: onAdd }).root,
    createButton({ label: "Admin", variant: "default", href: "admin.html" }).root,
    el("span", { class: "toolbar-spacer" }),
    createButton({ label: "Tilbakestill", variant: "cancel", onClick: onReset }).root,
  ]);

  return { root };
}
