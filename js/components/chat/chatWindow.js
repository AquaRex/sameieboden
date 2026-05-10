// Messenger-style chat window: floats above the launcher in the bottom-right
// corner. Header has the recipient dropdown ("Til: Alle hus / 18A / …"),
// scrollable bubble list in the middle, composer at the bottom.
//
// Singleton: only one window exists at a time.

import { el, clear } from "../../helpers/dom.js?v=1778425356";
import { HOUSES } from "../../core/supabaseConfig.js?v=1778425356";
import {
  getCurrentHouse,
  subscribeCurrentHouse,
} from "../../core/currentHouse.js?v=1778425356";
import {
  loadChat,
  startChatRealtime,
  subscribeChat,
  sendMessage,
  markSeen,
  getConversation,
  getConversationSummaries,
} from "../../core/chat.js?v=1778425356";
import { friendlyError } from "../../helpers/errors.js?v=1778425356";
import { toast } from "../../helpers/toast.js?v=1778425356";
import { createDropdown } from "../forms/dropdown.js?v=1778425356";
import { createMessageBubble } from "./messageBubble.js?v=1778425356";
import { createChatInput } from "./chatInput.js?v=1778425356";
import {
  isPushSupported,
  isSubscribed,
  subscribePush,
  unsubscribePush,
} from "../../core/push.js?v=1778425356";

const CLOSE_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><path fill="currentColor" d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z"/></svg>`;
const BELL_ON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><path fill="currentColor" d="M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22zm6-6V11a6 6 0 0 0-5-5.92V4a1 1 0 1 0-2 0v1.08A6 6 0 0 0 6 11v5l-2 2v1h16v-1z"/></svg>`;
const BELL_OFF = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><path fill="currentColor" d="m3.7 2.3 18 18-1.4 1.4-3.5-3.5H4v-1l2-2v-5c0-.7.1-1.3.3-2L2.3 3.7zM18 16v-5a6 6 0 0 0-5-5.92V4a1 1 0 1 0-2 0v1.08c-.62.1-1.2.28-1.74.54l8.97 8.97zM12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22z"/></svg>`;

const ALL_VALUE = "__all__"; // dropdown encoding for the broadcast channel

let instance = null;

