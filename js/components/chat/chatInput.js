// Composer: textarea + send button. Enter sends, Shift+Enter inserts newline.

import { el } from "../../helpers/dom.js?v=1";
import { createButton } from "../interactives/button.js?v=1";

const SEND_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><path fill="currentColor" d="M2.5 21 22 12 2.5 3v7l13 2-13 2z"/></svg>`;

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
  }, [textarea, sendBtn.root]);

  function autosize() {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
  }

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
