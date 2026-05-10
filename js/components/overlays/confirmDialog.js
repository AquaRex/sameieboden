// Themed confirm dialog. Replaces native window.confirm with an in-app modal
// matching the AC theme. Single shared instance; returns a Promise<boolean>.

import { el } from "../../helpers/dom.js?v=1778420168";
import { createButton } from "../interactives/button.js?v=1778420168";

let instance = null;

function ensureInstance() {
  if (instance) return instance;

  const titleEl = el("h2", { class: "id-title cf-title" });
  const messageEl = el("p", { class: "cf-message" });
  const cancel = createButton({ label: "Avbryt", variant: "cancel" });
  const confirm = createButton({ label: "OK", variant: "confirm" });
  const cancelBtn = cancel.root;
  const confirmBtn = confirm.root;
  const actions = el("div", { class: "id-picker-actions cf-actions" }, [cancelBtn, confirmBtn]);

  const dialog = el("div", { class: "id-dialog cf-dialog", role: "alertdialog", "aria-modal": "true" }, [
    titleEl, messageEl, actions,
  ]);
  const backdrop = el("div", { class: "id-backdrop cf-backdrop", hidden: true }, [dialog]);
  document.body.appendChild(backdrop);

  let resolver = null;
  function settle(value) {
    backdrop.hidden = true;
    document.body.classList.remove("id-open");
    const r = resolver; resolver = null;
    if (r) r(value);
  }

  cancelBtn.addEventListener("click", () => settle(false));
  confirmBtn.addEventListener("click", () => settle(true));
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) settle(false); });
  document.addEventListener("keydown", (e) => {
    if (backdrop.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); settle(false); }
    else if (e.key === "Enter") { e.preventDefault(); settle(true); }
  });

  instance = {
    open({ title, message, confirmLabel = "OK", cancelLabel = "Avbryt", danger = false }) {
      titleEl.textContent = title || "Er du sikker?";
      messageEl.textContent = message || "";
      messageEl.hidden = !message;
      cancel.setLabel(cancelLabel);
      confirm.setLabel(confirmLabel);
      confirmBtn.classList.toggle("btn-danger", !!danger);
      confirmBtn.classList.toggle("btn-primary", !danger);
      return new Promise((resolve) => {
        if (resolver) resolver(false);
        resolver = resolve;
        backdrop.hidden = false;
        document.body.classList.add("id-open");
        setTimeout(() => confirmBtn.focus(), 0);
      });
    },
  };
  return instance;
}

export function confirmDialog(opts = {}) {
  return ensureInstance().open(opts);
}
