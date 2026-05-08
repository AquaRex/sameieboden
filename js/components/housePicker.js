// Modal asking "which house are you?". Used on first load and when the
// user clicks the badge to switch.

import { el, clear } from "../dom.js?v=3";
import { HOUSES } from "../supabaseConfig.js?v=5";
import { getCurrentHouse, setCurrentHouse } from "../currentHouse.js?v=1";

export function createHousePicker() {
  const grid = el("div", { class: "id-house-grid hp-grid" });
  const title = el("h2", { class: "id-title hp-title", textContent: "Hvilket hus er du?" });
  const subtitle = el("p", { class: "hp-sub", textContent: "Vi husker valget på denne enheten. Du kan endre når som helst." });

  const dialog = el("div", { class: "id-dialog hp-dialog", role: "dialog", "aria-modal": "true" }, [
    title, subtitle, grid,
  ]);
  const backdrop = el("div", { class: "id-backdrop hp-backdrop", hidden: true }, [dialog]);
  document.body.appendChild(backdrop);

  let allowDismiss = false;
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop && allowDismiss) close();
  });
  document.addEventListener("keydown", (e) => {
    if (backdrop.hidden) return;
    if (e.key === "Escape" && allowDismiss) { e.preventDefault(); close(); }
  });

  function render() {
    clear(grid);
    const current = getCurrentHouse();
    for (const h of HOUSES) {
      grid.appendChild(
        el("button", {
          type: "button",
          class: "id-house-btn" + (h === current ? " is-suggested" : ""),
          textContent: h,
          onclick: () => {
            setCurrentHouse(h);
            close();
          },
        })
      );
    }
  }

  function open({ dismissable = true } = {}) {
    allowDismiss = dismissable;
    render();
    backdrop.hidden = false;
    document.body.classList.add("id-open");
  }

  function close() {
    backdrop.hidden = true;
    document.body.classList.remove("id-open");
  }

  return { open, close };
}
