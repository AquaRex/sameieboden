// Unified Button component. All buttons in the app should be created with
// this factory so they share a single visual system.
//
// Variants:
//   "default" — plain pill (white surface, dark text). Used for neutral
//               actions like "Reserver" or the Calendar button.
//   "confirm" — yellow accent (primary). "Bruk nå", "Lagre", "+ Legg til".
//   "warning" — red. Destructive actions like "Slett".
//   "cancel"  — ghost (no background until hover). "Avbryt".
//
// Sizes: "default" | "small".
//
// Optional `icon` is a raw SVG string (or any HTML) rendered before the label.

import { el } from "../../helpers/dom.js?v=1778425356";

const VARIANT_CLASS = {
  default: "btn",
  confirm: "btn btn-primary",
  warning: "btn btn-danger",
  cancel: "btn btn-ghost",
};

export function createButton({
  label = "",
  icon = null,
  variant = "default",
  size = "default",
  onClick,
  href = null,
  type = "button",
  ariaLabel = null,
  title = null,
  class: extraClass = "",
  disabled = false,
} = {}) {
  const classes = [VARIANT_CLASS[variant] || VARIANT_CLASS.default];
  if (size === "small") classes.push("btn-small");
  if (icon) classes.push("btn-with-icon");
  if (extraClass) classes.push(extraClass);

  const labelEl = el("span", { class: "btn-label", textContent: label });
  const children = [];
  if (icon) {
    const iconEl = el("span", { class: "btn-icon", "aria-hidden": "true" });
    iconEl.innerHTML = icon;
    children.push(iconEl);
  }
  children.push(labelEl);

  const props = {
    class: classes.join(" "),
    title: title || undefined,
    "aria-label": ariaLabel || undefined,
  };
  if (href) {
    props.href = href;
  } else {
    props.type = type;
    if (onClick) props.onclick = onClick;
    if (disabled) props.disabled = true;
  }

  const root = el(href ? "a" : "button", props, children);

  return {
    root,
    setLabel(text) { labelEl.textContent = text; },
    setDisabled(d) {
      if (root.tagName === "BUTTON") root.disabled = !!d;
      else root.classList.toggle("is-disabled", !!d);
    },
  };
}
