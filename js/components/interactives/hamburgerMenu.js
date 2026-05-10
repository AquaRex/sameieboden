// Hamburger menu anchored in the hero corner. Opens a panel containing
// rarely-used global actions (calendar, house badge, etc.). Caller mounts
// arbitrary nodes into `panel`.

import { el } from "../../helpers/dom.js?v=1778425523";

const ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><rect x="3" y="5" width="18" height="2.4" rx="1.2" fill="currentColor"/><rect x="3" y="10.8" width="18" height="2.4" rx="1.2" fill="currentColor"/><rect x="3" y="16.6" width="18" height="2.4" rx="1.2" fill="currentColor"/></svg>`;

export function createHamburgerMenu({ ariaLabel = "Meny" } = {}) {
  let open = false;

  const panel = el("div", { class: "ham-panel", role: "menu", hidden: true });

  const trigger = el("button", {
    type: "button",
    class: "ham-trigger",
    "aria-haspopup": "true",
    "aria-expanded": "false",
    "aria-label": ariaLabel,
    title: ariaLabel,
    innerHTML: ICON,
    onclick: (e) => { e.stopPropagation(); toggle(); },
  });

  const root = el("div", { class: "ham-menu" }, [trigger, panel]);

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

  function onDocClick(e) { if (!root.contains(e.target)) close(); }
  function onKey(e) { if (e.key === "Escape") { close(); trigger.focus(); } }

  panel.addEventListener("click", (e) => {
    const item = e.target.closest("button, a, [role='menuitem']");
    if (item) close();
  });

  return { root, trigger, panel, close, open: () => setOpen(true) };
}
