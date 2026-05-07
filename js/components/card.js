import { el } from "../dom.js?v=3";

export function createCard(item, { editable, onEdit, onDelete, onOpen }) {
  const media = item.image
    ? el("div", { class: "card-image-wrap" }, [
        el("img", {
          class: "card-image",
          src: item.image,
          alt: item.name,
          loading: "lazy",
          style: {
            objectPosition: item.imagePos || "50% 50%",
            transformOrigin: item.imagePos || "50% 50%",
            transform: `scale(${item.imageZoom || 1})`,
          },
          onerror: (e) => e.target.parentElement.replaceWith(placeholder()),
        }),
      ])
    : placeholder();

  const tags = el(
    "div",
    { class: "card-tags" },
    item.tags.map((t) => el("span", { class: "card-tag", textContent: t }))
  );

  const body = el("div", { class: "card-body" }, [
    el("h2", { class: "card-title", textContent: item.name }),
    item.description ? el("p", { class: "card-desc", textContent: item.description }) : null,
    tags,
  ]);

  const card = el("li", {
    class: "card",
    dataset: { id: item.id },
    tabindex: "0",
    role: "button",
    "aria-label": `Vis ${item.name}`,
    onclick: (e) => {
      if (e.target.closest("button")) return;
      onOpen?.(item);
    },
    onkeydown: (e) => {
      if (e.target.closest("button")) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen?.(item);
      }
    },
  }, [media, body]);

  if (editable) {
    card.appendChild(
      el("div", { class: "card-actions" }, [
        el("button", {
          type: "button",
          class: "icon-btn",
          title: "Rediger",
          "aria-label": "Rediger " + item.name,
          textContent: "✎",
          onclick: (e) => { e.stopPropagation(); onEdit(item); },
        }),
        el("button", {
          type: "button",
          class: "icon-btn icon-btn--danger",
          title: "Slett",
          "aria-label": "Slett " + item.name,
          textContent: "🗑",
          onclick: (e) => { e.stopPropagation(); onDelete(item); },
        }),
      ])
    );
  }

  return card;
}

function placeholder() {
  return el("div", { class: "card-image-wrap card-image placeholder", "aria-hidden": "true", textContent: "🛠" });
}
