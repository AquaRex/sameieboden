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

import { el } from "../../helpers/dom.js?v=1778425101";

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
    });
    const downBtn = el("button", {
      type: "button", class: "tp-chev tp-chev--down",
      "aria-label": `${label} ned`,
      innerHTML: CHEV_DOWN,
    });
    attachRepeat(upBtn, onUp);
    attachRepeat(downBtn, onDown);

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
    attachDrag(numWrap, onUp, onDown);

    const cap = el("span", { class: "tp-cap", textContent: label });
    return el("div", { class: "tp-tile" }, [upBtn, numWrap, downBtn, cap]);
  }

  // Press-and-hold repeat for chevron buttons. First tick fires immediately,
  // then accelerates after a short delay.
  function attachRepeat(btn, fn) {
    let timeoutId = null;
    let intervalId = null;
    const stop = () => {
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    };
    const start = (e) => {
      if (disabled) return;
      if (e.cancelable) e.preventDefault();
      fn();
      timeoutId = setTimeout(() => {
        intervalId = setInterval(() => fn(), 80);
      }, 380);
    };
    btn.addEventListener("pointerdown", start);
    btn.addEventListener("pointerup", stop);
    btn.addEventListener("pointercancel", stop);
    btn.addEventListener("pointerleave", stop);
    // Prevent the synthetic click after pointerup (we already fired in start).
    btn.addEventListener("click", (e) => e.preventDefault());
  }

  // Vertical drag/swipe inside the number display: drag up = increment,
  // drag down = decrement. Step threshold in pixels.
  function attachDrag(elNode, onUp, onDown) {
    const STEP_PX = 18;
    let active = false;
    let startY = 0;
    let accumulated = 0;
    let pointerId = null;

    elNode.addEventListener("pointerdown", (e) => {
      if (disabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      active = true;
      pointerId = e.pointerId;
      startY = e.clientY;
      accumulated = 0;
      try { elNode.setPointerCapture(pointerId); } catch (_) {}
      elNode.classList.add("is-dragging");
    });

    elNode.addEventListener("pointermove", (e) => {
      if (!active || e.pointerId !== pointerId) return;
      e.preventDefault();
      const dy = e.clientY - startY - accumulated;
      if (Math.abs(dy) >= STEP_PX) {
        const steps = Math.trunc(dy / STEP_PX);
        accumulated += steps * STEP_PX;
        for (let i = 0; i < Math.abs(steps); i++) {
          // Drag up (negative dy) -> increment.
          if (steps < 0) onUp(); else onDown();
        }
      }
    });

    const end = (e) => {
      if (!active || (pointerId != null && e.pointerId !== pointerId)) return;
      active = false;
      try { elNode.releasePointerCapture(pointerId); } catch (_) {}
      pointerId = null;
      elNode.classList.remove("is-dragging");
    };
    elNode.addEventListener("pointerup", end);
    elNode.addEventListener("pointercancel", end);
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
