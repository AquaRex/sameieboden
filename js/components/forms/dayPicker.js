// Reusable multi-day picker with click-and-drag range selection.
//
// Renders a chunky calendar grid (default 14 days from today). Days that are
// already booked are non-selectable; the caller can flag some of those as
// "mine" so the user can mark them for cancellation. Confirmation/cancel
// buttons are part of the widget so consumers only get a final commit event.
//
// Usage:
//   const picker = createDayPicker({
//     getReservedDays: () => Map<dayMs, { house, rowId, mine }>,
//     onConfirm: ({ blocks, cancelRowIds }) => Promise<void>,
//     onCancel:  () => void,
//   });
//   container.appendChild(picker.root);
//   picker.reset();         // clear state and re-render
//   picker.refresh();       // re-pull reservations after external change

import { el, clear } from "../../helpers/dom.js?v=1778408805";
import { toast } from "../../helpers/toast.js?v=1778408805";
import { DAY_MS, startOfDayMs, labelForDay, daysToBlocks } from "../../helpers/dates.js?v=1778408805";
import { createButton } from "../interactives/button.js?v=1778408805";

const WEEK_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

export function createDayPicker({
  getReservedDays = () => new Map(),
  onConfirm,
  onCancel,
  days = 14,
} = {}) {
  const selectedDays = new Set();
  const cancelRowIds = new Set();

  const grid = el("div", { class: "id-day-picker" });
  const summary = el("p", { class: "id-day-summary" });
  const cancelBtn = createButton({
    label: "Avbryt",
    variant: "cancel",
    onClick: () => { onCancel && onCancel(); },
  }).root;
  const confirmBtn = createButton({
    label: "Reserver",
    variant: "confirm",
    onClick: handleConfirm,
  }).root;
  const actions = el("div", { class: "id-picker-actions" }, [cancelBtn, confirmBtn]);
  const root = el("div", { class: "id-day-picker-root" }, [grid, summary, actions]);

  attachDragSelect(grid);

  function reset() {
    selectedDays.clear();
    cancelRowIds.clear();
    render();
  }

  function refresh() {
    render();
  }

  function render() {
    clear(grid);
    const today = startOfDayMs();
    const horizon = today + days * DAY_MS;
    const reserved = getReservedDays();

    grid.appendChild(weekHeader());
    let row = el("div", { class: "id-day-row" });
    const firstDow = (new Date(today).getDay() + 6) % 7;
    for (let i = 0; i < firstDow; i++) row.appendChild(el("div", { class: "id-day-pad" }));

    for (let ts = today; ts < horizon; ts += DAY_MS) {
      row.appendChild(buildDayBtn(ts, reserved));
      const dow = (new Date(ts).getDay() + 6) % 7;
      if (dow === 6) {
        grid.appendChild(row);
        row = el("div", { class: "id-day-row" });
      }
    }
    if (row.childNodes.length) grid.appendChild(row);

    summary.textContent = describeSelection(selectedDays, cancelRowIds);
  }

  function buildDayBtn(ts, reservedMap) {
    const d = new Date(ts);
    const reservation = reservedMap.get(ts);
    const isToday = ts === startOfDayMs();
    const isMine = reservation && reservation.mine;
    const isCancel = isMine && cancelRowIds.has(reservation.rowId);
    const cls = ["id-day-btn"];
    if (selectedDays.has(ts)) cls.push("is-selected");
    if (isToday) cls.push("is-today");
    if (reservation) cls.push("is-booked");
    if (isMine) cls.push("is-mine");
    if (isCancel) cls.push("is-cancel");

    const attrs = {
      type: "button",
      class: cls.join(" "),
      "data-ts": String(ts),
      title: reservation
        ? (isMine
            ? (isCancel ? "Klikk igjen for å beholde reservasjonen" : "Din reservasjon — klikk for å avbryte")
            : `Reservert av ${reservation.house}`)
        : "",
    };
    if (reservation) attrs["data-row-id"] = String(reservation.rowId);
    if (isMine) attrs["data-mine"] = "1";

    return el("button", attrs, [
      el("span", { class: "id-day-num", textContent: String(d.getDate()) }),
      el("span", { class: "id-day-mon", textContent: d.toLocaleDateString("no-NO", { month: "short" }) }),
      reservation ? el("span", { class: "id-day-booked", textContent: reservation.house }) : null,
    ]);
  }

  function weekHeader() {
    return el("div", { class: "id-day-row id-day-head" },
      WEEK_LABELS.map((l) => el("div", { class: "id-day-head-cell", textContent: l }))
    );
  }

  // ---- Drag-select gesture ----------------------------------------------
  function attachDragSelect(wrap) {
    let anchorTs = null;
    let paintMode = null;
    let moved = false;
    let activePointerId = null;
    let snapshot = null;
    let lastRangeKeys = null;

    const isFreeBtn = (b) => b && !b.classList.contains("is-booked");
    const tsOf = (b) => { const v = b && b.getAttribute("data-ts"); return v ? Number(v) : null; };
    const btnAt = (x, y) => {
      const node = document.elementFromPoint(x, y);
      return node ? node.closest(".id-day-btn") : null;
    };
    const range = (a, b) => {
      const lo = Math.min(a, b), hi = Math.max(a, b);
      const out = [];
      for (let t = lo; t <= hi; t += DAY_MS) out.push(t);
      return out;
    };
    const setSelected = (ts, on) => {
      if (on) selectedDays.add(ts); else selectedDays.delete(ts);
      const btn = wrap.querySelector(`.id-day-btn[data-ts="${ts}"]`);
      if (btn && !btn.classList.contains("is-booked")) {
        btn.classList.toggle("is-selected", on);
      }
    };
    const applyRange = (endTs) => {
      const newKeys = new Set(range(anchorTs, endTs));
      if (lastRangeKeys) {
        for (const ts of lastRangeKeys) {
          if (!newKeys.has(ts)) setSelected(ts, snapshot.has(ts));
        }
      }
      for (const ts of newKeys) {
        const btn = wrap.querySelector(`.id-day-btn[data-ts="${ts}"]`);
        if (!btn || !isFreeBtn(btn)) continue;
        setSelected(ts, paintMode);
      }
      lastRangeKeys = newKeys;
      summary.textContent = describeSelection(selectedDays, cancelRowIds);
    };
    const cleanup = () => {
      anchorTs = null; paintMode = null; moved = false;
      snapshot = null; lastRangeKeys = null;
      try { activePointerId != null && wrap.releasePointerCapture(activePointerId); } catch {}
      activePointerId = null;
    };

    wrap.addEventListener("pointerdown", (e) => {
      const btn = e.target.closest(".id-day-btn");
      if (!btn) return;
      e.preventDefault();
      anchorTs = tsOf(btn);
      moved = false;
      activePointerId = e.pointerId;
      snapshot = new Set(selectedDays);
      lastRangeKeys = null;
      if (isFreeBtn(btn)) {
        paintMode = !selectedDays.has(anchorTs);
        setSelected(anchorTs, paintMode);
        lastRangeKeys = new Set([anchorTs]);
        summary.textContent = describeSelection(selectedDays, cancelRowIds);
      } else {
        paintMode = null;
      }
      try { wrap.setPointerCapture(e.pointerId); } catch {}
    });

    wrap.addEventListener("pointermove", (e) => {
      if (anchorTs == null || paintMode == null) return;
      const btn = btnAt(e.clientX, e.clientY);
      const ts = tsOf(btn);
      if (ts == null) return;
      if (ts !== anchorTs) moved = true;
      applyRange(ts);
    });

    wrap.addEventListener("pointerup", () => {
      if (anchorTs == null) return;
      if (paintMode == null) {
        const btn = wrap.querySelector(`.id-day-btn[data-ts="${anchorTs}"]`);
        if (btn) handleBookedTap(btn);
      }
      cleanup();
    });
    wrap.addEventListener("pointercancel", cleanup);
    wrap.addEventListener("contextmenu", (e) => { if (anchorTs != null) e.preventDefault(); });

    function handleBookedTap(btn) {
      if (!btn.classList.contains("is-booked")) return;
      if (btn.dataset.mine === "1") {
        const rowId = Number(btn.dataset.rowId);
        if (cancelRowIds.has(rowId)) cancelRowIds.delete(rowId);
        else cancelRowIds.add(rowId);
        render();
      } else {
        const tag = btn.querySelector(".id-day-booked");
        toast(`Allerede reservert av ${tag ? tag.textContent : "et annet hus"}.`, { kind: "error" });
      }
    }
  }

  async function handleConfirm() {
    if (selectedDays.size === 0 && cancelRowIds.size === 0) {
      toast("Velg minst én dag, eller avbryt en eksisterende reservasjon.", { kind: "error" });
      return;
    }
    const blocks = selectedDays.size > 0
      ? daysToBlocks([...selectedDays].sort((a, b) => a - b))
      : [];
    const cancelled = [...cancelRowIds];
    if (onConfirm) await onConfirm({ blocks, cancelRowIds: cancelled });
  }

  return { root, reset, refresh };
}

function describeSelection(set, cancelSet) {
  const parts = [];
  if (set.size === 1) parts.push(`Reserverer ${labelForDay([...set][0])}`);
  else if (set.size > 1) parts.push(`Reserverer ${set.size} dager`);
  if (cancelSet && cancelSet.size > 0) {
    parts.push(`avbryter ${cancelSet.size} reservasjon${cancelSet.size === 1 ? "" : "er"}`);
  }
  if (parts.length === 0) return "Ingen endringer valgt.";
  return parts.join(" · ") + ".";
}
