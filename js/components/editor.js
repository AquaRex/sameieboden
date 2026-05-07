// Modal editor for adding or editing an equipment entry.
// Self-contained: it owns its own DOM and exposes open()/close().

import { el, clear } from "../dom.js";

const MAX_IMAGE_BYTES = 600 * 1024; // ~600KB after compression

export function createEditor({ onSave, getKnownTags }) {
  let mode = "add";        // "add" | "edit"
  let editingId = null;
  let imageDataUrl = "";
  let imagePos = "50% 50%";
  let imageZoom = 1;
  let tags = [];

  // ---------- inputs ----------
  const nameInput = el("input", { type: "text", id: "ed-name", required: true, autocomplete: "off" });
  const descInput = el("textarea", { id: "ed-desc", rows: 3 });

  const tagsList = el("div", { class: "ed-tags" });
  const tagInput = el("input", {
    type: "text",
    id: "ed-tag-input",
    placeholder: "Legg til tag og trykk Enter…",
    autocomplete: "off",
    onkeydown: (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTag(tagInput.value);
        tagInput.value = "";
      } else if (e.key === "Backspace" && !tagInput.value && tags.length) {
        removeTag(tags[tags.length - 1]);
      }
    },
  });

  const knownTagsBox = el("div", { class: "ed-known-tags" });

  const dropZone = el("div", { class: "ed-drop", tabindex: "0" });
  const fileInput = el("input", {
    type: "file",
    accept: "image/*",
    class: "visually-hidden",
    onchange: (e) => handleFile(e.target.files[0]),
  });
  dropZone.append(fileInput);
  wireDropZone(dropZone, fileInput, handleFile);

  const focalPanel = el("div", { class: "ed-focal-panel", hidden: true });

  const errorBox = el("p", { class: "ed-error", role: "alert" });
  const titleEl = el("h2", { id: "ed-title", class: "modal-title" });

  // ---------- form layout ----------
  const form = el(
    "form",
    {
      class: "modal-form",
      onsubmit: (e) => {
        e.preventDefault();
        submit();
      },
    },
    [
      titleEl,
      field("Navn", nameInput),
      field("Beskrivelse", descInput),
      field(
        "Tags",
        el("div", { class: "ed-tags-wrap" }, [tagsList, tagInput, knownTagsBox])
      ),
      el("div", { class: "ed-field" }, [
        el("span", { textContent: "Bilde" }),
        el("div", { class: "ed-image-field" }, [dropZone, focalPanel]),
      ]),
      errorBox,
      el("div", { class: "modal-actions" }, [
        el("button", { type: "button", class: "btn btn-ghost", textContent: "Avbryt", onclick: close }),
        el("button", { type: "submit", class: "btn btn-primary", textContent: "Lagre" }),
      ]),
    ]
  );

  const dialog = el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "ed-title" }, [form]);
  const backdrop = el("div", { class: "modal-backdrop", hidden: true, onclick: (e) => { if (e.target === backdrop) close(); } }, [dialog]);
  document.body.appendChild(backdrop);
  document.addEventListener("keydown", (e) => { if (!backdrop.hidden && e.key === "Escape") close(); });

  // ---------- public API ----------
  function open(item = null) {
    mode = item ? "edit" : "add";
    editingId = item?.id ?? null;
    titleEl.textContent = item ? "Rediger utstyr" : "Legg til utstyr";
    nameInput.value = item?.name ?? "";
    descInput.value = item?.description ?? "";
    tags = [...(item?.tags ?? [])];
    imageDataUrl = item?.image ?? "";
    imagePos = item?.imagePos ?? "50% 50%";
    imageZoom = Number.isFinite(item?.imageZoom) && item.imageZoom >= 1 ? item.imageZoom : 1;
    errorBox.textContent = "";
    refreshTags();
    refreshDropZone();
    backdrop.hidden = false;
    setTimeout(() => nameInput.focus(), 0);
  }

  function close() {
    backdrop.hidden = true;
  }

  // ---------- internals ----------
  function field(label, input) {
    return el("label", { class: "ed-field" }, [el("span", { textContent: label }), input]);
  }

  function addTag(raw) {
    const t = String(raw).trim();
    if (!t) return;
    if (tags.includes(t)) return;
    tags.push(t);
    refreshTags();
  }

  function removeTag(t) {
    tags = tags.filter((x) => x !== t);
    refreshTags();
  }

  function refreshTags() {
    clear(tagsList);
    for (const t of tags) {
      tagsList.appendChild(
        el("span", { class: "ed-tag-chip" }, [
          document.createTextNode(t),
          el("button", {
            type: "button",
            class: "ed-tag-x",
            "aria-label": `Fjern ${t}`,
            textContent: "×",
            onclick: () => removeTag(t),
          }),
        ])
      );
    }

    // Suggestions: existing tags not yet on this item.
    clear(knownTagsBox);
    const remaining = getKnownTags().filter((t) => !tags.includes(t));
    if (remaining.length === 0) return;
    knownTagsBox.appendChild(el("span", { class: "ed-known-label", textContent: "Eksisterende:" }));
    for (const t of remaining) {
      knownTagsBox.appendChild(
        el("button", {
          type: "button",
          class: "tag-chip tag-chip--small",
          textContent: t,
          onclick: () => addTag(t),
        })
      );
    }
  }

  function refreshDropZone() {
    clear(dropZone);
    clear(focalPanel);
    dropZone.appendChild(fileInput);

    if (!imageDataUrl) {
      dropZone.appendChild(
        el("p", { class: "ed-drop-hint", textContent: "Dra et bilde hit, eller klikk for å velge." })
      );
      focalPanel.hidden = true;
      return;
    }

    // Drop zone: small thumbnail + replace hint.
    dropZone.appendChild(el("img", { class: "ed-preview", src: imageDataUrl, alt: "" }));
    dropZone.appendChild(
      el("p", { class: "ed-drop-hint", textContent: "Dra et nytt bilde hit, eller klikk for å bytte." })
    );

    focalPanel.hidden = false;
    buildCropper();
  }

  function buildCropper() {
    // Square frame; the image inside is dragged to choose the visible crop,
    // and zoomed via slider / wheel / pinch. The result is stored as
    // `imagePos` (% %) + `imageZoom` (>=1) which the card renderer applies
    // with object-position + transform-origin + scale, matching this preview.
    const frame = el("div", { class: "ed-crop" });
    const img = el("img", {
      class: "ed-crop-img",
      src: imageDataUrl,
      alt: "",
      draggable: false,
    });
    frame.appendChild(img);

    let imgRatio = 1;       // natural width / height
    let frameSize = 0;      // px
    let baseW = 0, baseH = 0; // cover-fit base size at zoom=1
    let tx = 0, ty = 0;     // translation in px relative to centered

    function recomputeBase() {
      frameSize = frame.getBoundingClientRect().width;
      if (!frameSize || !imgRatio) return;
      if (imgRatio >= 1) {
        baseH = frameSize;
        baseW = frameSize * imgRatio;
      } else {
        baseW = frameSize;
        baseH = frameSize / imgRatio;
      }
      // Convert stored imagePos % into pixel translation at current zoom.
      const [xStr, yStr] = imagePos.split(/\s+/);
      const xp = parseFloat(xStr); const yp = parseFloat(yStr);
      const xpClamped = isFinite(xp) ? xp : 50;
      const ypClamped = isFinite(yp) ? yp : 50;
      const ovX = baseW * imageZoom - frameSize;
      const ovY = baseH * imageZoom - frameSize;
      tx = ((50 - xpClamped) / 100) * Math.max(0, ovX);
      ty = ((50 - ypClamped) / 100) * Math.max(0, ovY);
      apply();
    }

    function apply() {
      const w = baseW * imageZoom;
      const h = baseH * imageZoom;
      const ovX = Math.max(0, w - frameSize);
      const ovY = Math.max(0, h - frameSize);
      tx = Math.max(-ovX / 2, Math.min(ovX / 2, tx));
      ty = Math.max(-ovY / 2, Math.min(ovY / 2, ty));
      img.style.width = w + "px";
      img.style.height = h + "px";
      img.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`;
      // Persist as %.
      const xp = ovX > 0 ? 50 - (tx / ovX) * 100 : 50;
      const yp = ovY > 0 ? 50 - (ty / ovY) * 100 : 50;
      imagePos = `${xp.toFixed(1)}% ${yp.toFixed(1)}%`;
    }

    function setZoom(next, anchor /* {x,y} in frame coords, optional */) {
      const z = Math.max(1, Math.min(4, next));
      if (anchor && frameSize) {
        // Keep the point under the cursor stable when zooming.
        // Image-space coord under anchor = (anchor - frameCenter - t) / oldZoom * newZoom
        const cx = frameSize / 2;
        const cy = frameSize / 2;
        const ax = anchor.x - cx;
        const ay = anchor.y - cy;
        const ratio = z / imageZoom;
        tx = ax - (ax - tx) * ratio;
        ty = ay - (ay - ty) * ratio;
      }
      imageZoom = z;
      if (zoomSlider) zoomSlider.value = String(z);
      apply();
    }

    img.addEventListener("load", () => {
      imgRatio = img.naturalWidth / img.naturalHeight;
      recomputeBase();
    });
    if (img.complete && img.naturalWidth) {
      imgRatio = img.naturalWidth / img.naturalHeight;
      // Defer until frame is in DOM and has a size.
      requestAnimationFrame(recomputeBase);
    }

    // Drag to pan.
    let dragging = false;
    let startX = 0, startY = 0, startTx = 0, startTy = 0;
    frame.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startTx = tx;
      startTy = ty;
      frame.setPointerCapture(e.pointerId);
      frame.classList.add("is-dragging");
    });
    frame.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      tx = startTx + (e.clientX - startX);
      ty = startTy + (e.clientY - startY);
      apply();
    });
    const stopDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      try { frame.releasePointerCapture(e.pointerId); } catch {}
      frame.classList.remove("is-dragging");
    };
    frame.addEventListener("pointerup", stopDrag);
    frame.addEventListener("pointercancel", stopDrag);

    // Wheel to zoom (anchored at cursor).
    frame.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = frame.getBoundingClientRect();
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const factor = Math.exp(-e.deltaY * 0.0015);
      setZoom(imageZoom * factor, anchor);
    }, { passive: false });

    // Recompute layout if frame size changes.
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => recomputeBase()).observe(frame);
    }

    // Zoom slider.
    const zoomSlider = el("input", {
      type: "range",
      min: "1",
      max: "4",
      step: "0.01",
      value: String(imageZoom),
      class: "ed-zoom-slider",
      "aria-label": "Zoom",
      oninput: (e) => setZoom(parseFloat(e.target.value)),
    });

    const zoomRow = el("div", { class: "ed-zoom-row" }, [
      el("button", {
        type: "button",
        class: "ed-zoom-btn",
        "aria-label": "Zoom ut",
        textContent: "−",
        onclick: () => setZoom(imageZoom - 0.25),
      }),
      zoomSlider,
      el("button", {
        type: "button",
        class: "ed-zoom-btn",
        "aria-label": "Zoom inn",
        textContent: "+",
        onclick: () => setZoom(imageZoom + 0.25),
      }),
    ]);

    const hint = el("p", {
      class: "ed-drop-hint ed-focal-hint",
      textContent: "Dra bildet for å justere, og bruk glidebryteren eller scroll for å zoome.",
    });

    const removeBtn = el("button", {
      type: "button",
      class: "btn btn-ghost btn-small",
      textContent: "Fjern bilde",
      onclick: () => {
        imageDataUrl = "";
        imagePos = "50% 50%";
        imageZoom = 1;
        refreshDropZone();
      },
    });

    const resetBtn = el("button", {
      type: "button",
      class: "btn btn-ghost btn-small",
      textContent: "Tilbakestill",
      onclick: () => {
        tx = 0; ty = 0;
        setZoom(1);
      },
    });

    focalPanel.appendChild(el("p", { class: "ed-focal-label", textContent: "Posisjonering i kort" }));
    focalPanel.appendChild(frame);
    focalPanel.appendChild(zoomRow);
    focalPanel.appendChild(hint);
    focalPanel.appendChild(el("div", { class: "ed-focal-actions" }, [resetBtn, removeBtn]));
  }

  async function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      errorBox.textContent = "Filen må være et bilde.";
      return;
    }
    try {
      imageDataUrl = await compressImage(file, 1000, 0.82);
      if (imageDataUrl.length > MAX_IMAGE_BYTES * 1.4) {
        // Try harder for very large images.
        imageDataUrl = await compressImage(file, 800, 0.7);
      }
      imagePos = "50% 50%";
      imageZoom = 1;
      errorBox.textContent = "";
      refreshDropZone();
    } catch (err) {
      errorBox.textContent = "Kunne ikke lese bildet: " + err.message;
    }
  }

  function setImagePos(xPct, yPct) {
    const x = Math.max(0, Math.min(100, xPct));
    const y = Math.max(0, Math.min(100, yPct));
    imagePos = `${x.toFixed(1)}% ${y.toFixed(1)}%`;
  }

  function submit() {
    const name = nameInput.value.trim();
    if (!name) {
      errorBox.textContent = "Navn er påkrevd.";
      nameInput.focus();
      return;
    }
    onSave(mode, editingId, {
      name,
      description: descInput.value.trim(),
      tags: [...tags],
      image: imageDataUrl,
      imagePos,
      imageZoom,
    });
    close();
  }

  return { open, close };
}

// ---------- helpers ----------

function wireDropZone(zone, fileInput, onFile) {
  zone.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") return;
    fileInput.click();
  });
  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  ["dragenter", "dragover"].forEach((evt) =>
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.add("is-dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.remove("is-dragover");
    })
  );
  zone.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  });
}

function compressImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("kunne ikke lese fil"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("ugyldig bilde"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
