// PWA install button. Shown only when the browser fires `beforeinstallprompt`
// (Android Chrome / desktop Chromium). On iOS Safari we instead show a hint
// pointing users to the Share menu when they're not already running as a
// standalone app. The button is persistent — only `appinstalled` hides it.

import { el } from "../../helpers/dom.js?v=1778408805";

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

export function createInstallButton() {
  if (isStandalone()) return null;

  let deferredPrompt = null;

  const label = el("span", { class: "install-label", textContent: "Installer app" });
  const root = el("button", {
    type: "button",
    class: "install-btn",
    hidden: true,
    onclick: handleClick,
  }, [
    el("span", { class: "install-icon", innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m6 9 6 6 6-6"/><path d="M5 21h14"/></svg>' }),
    label,
  ]);

  function show() { root.hidden = false; }
  function hide() { root.hidden = true; }

  async function handleClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome !== "accepted") deferredPrompt = null;
      return;
    }
    if (isIOS()) {
      alert("Trykk på Del-knappen i Safari og velg «Legg til på Hjem-skjerm».");
    }
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    show();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hide();
  });

  if (isIOS()) {
    label.textContent = "Legg til på Hjem-skjerm";
    show();
  }

  return { root };
}
