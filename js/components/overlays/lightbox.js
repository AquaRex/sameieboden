// Full-image lightbox with prev/next navigation.

import { el, clear } from "../../helpers/dom.js?v=1778408805";

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

  // Only desktop mouse users (Windows/Linux/Chrome OS) get our custom
  // wheel-zoom + drag-to-pan. macOS has good native trackpad pinch-zoom,
  // and phones/tablets have native page pinch-zoom — in both cases we
  // stay out of the way so the OS gestures work as expected.
  const platform = navigator.platform || "";
  const hasTouch = (navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
  const isMacDesktop = /Mac/.test(platform) && !hasTouch;
  const useCustomZoom = !isMacDesktop && !hasTouch;

  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;

  function applyTransform() {
    if (!useCustomZoom) return;
    imgEl.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    imgEl.style.cursor = zoom > 1 ? (dragging ? "grabbing" : "grab") : "";
  }

  function resetZoom() {
    zoom = 1; panX = 0; panY = 0;
    applyTransform();
  }

  function setZoom(next, anchor) {
    const z = Math.max(1, Math.min(6, next));
    if (anchor && z !== zoom) {
      const rect = imgEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const ax = anchor.x - cx;
      const ay = anchor.y - cy;
      const ratio = z / zoom;
      panX = ax - (ax - panX) * ratio;
      panY = ay - (ay - panY) * ratio;
    }
    zoom = z;
    if (zoom === 1) { panX = 0; panY = 0; }
    applyTransform();
  }

  if (useCustomZoom) {
    stage.addEventListener("wheel", (e) => {
      if (backdrop.hidden) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      const rect = imgEl.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top  && e.clientY <= rect.bottom;
      const anchor = inside
        ? { x: e.clientX, y: e.clientY }
        : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      setZoom(zoom * factor, anchor);
    }, { passive: false });

    let startX = 0, startY = 0, startPanX = 0, startPanY = 0;
    imgEl.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || zoom <= 1) return;
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startPanX = panX; startPanY = panY;
      try { imgEl.setPointerCapture(e.pointerId); } catch {}
      applyTransform();
    });
    imgEl.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      panX = startPanX + (e.clientX - startX);
      panY = startPanY + (e.clientY - startY);
      applyTransform();
    });
    const stopDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      try { imgEl.releasePointerCapture(e.pointerId); } catch {}
      applyTransform();
    };
    imgEl.addEventListener("pointerup", stopDrag);
    imgEl.addEventListener("pointercancel", stopDrag);

    imgEl.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (zoom > 1) resetZoom();
      else setZoom(2, { x: e.clientX, y: e.clientY });
    });
  }

  imgEl.addEventListener("click", (e) => e.stopPropagation());

  const backdrop = el(
    "div",
    {
      class: "lb-backdrop",
      hidden: true,
      role: "dialog",
      "aria-modal": "true",
      onclick: () => close(),
    },
    [closeBtn, prevBtn, stage, nextBtn, el("div", { class: "lb-info" }, [captionEl, counterEl])]
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
    resetZoom();
  }

  function show(next) {
    if (items.length === 0) return;
    resetZoom();
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
