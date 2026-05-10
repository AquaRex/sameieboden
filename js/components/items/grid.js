import { el, clear } from "../../helpers/dom.js?v=1778425523";
import { createCard } from "./card.js?v=1778425523";

export function createGrid({ editable, onEdit, onDelete, onOpen, view = "grid" }) {
  const list = el("ul", {
    id: "grid",
    class: `items items--${view}`,
    "aria-label": "Liste over utstyr",
  });
  const empty = el("p", {
    class: "empty",
    textContent: "Ingen utstyr passer søket.",
    hidden: true,
  });
  const count = el("p", { class: "result-count", "aria-live": "polite" });

  function setView(next) {
    list.classList.remove("items--grid", "items--list");
    list.classList.add(`items--${next}`);
  }

  function render(filtered, total) {
    clear(list);
    for (const item of filtered) {
      list.appendChild(createCard(item, { editable, onEdit, onDelete, onOpen }));
    }
    empty.hidden = filtered.length !== 0;
    count.textContent =
      filtered.length === total
        ? `Viser alle ${total} oppføringer`
        : `Viser ${filtered.length} av ${total} oppføringer`;
  }

  return { list, empty, count, render, setView };
}
