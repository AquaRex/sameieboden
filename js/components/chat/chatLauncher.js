// Floating round chat bubble anchored to the bottom-right of the viewport.
// Click toggles the chat window. Shows an unread badge that updates live
// from the chat cache.

import { el } from "../../helpers/dom.js?v=1778488612";
import {
  loadChat,
  startChatRealtime,
  subscribeChat,
  getTotalUnread,
} from "../../core/chat.js?v=1778488612";

const ICON = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><path fill="currentColor" d="M6 5h20a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H13.4l-5.2 4.4A1 1 0 0 1 6.6 28V8a3 3 0 0 1 3-3z"/></svg>`;

export function createChatLauncher({ onToggle } = {}) {
  let isActive = false;

  const badge = el("span", {
    class: "chat-launcher-badge",
    "aria-hidden": "true",
    hidden: true,
  });
  const iconEl = el("span", { class: "chat-launcher-icon", "aria-hidden": "true" });
  iconEl.innerHTML = ICON;

  const root = el("button", {
    type: "button",
    class: "chat-launcher",
    "aria-label": "Åpne meldinger",
    "aria-haspopup": "dialog",
    "aria-expanded": "false",
    title: "Meldinger",
    onclick: () => onToggle?.(),
  }, [iconEl, badge]);

  function refresh() {
    const n = getTotalUnread();
    if (n > 0) {
      badge.hidden = false;
      badge.textContent = n > 99 ? "99+" : String(n);
      root.setAttribute("aria-label", `Åpne meldinger (${n} uleste)`);
    } else {
      badge.hidden = true;
      badge.textContent = "";
      root.setAttribute("aria-label", isActive ? "Lukk meldinger" : "Åpne meldinger");
    }
  }

  function setActive(active) {
    isActive = !!active;
    root.classList.toggle("is-active", isActive);
    root.setAttribute("aria-expanded", isActive ? "true" : "false");
    root.title = isActive ? "Lukk meldinger" : "Meldinger";
    refresh();
  }

  // Boot chat in the background so unread counts populate before first open.
  loadChat().then(() => {
    startChatRealtime();
    refresh();
  });
  subscribeChat(refresh);

  return { root, setActive, refresh };
}
