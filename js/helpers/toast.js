// Lightweight themed toast notifications.

import { el } from "./dom.js?v=1778517012";

let container = null;

function ensureContainer() {
  if (container) return container;
  container = el("div", { class: "toast-stack", "aria-live": "polite", "aria-atomic": "true" });
  document.body.appendChild(container);
  return container;
}

export function toast(message, { kind = "info", duration = 4500 } = {}) {
  const root = ensureContainer();
  const node = el("div", { class: `toast toast--${kind}`, role: "status" }, [
    el("span", { class: "toast-icon", "aria-hidden": "true", textContent: iconFor(kind) }),
    el("span", { class: "toast-text", textContent: message }),
    el("button", {
      type: "button",
      class: "toast-close",
      "aria-label": "Lukk",
      textContent: "×",
      onclick: () => dismiss(node),
    }),
  ]);
  root.appendChild(node);
  // Animate in on next frame.
  requestAnimationFrame(() => node.classList.add("is-shown"));
  if (duration > 0) setTimeout(() => dismiss(node), duration);
  return node;
}

function dismiss(node) {
  if (!node || !node.isConnected) return;
  node.classList.remove("is-shown");
  node.classList.add("is-hiding");
  setTimeout(() => node.remove(), 220);
}

function iconFor(kind) {
  if (kind === "error") return "!";
  if (kind === "success") return "✓";
  return "i";
}
