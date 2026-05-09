import { el, clear } from "../../helpers/dom.js?v=1";

export function createTagFilters({ onChange }) {
  const root = el("div", { class: "tag-filters", role: "group", "aria-label": "Filtrer på tag" });
  let activeTag = null;

  function setTags(tags) {
    clear(root);
    root.appendChild(makeChip("Alle", null));
    for (const t of tags) root.appendChild(makeChip(t, t));
    refreshActive();
  }

  function makeChip(label, value) {
    return el("button", {
      type: "button",
      class: "tag-chip",
      textContent: label,
      dataset: { tag: value ?? "" },
      onclick: () => {
        activeTag = value;
        refreshActive();
        onChange(activeTag);
      },
    });
  }

  function refreshActive() {
    for (const chip of root.querySelectorAll(".tag-chip")) {
      const isActive =
        (activeTag === null && chip.dataset.tag === "") || chip.dataset.tag === activeTag;
      chip.classList.toggle("active", isActive);
    }
  }

  return {
    root,
    setTags,
    get active() { return activeTag; },
    reset() {
      activeTag = null;
      refreshActive();
    },
  };
}