export function createChatWindow({ onClose } = {}) {
  if (instance) return instance;

  // null = "Alle hus", otherwise other house id.
  let target = null;
  let isOpen = false;
  let unsubChat = null;

  // ---- Header --------------------------------------------------------------
  const recipientLabel = el("span", { class: "chat-win-to-label", textContent: "Til" });

  const recipientDD = createDropdown({
    options: buildRecipientOptions(),
    value: ALL_VALUE,
    onChange: (val) => {
      target = val === ALL_VALUE ? null : val;
      renderConversation();
    },
  });
  recipientDD.root.classList.add("chat-win-recipient");

  const pushBtn = el("button", {
    type: "button",
    class: "chat-win-push",
    hidden: true,
    onclick: togglePush,
  });

  const closeBtn = el("button", {
    type: "button",
    class: "chat-win-close",
    "aria-label": "Lukk meldinger",
    title: "Lukk",
    innerHTML: CLOSE_ICON,
    onclick: () => close(),
  });

  const header = el("header", { class: "chat-win-header" }, [
    el("div", { class: "chat-win-recipient-row" }, [recipientLabel, recipientDD.root]),
    el("div", { class: "chat-win-actions" }, [pushBtn, closeBtn]),
  ]);

  // ---- Body ----------------------------------------------------------------
  const list = el("div", {
    class: "chat-win-list",
    role: "log",
    "aria-live": "polite",
  });

  const empty = el("div", { class: "chat-win-empty", hidden: true }, [
    el("p", { textContent: "Ingen meldinger ennå." }),
    el("p", { class: "chat-win-empty-hint", textContent: "Skriv den første!" }),
  ]);

  const body = el("div", { class: "chat-win-body" }, [list, empty]);

  // ---- Composer ------------------------------------------------------------
  const input = createChatInput({
    onSend: async (text) => {
      try {
        await sendMessage({ toHouse: target, body: text });
      } catch (err) {
        toast(friendlyError(err) || "Kunne ikke sende", { kind: "error" });
        throw err;
      }
    },
  });
  input.root.classList.add("chat-win-input");

  // ---- Root ----------------------------------------------------------------
  const root = el("section", {
    class: "chat-win",
    role: "dialog",
    "aria-modal": "false",
    "aria-label": "Meldinger",
    hidden: true,
  }, [header, body, input.root]);

  document.body.appendChild(root);

  // Close on outside click + Escape (only when window is open).
  // Use mousedown (not click) so we read the target BEFORE the dropdown
  // re-renders its list and detaches the clicked <li> from the DOM.
  document.addEventListener("mousedown", (e) => {
    if (!isOpen) return;
    if (root.contains(e.target)) return;
    // Don't close when clicking the launcher (it owns toggle).
    if (e.target.closest?.(".chat-launcher")) return;
    close();
  });
  document.addEventListener("keydown", (e) => {
    if (!isOpen) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
  });

  subscribeCurrentHouse(() => {
    recipientDD.setOptions(buildRecipientOptions());
    target = null;
    recipientDD.setValue(ALL_VALUE);
    if (isOpen) renderConversation();
  });

  function buildRecipientOptions() {
    const me = getCurrentHouse();
    const houses = HOUSES.filter((h) => h !== me).map((h) => ({ value: h, label: h }));
    return [{ value: ALL_VALUE, label: "Sameiet (Alle)" }, ...houses];
  }

  function renderConversation() {
    const me = getCurrentHouse();
    const isAll = target === null;

    input.setPlaceholder(isAll ? "Skriv til sameiet…" : `Skriv til ${target}…`);

    const messages = getConversation(target);
    clear(list);

    if (!messages.length) {
      list.hidden = true;
      empty.hidden = false;
    } else {
      list.hidden = false;
      empty.hidden = true;
      for (const m of messages) {
        const kind = m.from_house === me
          ? "own"
          : isAll ? "broadcast" : "incoming";
        list.appendChild(createMessageBubble(m, { kind, showHouse: isAll }));
      }
    }

    markSeen(target);
    requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  }

  // Re-decorate the dropdown labels with unread counts so the user can see
  // who has new messages without changing recipient.
  function refreshRecipientUnread() {
    const summaries = getConversationSummaries();
    const me = getCurrentHouse();
    const opts = [
      decorate(ALL_VALUE, "Sameiet (Alle)", summaries.get(null)),
      ...HOUSES.filter((h) => h !== me).map((h) => decorate(h, h, summaries.get(h))),
    ];
    recipientDD.setOptions(opts);
    recipientDD.setValue(target === null ? ALL_VALUE : target);
  }

  function decorate(value, label, info) {
    const unread = info?.unread || 0;
    return { value, label: unread > 0 ? `● ${label} (${unread})` : label };
  }

  function onCacheChange() {
    refreshRecipientUnread();
    if (isOpen) renderConversation();
  }

  // ---- Push toggle ---------------------------------------------------------
  async function refreshPushButton() {
    if (!isPushSupported()) { pushBtn.hidden = true; return; }
    pushBtn.hidden = false;
    setPushButtonState(await isSubscribed());
  }

  async function togglePush() {
    const wasSubscribed = await isSubscribed();
    // Optimistic flip so the button feels instant.
    setPushButtonState(!wasSubscribed);
    pushBtn.disabled = true;
    try {
      if (wasSubscribed) {
        await unsubscribePush();
        toast("Varsler slått av", { kind: "info" });
      } else {
        await subscribePush();
        toast("Varsler slått på", { kind: "success" });
      }
      await refreshPushButton();
    } catch (err) {
      // Revert on failure.
      setPushButtonState(wasSubscribed);
      toast(friendlyError(err) || err.message || "Kunne ikke endre varsler", { kind: "error" });
    } finally {
      pushBtn.disabled = false;
    }
  }

  function setPushButtonState(subscribed) {
    pushBtn.classList.toggle("is-on", subscribed);
    pushBtn.innerHTML = subscribed ? BELL_ON : BELL_OFF;
    pushBtn.title = subscribed ? "Slå av varsler" : "Slå på varsler";
    pushBtn.setAttribute("aria-label", pushBtn.title);
  }

  // ---- Open / close --------------------------------------------------------
  async function open({ initialTarget } = {}) {
    if (!getCurrentHouse()) {
      toast("Velg hus først", { kind: "info" });
      return;
    }

    // Make sure we have current data before deciding what to show.
    await loadChat();
    startChatRealtime();
    if (!unsubChat) unsubChat = subscribeChat(onCacheChange);

    // 1) Caller-supplied target wins (e.g. notification click → that house).
    // 2) Otherwise, jump to the conversation with the most recent unread
    //    message so the user lands directly on whoever just messaged them.
    // 3) Fallback: keep the previously-selected target (or "Alle hus").
    if (initialTarget !== undefined) {
      target = initialTarget;
    } else {
      const unreadTarget = pickMostRecentUnread();
      if (unreadTarget !== undefined) target = unreadTarget;
    }
    recipientDD.setValue(target === null ? ALL_VALUE : target);

    isOpen = true;
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add("is-shown"));
    startViewportTracking();

    refreshPushButton();
    refreshRecipientUnread();
    renderConversation();
    setTimeout(() => input.focus(), 80);
  }

  // Returns the conversation key (null for "Alle hus" or a house id) of the
  // most-recently-arrived unread message, or undefined if everything's read.
  function pickMostRecentUnread() {
    const summaries = getConversationSummaries();
    let bestKey;
    let bestTime = 0;
    for (const [key, info] of summaries) {
      if (!info.unread || !info.last) continue;
      const t = Date.parse(info.last.created_at);
      if (t > bestTime) { bestTime = t; bestKey = key; }
    }
    return bestKey;
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    root.classList.remove("is-shown");
    // Match the CSS transition before hiding completely.
    setTimeout(() => { if (!isOpen) root.hidden = true; }, 180);
    stopViewportTracking();
    if (unsubChat) { unsubChat(); unsubChat = null; }
    onClose?.();
  }

  // Track the visualViewport so the window can lift above an open mobile
  // keyboard. Sets --chat-kb (px) on the root which CSS uses as bottom offset.
  function updateViewport() {
    const vv = window.visualViewport;
    if (!vv) return;
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    root.style.setProperty("--chat-kb", kb + "px");
  }
  function startViewportTracking() {
    const vv = window.visualViewport;
    if (!vv) return;
    vv.addEventListener("resize", updateViewport);
    vv.addEventListener("scroll", updateViewport);
    updateViewport();
  }
  function stopViewportTracking() {
    const vv = window.visualViewport;
    if (!vv) return;
    vv.removeEventListener("resize", updateViewport);
    vv.removeEventListener("scroll", updateViewport);
    root.style.removeProperty("--chat-kb");
  }

  function toggle() { isOpen ? close() : open(); }

  instance = { root, open, close, toggle, get isOpen() { return isOpen; } };

  // Open the window from a notification click (forwarded by the SW).
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.type !== "open-chat") return;
      const fromHouse = e.data.from || null;
      // If the notification was for a broadcast (no `from` info), default to All.
      open({ initialTarget: fromHouse });
    });
  }

  return instance;
}
