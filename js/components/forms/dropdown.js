// Themed dropdown. Replaces native <select> with a styled button + popup list.
// Reusable across the site. Keyboard-accessible (Enter/Space to open, arrows
// to navigate, Esc to close, type-ahead).
//
// Usage:
//   const dd = createDropdown({
//     options: [{ value: "", label: "Alle" }, { value: "20A", label: "20A" }],
//     value: "",
//     placeholder: "Velg…",
//     onChange: (val) => { ... },
//   });
//   parent.appendChild(dd.root);
//   dd.setValue(newVal);
//   dd.setOptions(newOpts);

import { el, clear } from "../../helpers/dom.js?v=1778425523";

const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

export function createDropdown({ options = [], value = "", placeholder = "Velg…", onChange } = {}) {
  let opts = normalize(options);
  let current = value;
  let open = false;
  let typeahead = "";
  let typeaheadTimer = null;

  const labelEl = el("span", { class: "dd-label" });
  const chevronEl = el("span", { class: "dd-chevron", innerHTML: CHEVRON });
  const trigger = el("button", {
    type: "button",
    class: "dd-trigger",
    "aria-haspopup": "listbox",
    "aria-expanded": "false",
    onclick: toggle,
    onkeydown: onTriggerKey,
  }, [labelEl, chevronEl]);

  const list = el("ul", {
    class: "dd-list",
    role: "listbox",
    tabindex: "-1",
    hidden: true,
    onkeydown: onListKey,
  });

  const root = el("div", { class: "dd" }, [trigger, list]);

  document.addEventListener("click", (e) => {
    if (!open) return;
    if (!root.contains(e.target)) close();
  });

  renderTrigger();
  renderList();

  function normalize(list) {
    return (list || []).map((o) => typeof o === "string" ? { value: o, label: o } : o);
  }

  function renderTrigger() {
    const sel = opts.find((o) => o.value === current);
    if (sel) {
      labelEl.textContent = sel.label;
      labelEl.classList.remove("dd-label--placeholder");
    } else {
      labelEl.textContent = placeholder;
      labelEl.classList.add("dd-label--placeholder");
    }
  }

  function renderList() {
    clear(list);
    for (const opt of opts) {
      const isSel = opt.value === current;
      list.appendChild(el("li", {
        class: "dd-option" + (isSel ? " is-selected" : ""),
        role: "option",
        "aria-selected": isSel ? "true" : "false",
        dataset: { value: opt.value },
        textContent: opt.label,
        onclick: () => select(opt.value),
      }));
    }
  }

  function toggle() { open ? close() : openList(); }

  function openList() {
    if (open) return;
    open = true;
    list.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    root.classList.add("is-open");
    const selected = list.querySelector(".dd-option.is-selected") || list.firstElementChild;
    if (selected) {
      selected.classList.add("is-active");
      selected.scrollIntoView({ block: "nearest" });
    }
  }

  function close() {
    if (!open) return;
    open = false;
    list.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    root.classList.remove("is-open");
    list.querySelectorAll(".is-active").forEach((n) => n.classList.remove("is-active"));
    trigger.focus();
  }

  function select(val) {
    const changed = val !== current;
    current = val;
    renderTrigger();
    renderList();
    close();
    if (changed && onChange) onChange(val);
  }

  function moveActive(delta) {
    const items = [...list.querySelectorAll(".dd-option")];
    if (items.length === 0) return;
    let idx = items.findIndex((n) => n.classList.contains("is-active"));
    if (idx < 0) idx = items.findIndex((n) => n.classList.contains("is-selected"));
    idx = (idx + delta + items.length) % items.length;
    items.forEach((n) => n.classList.remove("is-active"));
    items[idx].classList.add("is-active");
    items[idx].scrollIntoView({ block: "nearest" });
  }

  function commitActive() {
    const active = list.querySelector(".dd-option.is-active");
    if (active) select(active.dataset.value);
  }

  function onTriggerKey(e) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault(); openList(); moveActive(0);
    }
  }

  function onListKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
    else if (e.key === "Enter") { e.preventDefault(); commitActive(); }
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      typeahead += e.key.toLowerCase();
      clearTimeout(typeaheadTimer);
      typeaheadTimer = setTimeout(() => { typeahead = ""; }, 700);
      const items = [...list.querySelectorAll(".dd-option")];
      const match = items.find((n) => n.textContent.toLowerCase().startsWith(typeahead));
      if (match) {
        items.forEach((n) => n.classList.remove("is-active"));
        match.classList.add("is-active");
        match.scrollIntoView({ block: "nearest" });
      }
    }
  }

  // List keys only fire when the list itself is focused; redirect from trigger.
  trigger.addEventListener("keydown", (e) => {
    if (open && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === "Escape")) {
      onListKey(e);
    }
  });

  return {
    root,
    setValue(v) { current = v; renderTrigger(); renderList(); },
    getValue() { return current; },
    setOptions(newOpts) { opts = normalize(newOpts); renderList(); renderTrigger(); },
  };
}
