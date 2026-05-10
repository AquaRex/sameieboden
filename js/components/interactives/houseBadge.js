// Pill next to the search bar showing the current house. Click to change.

import { el } from "../../helpers/dom.js?v=1778420168";
import { getCurrentHouse, subscribeCurrentHouse } from "../../core/currentHouse.js?v=1778420168";

const HOUSE_SVG = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><path d="M4 14 L16 4 L28 14 V27 a1 1 0 0 1 -1 1 H5 a1 1 0 0 1 -1 -1 Z" fill="currentColor"/></svg>`;

export function createHouseBadge({ onClick }) {
  const label = el("span", { class: "house-badge-label" });
  const icon = el("span", { class: "house-badge-icon", "aria-hidden": "true" });
  icon.innerHTML = HOUSE_SVG;
  const root = el("button", {
    type: "button",
    class: "house-badge",
    title: "Bytt husnummer",
    "aria-label": "Bytt husnummer",
    onclick: onClick,
  }, [icon, label]);

  function render() {
    const h = getCurrentHouse();
    label.textContent = h || "Velg hus";
    root.classList.toggle("is-empty", !h);
  }
  render();
  subscribeCurrentHouse(render);

  return { root };
}
