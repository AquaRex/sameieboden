import { el } from "../dom.js?v=3";
import { getState } from "../state.js?v=7";

export function createCard(item, { editable, onEdit, onDelete, onOpen }) {
  const cardSrc = item.imageThumb || item.image;
  const media = cardSrc
    ? el("div", { class: "card-image-wrap" }, [
        el("img", {
          class: "card-image",
          src: cardSrc,
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

  const st = getState(item.slug);
  const statusBadge = el("span", {
    class: `card-status card-status--${st.status}`,
    textContent: statusBadgeText(st),
  });
  if (st.status === "available") statusBadge.hidden = true;
  media.appendChild(statusBadge);

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

function statusBadgeText(st) {
  if (st.status === "in_use") return st.holder ? `I bruk · ${st.holder}` : "I bruk";
  if (st.status === "reserved") {
    const who = st.holder ? ` · ${st.holder}` : "";
    const when = st.period_from ? ` · ${shortDate(st.period_from)}` : "";
    return `Reservert${who}${when}`;
  }
  return "";
}

function shortDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("no-NO", { day: "numeric", month: "short" });
}
