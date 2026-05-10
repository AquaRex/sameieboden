// Reusable single-date picker styled like the reservation day picker, but
// supporting any month/year. Rendered as an inline panel containing a month
// header (prev / month-year / next) and a 7-column day grid.
//
// Usage:
//   const picker = createDatePicker({
//     value: "2026-05-08", // ISO date string or null
//     onChange: (iso) => { ... },
//   });
//   container.appendChild(picker.root);
//   picker.setValue("2026-12-31");
//   picker.getValue(); // "YYYY-MM-DD"

import { el, clear } from "../../helpers/dom.js?v=1778420168";

const WEEK_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
const MONTH_LABELS = [
  "Januar", "Februar", "Mars", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Desember",
];

function pad(n) { return String(n).padStart(2, "0"); }
function toIso(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function parseIso(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m: m - 1, d };
}
function startOfDayDate(y, m, d) {
  const dt = new Date(y, m, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

const CHEV_LEFT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 6 9 12 15 18"/></svg>`;
const CHEV_RIGHT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>`;

export function createDatePicker({ value = null, onChange } = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let selected = parseIso(value); // {y,m,d} or null
  let viewYear = (selected || { y: today.getFullYear() }).y;
  let viewMonth = (selected || { m: today.getMonth() }).m;

  const monthLabel = el("div", { class: "dp-month-label" });
  const prevBtn = el("button", {
    type: "button",
    class: "dp-nav",
    "aria-label": "Forrige måned",
    onclick: (e) => { e.preventDefault(); shiftMonth(-1); },
  });
  prevBtn.innerHTML = CHEV_LEFT;
  const nextBtn = el("button", {
    type: "button",
    class: "dp-nav",
    "aria-label": "Neste måned",
    onclick: (e) => { e.preventDefault(); shiftMonth(1); },
  });
  nextBtn.innerHTML = CHEV_RIGHT;

  const header = el("div", { class: "dp-header" }, [prevBtn, monthLabel, nextBtn]);
  const grid = el("div", { class: "dp-grid" });
  const root = el("div", { class: "dp-root" }, [header, grid]);

  function shiftMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    viewMonth = m;
    viewYear = y;
    render();
  }

  function setValue(iso) {
    selected = parseIso(iso);
    if (selected) { viewYear = selected.y; viewMonth = selected.m; }
    render();
  }

  function getValue() {
    return selected ? toIso(selected.y, selected.m, selected.d) : "";
  }

  function pick(y, m, d) {
    selected = { y, m, d };
    render();
    if (onChange) onChange(getValue());
  }

  function render() {
    monthLabel.textContent = `${MONTH_LABELS[viewMonth]} ${viewYear}`;
    clear(grid);

    // Weekday header
    grid.appendChild(el("div", { class: "dp-row dp-head" },
      WEEK_LABELS.map((l) => el("div", { class: "dp-head-cell", textContent: l }))));

    const first = new Date(viewYear, viewMonth, 1);
    const firstDow = (first.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    let row = el("div", { class: "dp-row" });
    for (let i = 0; i < firstDow; i++) row.appendChild(el("div", { class: "dp-pad" }));

    for (let d = 1; d <= daysInMonth; d++) {
      const dt = startOfDayDate(viewYear, viewMonth, d);
      const isToday = dt.getTime() === today.getTime();
      const isSelected = selected && selected.y === viewYear && selected.m === viewMonth && selected.d === d;
      const cls = ["dp-day"];
      if (isToday) cls.push("is-today");
      if (isSelected) cls.push("is-selected");
      row.appendChild(el("button", {
        type: "button",
        class: cls.join(" "),
        textContent: String(d),
        onclick: (e) => { e.preventDefault(); pick(viewYear, viewMonth, d); },
      }));
      const dow = (dt.getDay() + 6) % 7;
      if (dow === 6) {
        grid.appendChild(row);
        row = el("div", { class: "dp-row" });
      }
    }
    if (row.childNodes.length) {
      while (row.childNodes.length < 7) row.appendChild(el("div", { class: "dp-pad" }));
      grid.appendChild(row);
    }
  }

  render();

  return { root, getValue, setValue };
}
