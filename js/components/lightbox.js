// Full-image lightbox with prev/next navigation.

import { el, clear } from "../dom.js?v=3";

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

  // macOS desktop handles trackpad pinch-zoom on images natively, better
  // than we can emulate. Detect it as "Mac userAgent + no touch input".
  // Everywhere else (Windows/Linux mouse, iOS, Android, iPad) we manage
  // zoom ourselves so users can pinch / wheel into the image even though
  // the lightbox is a fixed overlay.
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const hasTouch = (navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
  const isMacDesktop = /Mac/.test(platform) && !hasTouch;
  const useCustomZoom = !isMacDesktop;

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
    // Wheel / trackpad scroll → zoom (Windows/Linux mice).
    stage.addEventListener("wheel", (e) => {
      if (backdrop.hidden) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      setZoom(zoom * factor, { x: e.clientX, y: e.clientY });
    }, { passive: false });

    // Multi-pointer state for touch pinch-zoom.
    const pointers = new Map();
    let pinchStartDist = 0;
    let pinchStartZoom = 1;
    let pinchAnchor = { x: 0, y: 0 };
    let panStart = null; // { x, y, panX, panY }

    function pointerDistance() {
      const [a, b] = [...pointers.values()];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.hypot(dx, dy);
    }
    function pointerMid() {
      const [a, b] = [...pointers.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    imgEl.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { imgEl.setPointerCapture(e.pointerId); } catch {}
      if (pointers.size === 2) {
        // Start pinch.
        dragging = false;
        panStart = null;
        pinchStartDist = pointerDistance();
        pinchStartZoom = zoom;
        pinchAnchor = pointerMid();
      } else if (pointers.size === 1 && zoom > 1) {
        // Start pan.
        dragging = true;
        panStart = { x: e.clientX, y: e.clientY, panX, panY };
        applyTransform();
      }
    });

    imgEl.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinchStartDist > 0) {
        e.preventDefault();
        const dist = pointerDistance();
        const ratio = dist / pinchStartDist;
        const target = pinchStartZoom * ratio;
        const mid = pointerMid();
        setZoom(target, mid);
        pinchAnchor = mid;
      } else if (dragging && panStart) {
        panX = panStart.panX + (e.clientX - panStart.x);
        panY = panStart.panY + (e.clientY - panStart.y);
        applyTransform();
      }
    });

    function endPointer(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      try { imgEl.releasePointerCapture(e.pointerId); } catch {}
      if (pointers.size < 2) {
        pinchStartDist = 0;
      }
      if (pointers.size === 0) {
        dragging = false;
        panStart = null;
        applyTransform();
      } else if (pointers.size === 1 && zoom > 1) {
        // Switched from pinch to single-finger pan.
        const [only] = [...pointers.values()];
        dragging = true;
        panStart = { x: only.x, y: only.y, panX, panY };
      }
    }
    imgEl.addEventListener("pointerup", endPointer);
    imgEl.addEventListener("pointercancel", endPointer);

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
