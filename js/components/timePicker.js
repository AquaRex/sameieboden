// Themed time picker. Two stacked-chevron number tiles (hour + minute).
// Designed to match the cream/yellow Animal-Crossing-ish theme of the site.
//
// Numbers are always visible (defaults to `defaultTime`). To represent "no
// time set", combine the picker with a separate toggle/checkbox in your form
// rather than encoding that state inside the picker itself.
//
// Usage:
//   const tp = createTimePicker({ value: "10:00", minuteStep: 5, onChange: (v) => ... });
//   parent.appendChild(tp.root);
//   tp.getValue();          // "HH:MM"
//   tp.setValue("13:30");   // also accepts "" / null -> falls back to defaultTime
//   tp.setDisabled(true);

import { el } from "../dom.js?v=3";

const CHEV_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 15 12 9 18 15"/></svg>';
const CHEV_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

function pad(n) { return String(n).padStart(2, "0"); }

function parse(v) {
  if (!v) return null;
  const m = String(v).match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const mi = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  return { h, m: mi };
}

export function createTimePicker({
  value = "",
  minuteStep = 5,
  defaultTime = "12:00",
  onChange,
} = {}) {
  const step = Math.max(1, Math.min(60, minuteStep | 0));
  const fallback = parse(defaultTime) || { h: 12, m: 0 };

  let current = parse(value) || { ...fallback };
  let disabled = false;

  const hourEl = el("span", { class: "tp-num" });
  const minEl = el("span", { class: "tp-num" });

  const hourTile = buildTile({
    label: "Time",
    numEl: hourEl,
    onUp: () => bumpHour(+1),
    onDown: () => bumpHour(-1),
    onWheelDir: (dir) => bumpHour(dir),
  });
  const minTile = buildTile({
    label: "Min",
    numEl: minEl,
    onUp: () => bumpMin(+1),
    onDown: () => bumpMin(-1),
    onWheelDir: (dir) => bumpMin(dir),
  });

  const sepEl = el("span", { class: "tp-sep", textContent: ":" });

  const root = el("div", { class: "tp-root" }, [hourTile, sepEl, minTile]);

  render();

  function buildTile({ label, numEl, onUp, onDown, onWheelDir }) {
    const upBtn = el("button", {
      type: "button", class: "tp-chev tp-chev--up",
      "aria-label": `${label} opp`,
      innerHTML: CHEV_UP,
      onclick: (e) => { e.preventDefault(); if (!disabled) onUp(); },
    });
    const downBtn = el("button", {
      type: "button", class: "tp-chev tp-chev--down",
      "aria-label": `${label} ned`,
      innerHTML: CHEV_DOWN,
      onclick: (e) => { e.preventDefault(); if (!disabled) onDown(); },
    });
    const numWrap = el("div", {
      class: "tp-display",
      role: "spinbutton",
      tabindex: "0",
      "aria-label": label,
      onkeydown: (e) => {
        if (disabled) return;
        if (e.key === "ArrowUp") { e.preventDefault(); onUp(); }
        else if (e.key === "ArrowDown") { e.preventDefault(); onDown(); }
      },
      onwheel: (e) => {
        if (disabled || e.deltaY === 0) return;
        e.preventDefault();
        onWheelDir(e.deltaY > 0 ? -1 : +1);
      },
    }, [numEl]);
    const cap = el("span", { class: "tp-cap", textContent: label });
    return el("div", { class: "tp-tile" }, [upBtn, numWrap, downBtn, cap]);
  }

  function bumpHour(delta) {
    current.h = (current.h + delta + 24) % 24;
    emit();
  }

  function bumpMin(delta) {
    let total = current.h * 60 + current.m;
    total += delta * step;
    if (delta > 0) total = Math.ceil(total / step) * step;
    else total = Math.floor(total / step) * step;
    total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
    current.h = Math.floor(total / 60);
    current.m = total % 60;
    emit();
  }

  function emit() {
    render();
    if (typeof onChange === "function") onChange(getValue());
  }

  function render() {
    hourEl.textContent = pad(current.h);
    minEl.textContent = pad(current.m);
    root.classList.toggle("is-disabled", disabled);
  }

  function getValue() {
    return `${pad(current.h)}:${pad(current.m)}`;
  }

  function setValue(v) {
    const parsed = parse(v);
    current = parsed || { ...fallback };
    render();
  }

  function setDisabled(d) {
    disabled = !!d;
    render();
  }

  return { root, getValue, setValue, setDisabled };
}
