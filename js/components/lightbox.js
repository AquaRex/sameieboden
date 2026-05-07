// Full-image lightbox. Opens a modal showing item.image at full size,
// with prev/next navigation via on-screen buttons or arrow keys.

import { el, clear } from "../dom.js";

export function createLightbox() {
  let items = [];
  let index = 0;

  const imgEl = el("img", { class: "lb-image", alt: "" });
  const captionEl = el("div", { class: "lb-caption" });
  const counterEl = el("div", { class: "lb-counter" });

  const prevBtn = el("button", {
    type: "button",
    class: "lb-nav lb-nav--prev",
    "aria-label": "Forrige",
    innerHTML: "&lsaquo;",
    onclick: (e) => { e.stopPropagation(); show(index - 1); },
  });
  const nextBtn = el("button", {
    type: "button",
    class: "lb-nav lb-nav--next",
    "aria-label": "Neste",
    innerHTML: "&rsaquo;",
    onclick: (e) => { e.stopPropagation(); show(index + 1); },
  });
  const closeBtn = el("button", {
    type: "button",
    class: "lb-close",
    "aria-label": "Lukk",
    textContent: "×",
    onclick: (e) => { e.stopPropagation(); close(); },
  });

  const stage = el("div", { class: "lb-stage" }, [imgEl]);

  const backdrop = el(
    "div",
    {
      class: "lb-backdrop",
      hidden: true,
      role: "dialog",
      "aria-modal": "true",
      onclick: (e) => { if (e.target === backdrop) close(); },
    },
    [closeBtn, prevBtn, stage, nextBtn, captionEl, counterEl]
  );
  document.body.appendChild(backdrop);

  document.addEventListener("keydown", (e) => {
    if (backdrop.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); show(index + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); show(index - 1); }
  });

  function open(list, startIndex) {
    items = list.filter((it) => !!it.image);
    if (items.length === 0) return;
    const startId = list[startIndex]?.id;
    const found = items.findIndex((it) => it.id === startId);
    index = found >= 0 ? found : 0;
    backdrop.hidden = false;
    document.body.classList.add("lb-open");
    show(index);
  }

  function close() {
    backdrop.hidden = true;
    document.body.classList.remove("lb-open");
    imgEl.removeAttribute("src");
  }

  function show(next) {
    if (items.length === 0) return;
    index = ((next % items.length) + items.length) % items.length;
    const item = items[index];
    imgEl.src = item.image;
    imgEl.alt = item.name || "";
    clear(captionEl);
    captionEl.appendChild(el("strong", { textContent: item.name || "" }));
    if (item.description) {
      captionEl.appendChild(el("p", { textContent: item.description }));
    }
    counterEl.textContent = `${index + 1} / ${items.length}`;
    const multi = items.length > 1;
    prevBtn.hidden = !multi;
    nextBtn.hidden = !multi;
    counterEl.hidden = !multi;
  }

  return { open, close };
}
