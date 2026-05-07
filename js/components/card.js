import { el } from "../dom.js";

export function createCard(item, { editable, onEdit, onDelete }) {
  const media = item.image
    ? el("img", {
        class: "card-image",
        src: item.image,
        alt: item.name,
        loading: "lazy",
        onerror: (e) => e.target.replaceWith(placeholder()),
      })
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

  const card = el("li", { class: "card", dataset: { id: item.id } }, [media, body]);

  if (editable) {
    card.appendChild(
      el("div", { class: "card-actions" }, [
        el("button", {
          type: "button",
          class: "icon-btn",
          title: "Rediger",
          "aria-label": "Rediger " + item.name,
          textContent: "✎",
          onclick: () => onEdit(item),
        }),
        el("button", {
          type: "button",
          class: "icon-btn icon-btn--danger",
          title: "Slett",
          "aria-label": "Slett " + item.name,
          textContent: "🗑",
          onclick: () => onDelete(item),
        }),
      ])
    );
  }

  return card;
}

function placeholder() {
  return el("div", { class: "card-image placeholder", "aria-hidden": "true", textContent: "🛠" });
}
