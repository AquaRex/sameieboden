import { el } from "../dom.js?v=3";

export function createSearchBar({ onChange }) {
  const input = el("input", {
    id: "search",
    type: "search",
    placeholder: "Søk etter utstyr eller tag (f.eks. hage, vask, stige)…",
    autocomplete: "off",
    oninput: () => onChange(input.value.trim()),
  });

  const root = el("label", { class: "search" }, [
    el("span", { class: "visually-hidden", textContent: "Søk" }),
    input,
  ]);

  return { root, focus: () => input.focus(), get value() { return input.value.trim(); } };
}
