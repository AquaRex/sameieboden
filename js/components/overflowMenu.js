// Compact overflow menu. Renders a "⋯" trigger plus a popover panel.
// Callers add their own nodes into the panel via `panel`. Used to collapse
// rarely-pressed actions on narrow viewports.

import { el } from "../dom.js?v=3";

const DOTS = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><circle cx="5" cy="12" r="2.2" fill="currentColor"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><circle cx="19" cy="12" r="2.2" fill="currentColor"/></svg>`;

export function createOverflowMenu({ ariaLabel = "Flere valg" } = {}) {
  let open = false;

  const panel = el("div", { class: "overflow-panel", role: "menu", hidden: true });

  const trigger = el("button", {
    type: "button",
    class: "btn overflow-trigger",
    "aria-haspopup": "true",
    "aria-expanded": "false",
    "aria-label": ariaLabel,
    title: ariaLabel,
    innerHTML: DOTS,
    onclick: (e) => {
      e.stopPropagation();
      toggle();
    },
  });

  const root = el("div", { class: "overflow-menu" }, [trigger, panel]);

  function setOpen(next) {
    if (next === open) return;
    open = next;
    panel.hidden = !open;
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    root.classList.toggle("is-open", open);
    if (open) {
      document.addEventListener("click", onDocClick, true);
      document.addEventListener("keydown", onKey, true);
    } else {
      document.removeEventListener("click", onDocClick, true);
      document.removeEventListener("keydown", onKey, true);
    }
  }

  function toggle() { setOpen(!open); }
  function close() { setOpen(false); }

  function onDocClick(e) {
    if (!root.contains(e.target)) close();
  }
  function onKey(e) {
    if (e.key === "Escape") { close(); trigger.focus(); }
  }

  // Close when an action inside the panel is clicked.
  panel.addEventListener("click", (e) => {
    const btn = e.target.closest("button, a, [role='menuitem']");
    if (btn) close();
  });

  return { root, trigger, panel, close, open: () => setOpen(true) };
}
