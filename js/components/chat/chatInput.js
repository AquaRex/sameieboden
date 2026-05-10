// Composer: textarea + send button. Enter sends, Shift+Enter inserts newline.

import { el } from "../../helpers/dom.js?v=1778420168";
import { createButton } from "../interactives/button.js?v=1778420168";

const SEND_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><path fill="currentColor" d="M2.5 21 22 12 2.5 3v7l13 2-13 2z"/></svg>`;
const EMOJI_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 10h.01M15.5 10h.01M8.5 14.5c1 1 2.2 1.5 3.5 1.5s2.5-.5 3.5-1.5"/></svg>`;

// Curated palette — common reactions, AC-friendly nature/food, gestures.
const EMOJI_PALETTE = [
  "😀","😂","😍","😊","😉","😎","🤔","😴",
  "👍","👎","👏","🙏","👋","💪","🤝","✌️",
  "❤️","🔥","✨","🎉","💯","⭐","🌸","🌿",
  "🐶","🐱","🐢","🐝","☀️","🌧️","☕","🍕",
];

export function createChatInput({ onSend, placeholder = "Skriv en melding…" } = {}) {
  const textarea = el("textarea", {
    class: "chat-input-field",
    rows: 1,
    placeholder,
    "aria-label": "Skriv melding",
    oninput: autosize,
    onkeydown: (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
  });

  const emojiPanel = el(
    "div",
    { class: "chat-input-emoji-panel", role: "menu", hidden: true },
    EMOJI_PALETTE.map((emoji) =>
      el("button", {
        type: "button",
        class: "chat-input-emoji-item",
        title: emoji,
        "aria-label": `Sett inn ${emoji}`,
        onmousedown: (e) => e.preventDefault(), // keep textarea focus
        onclick: () => { insertAtCursor(emoji); closeEmoji(); },
      }, emoji)
    )
  );

  const emojiBtn = createButton({
    icon: EMOJI_ICON,
    variant: "ghost",
    ariaLabel: "Sett inn emoji",
    title: "Emoji",
    class: "chat-input-emoji",
    onClick: toggleEmoji,
  });

  const emojiWrap = el("div", { class: "chat-input-emoji-wrap" }, [emojiBtn.root, emojiPanel]);

  const sendBtn = createButton({
    icon: SEND_ICON,
    variant: "confirm",
    ariaLabel: "Send melding",
    title: "Send (Enter)",
    class: "chat-input-send",
    onClick: send,
  });

  const root = el("form", {
    class: "chat-input",
    onsubmit: (e) => { e.preventDefault(); send(); },
  }, [textarea, emojiWrap, sendBtn.root]);

  function autosize() {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
  }

  function insertAtCursor(text) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
    const pos = start + text.length;
    textarea.focus();
    textarea.setSelectionRange(pos, pos);
    autosize();
  }

  function openEmoji() {
    emojiPanel.hidden = false;
    emojiBtn.root.classList.add("is-on");
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("keydown", onDocKey, true);
  }
  function closeEmoji() {
    emojiPanel.hidden = true;
    emojiBtn.root.classList.remove("is-on");
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onDocKey, true);
  }
  function toggleEmoji() { emojiPanel.hidden ? openEmoji() : closeEmoji(); }
  function onDocClick(e) { if (!emojiWrap.contains(e.target)) closeEmoji(); }
  function onDocKey(e) { if (e.key === "Escape") closeEmoji(); }

  async function send() {
    const text = textarea.value.trim();
    if (!text || !onSend) return;
    sendBtn.setDisabled(true);
    textarea.disabled = true;
    try {
      await onSend(text);
      textarea.value = "";
      autosize();
    } finally {
      sendBtn.setDisabled(false);
      textarea.disabled = false;
      textarea.focus();
    }
  }

  return {
    root,
    focus() { textarea.focus(); },
    setPlaceholder(p) { textarea.placeholder = p; },
    clear() { textarea.value = ""; autosize(); },
  };
}
