// Modal editor for adding or editing an equipment entry.
// Self-contained: it owns its own DOM and exposes open()/close().

import { el, clear } from "../dom.js";

const MAX_IMAGE_BYTES = 600 * 1024; // ~600KB after compression

export function createEditor({ onSave, getKnownTags }) {
  let mode = "add";        // "add" | "edit"
  let editingId = null;
  let imageDataUrl = "";
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
      field("Bilde", dropZone),
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
    dropZone.appendChild(fileInput);
    if (imageDataUrl) {
      dropZone.appendChild(el("img", { class: "ed-preview", src: imageDataUrl, alt: "" }));
      dropZone.appendChild(
        el("button", {
          type: "button",
          class: "btn btn-ghost btn-small",
          textContent: "Fjern bilde",
          onclick: (e) => {
            e.stopPropagation();
            imageDataUrl = "";
            refreshDropZone();
          },
        })
      );
    } else {
      dropZone.appendChild(
        el("p", { class: "ed-drop-hint", textContent: "Dra et bilde hit, eller klikk for å velge." })
      );
    }
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
      errorBox.textContent = "";
      refreshDropZone();
    } catch (err) {
      errorBox.textContent = "Kunne ikke lese bildet: " + err.message;
    }
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
