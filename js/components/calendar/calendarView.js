// Global calendar view (modal). Shows the last 14 days and next 14 days in a
// week-grid that mirrors the reservation day picker.
//
// Per day we show:
//   - Returns (one entry per past reservation, on its period_to date)
//   - Active reservations (one entry on today, while still in use)
//   - Future reservations (one entry on the period_from date)
//   - User-created events (highlighted in yellow, stand out from reservations)
//
// Click a day to see full details, add a new event, or edit/remove your own.

import { el, clear } from "../../helpers/dom.js?v=1778425523";
import { DAY_MS, startOfDayMs } from "../../helpers/dates.js?v=1778425523";
import {
  getAllCalendar,
  getEventsInWindow,
  createEvent,
  updateEvent,
  deleteEvent,
  subscribeState,
} from "../../core/state.js?v=1778425523";
import { getCurrentHouse } from "../../core/currentHouse.js?v=1778425523";
import { createButton } from "../interactives/button.js?v=1778425523";
import { createEventEditor } from "./eventEditor.js?v=1778425523";
import { confirmDialog } from "../overlays/confirmDialog.js?v=1778425523";
import { toast } from "../../helpers/toast.js?v=1778425523";

const WEEK_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
const DAYS_BACK = 14;
const DAYS_AHEAD = 14;
const FELLES_HOUSE = "Sameiet";
const MAX_EVENTS_VISIBLE = 3;

function dateOnlyIso(ts) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function createCalendarView({ getItems }) {
  // ---- Main modal ------------------------------------------------------
  const grid = el("div", { class: "cal-grid" });
  const title = el("h2", { class: "cal-title", textContent: "Kalender" });
  const subtitle = el("p", { class: "cal-subtitle", textContent: "Siste 2 uker og kommende 2 uker" });
  const closeBtn = el("button", {
    type: "button",
    class: "id-close",
    "aria-label": "Lukk",
    textContent: "×",
    onclick: () => close(),
  });
  const dialog = el("div", { class: "id-dialog cal-dialog" }, [closeBtn, title, subtitle, grid]);
  const backdrop = el("div", { class: "id-backdrop cal-backdrop", hidden: true }, [dialog]);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });

  // ---- Day-detail secondary modal --------------------------------------
  const detailList = el("div", { class: "cal-detail-list" });
  const detailTitle = el("h3", { class: "cal-detail-title" });
  const detailAddBtn = el("button", {
    type: "button",
    class: "cal-detail-add-btn",
    "aria-label": "Legg til hendelse",
    title: "Legg til hendelse",
    textContent: "+",
    hidden: true,
    onclick: () => { if (openDay != null) editor.open({ dateIso: dateOnlyIso(openDay) }); },
  });
  const detailEmptyMsg = el("p", { class: "cal-detail-empty", hidden: true });
  const detailClose = el("button", {
    type: "button",
    class: "id-close",
    "aria-label": "Lukk",
    textContent: "×",
    onclick: () => closeDetail(),
  });
  const detailDialog = el("div", { class: "id-dialog cal-detail-dialog" }, [detailClose, detailAddBtn, detailTitle, detailList, detailEmptyMsg]);
  const detailBackdrop = el("div", { class: "id-backdrop cal-detail-backdrop", hidden: true }, [detailDialog]);
  detailBackdrop.addEventListener("click", (e) => { if (e.target === detailBackdrop) closeDetail(); });

  // ---- Event editor (shared component) --------------------------------
  const editor = createEventEditor({
    showHouse: false,
    showDate: false,
    fellesHouse: FELLES_HOUSE,
    getDefaultHouse: () => getCurrentHouse(),
    onSubmit: async ({ mode, id, data }) => {
      if (mode === "edit") {
        await updateEvent(id, data);
        toast("Hendelsen er oppdatert.");
      } else {
        await createEvent(data);
        toast("Hendelsen er opprettet.");
      }
    },
    onAfterSubmit: () => reload(),
  });

  document.body.append(backdrop, detailBackdrop);

  let rows = [];
  let events = [];
  let unsubscribe = null;
  let isOpen = false;
  let openDay = null;

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!detailBackdrop.hidden) closeDetail();
    else if (isOpen) close();
  });

  async function open() {
    isOpen = true;
    backdrop.hidden = false;
    document.body.classList.add("id-open");
    await reload();
    if (!unsubscribe) unsubscribe = subscribeState(() => { reload(); });
  }

  function close() {
    isOpen = false;
    backdrop.hidden = true;
    if (detailBackdrop.hidden) document.body.classList.remove("id-open");
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  }

  function closeDetail() {
    detailBackdrop.hidden = true;
    openDay = null;
    if (!isOpen) document.body.classList.remove("id-open");
  }

  async function reload() {
    [rows, events] = await Promise.all([
      getAllCalendar({ daysBack: DAYS_BACK, daysAhead: DAYS_AHEAD }),
      getEventsInWindow({ daysBack: DAYS_BACK, daysAhead: DAYS_AHEAD }),
    ]);
    render();
    if (openDay != null) refreshDetail(openDay);
  }

  function itemBySlug(slug) {
    const items = (getItems && getItems()) || [];
    return items.find((it) => it.slug === slug) || null;
  }

  // Reservations are shown purely as informational history on the calendar —
  // they're never highlighted as "active" or "future". They all use the same
  // muted "return" styling so they don't compete with user events.
  function reservationsForDay(ts) {
    const today = startOfDayMs();
    const out = [];
    for (const r of rows) {
      const from = startOfDayMs(Date.parse(r.period_from));
      const isReturned = !!r.period_to;
      const to = isReturned
        ? startOfDayMs(Date.parse(r.period_to))
        : Math.max(from, today); // ongoing: span through today
      if (ts < from || ts > to) continue;
      out.push({ row: r, kind: "return" });
    }
    out.sort((a, b) => (a.row.slug || "").localeCompare(b.row.slug || ""));
    return out;
  }

  function eventsForDay(ts) {
    const today = startOfDayMs();
    const dayIso = dateOnlyIso(ts);
    const out = [];
    for (const ev of events) {
      if (ev.event_date !== dayIso) continue;
      let kind = "future";
      if (ts < today) kind = "past";
      else if (ts === today) kind = "today";
      out.push({ row: ev, kind });
    }
    out.sort((a, b) => (a.row.created_at || "").localeCompare(b.row.created_at || ""));
    return out;
  }

  function render() {
    clear(grid);

    grid.appendChild(el("div", { class: "id-day-row id-day-head cal-day-head" },
      WEEK_LABELS.map((l) => el("div", { class: "id-day-head-cell", textContent: l }))
    ));

    const today = startOfDayMs();
    const start = today - DAYS_BACK * DAY_MS;
    const end = today + (DAYS_AHEAD + 1) * DAY_MS;

    let row = el("div", { class: "id-day-row cal-day-row" });
    const firstDow = (new Date(start).getDay() + 6) % 7;
    for (let i = 0; i < firstDow; i++) row.appendChild(el("div", { class: "id-day-pad" }));

    for (let ts = start; ts < end; ts += DAY_MS) {
      row.appendChild(buildDayCell(ts));
      const dow = (new Date(ts).getDay() + 6) % 7;
      if (dow === 6) {
        grid.appendChild(row);
        row = el("div", { class: "id-day-row cal-day-row" });
      }
    }
    if (row.childNodes.length) grid.appendChild(row);
  }

  function buildDayCell(ts) {
    const d = new Date(ts);
    const today = startOfDayMs();
    const cls = ["cal-day-cell"];
    if (ts === today) cls.push("is-today");
    else if (ts < today) cls.push("is-past");
    else cls.push("is-future");

    const head = el("div", { class: "cal-day-head-row" }, [
      el("span", { class: "cal-day-num", textContent: String(d.getDate()) }),
      el("span", { class: "cal-day-mon", textContent: d.toLocaleDateString("no-NO", { month: "short" }) }),
    ]);

    const reservations = reservationsForDay(ts);
    const dayEvents = eventsForDay(ts);
    // Events first so they're always visible at the top of the cell.
    const all = [
      ...dayEvents.map((e) => ({ ...e, source: "event" })),
      ...reservations.map((r) => ({ ...r, source: "reservation" })),
    ];
    const visible = all.slice(0, MAX_EVENTS_VISIBLE);
    const overflow = all.length - visible.length;

    const eventsEl = el("div", { class: "cal-events" });
    for (const ev of visible) eventsEl.appendChild(buildEventLine(ev));
    if (overflow > 0) {
      eventsEl.appendChild(el("div", {
        class: "cal-event cal-event--more",
        textContent: `+${overflow} mer`,
      }));
    }

    const cell = el("div", {
      class: cls.join(" "),
      "data-ts": String(ts),
      role: "button",
      tabindex: "0",
      onclick: () => openDetail(ts),
      onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(ts); } },
    }, [head, eventsEl]);
    return cell;
  }

  function buildEventLine(entry) {
    if (entry.source === "event") {
      const t = formatEventTime(entry.row);
      const label = entry.row.title || "";
      const tooltip = t ? `${entry.row.house} — ${t} ${label}` : `${entry.row.house} — ${label}`;
      return el("div", {
        class: `cal-event cal-event--custom`,
        title: tooltip,
      }, [
        el("span", { class: "cal-event-house", textContent: entry.row.house || "?" }),
        el("span", { class: "cal-event-name", textContent: label }),
      ]);
    }
    const item = itemBySlug(entry.row.slug);
    const name = item ? item.name : entry.row.slug;
    return el("div", {
      class: `cal-event cal-event--${entry.kind}`,
      title: `${entry.row.house} — ${name}`,
    }, [
      el("span", { class: "cal-event-house", textContent: entry.row.house || "?" }),
      el("span", { class: "cal-event-name", textContent: name }),
    ]);
  }

  function openDetail(ts) {
    openDay = ts;
    refreshDetail(ts);
    detailBackdrop.hidden = false;
    document.body.classList.add("id-open");
  }

  function refreshDetail(ts) {
    const d = new Date(ts);
    const dateLabel = d.toLocaleDateString("no-NO", { weekday: "long", day: "numeric", month: "long" });
    detailTitle.textContent = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

    const reservations = reservationsForDay(ts);
    const dayEvents = eventsForDay(ts);
    const me = getCurrentHouse();

    clear(detailList);
    if (!reservations.length && !dayEvents.length) {
      detailList.appendChild(el("p", { class: "cal-detail-empty", textContent: "Ingenting registrert." }));
    } else {
      for (const ev of dayEvents) {
        detailList.appendChild(buildEventDetailRow(ev, !!me && (me === ev.row.house || ev.row.house === FELLES_HOUSE)));
      }
      for (const ev of reservations) {
        const item = itemBySlug(ev.row.slug);
        const name = item ? item.name : ev.row.slug;
        const periodLabel = formatPeriod(ev.row, ev.kind);
        detailList.appendChild(el("div", { class: `cal-detail-row cal-detail-row--${ev.kind}` }, [
          el("span", { class: "cal-detail-house", textContent: ev.row.house || "?" }),
          el("div", { class: "cal-detail-text" }, [
            el("div", { class: "cal-detail-name", textContent: name }),
            el("div", { class: "cal-detail-period", textContent: periodLabel }),
          ]),
        ]));
      }
    }

    if (me) {
      detailAddBtn.hidden = false;
      detailEmptyMsg.hidden = true;
    } else {
      detailAddBtn.hidden = true;
      detailEmptyMsg.textContent = "Velg bolig for å legge til hendelser.";
      detailEmptyMsg.hidden = false;
    }
  }

  function buildEventDetailRow(entry, mine) {
    const ev = entry.row;
    const text = el("div", { class: "cal-detail-text" }, [
      el("div", { class: "cal-detail-name", textContent: ev.title }),
    ]);
    const timeLabel = formatEventTime(ev);
    if (timeLabel) {
      text.appendChild(el("div", { class: "cal-detail-period", textContent: timeLabel }));
    }
    if (ev.description) {
      text.appendChild(el("div", { class: "cal-detail-desc", textContent: ev.description }));
    }
    const children = [
      el("span", { class: "cal-detail-house", textContent: ev.house || "?" }),
      text,
    ];
    if (mine) {
      const actions = el("div", { class: "cal-detail-actions" });
      actions.appendChild(createButton({
        label: "Rediger",
        size: "small",
        variant: "default",
        onClick: () => editor.open({ event: ev }),
      }).root);
      actions.appendChild(createButton({
        label: "Slett",
        size: "small",
        variant: "warning",
        onClick: () => removeEvent(ev),
      }).root);
      children.push(actions);
    }
    return el("div", { class: "cal-detail-row cal-detail-row--event" }, children);
  }

  async function removeEvent(ev) {
    const ok = await confirmDialog({
      title: "Slette hendelsen?",
      message: `"${ev.title}" blir fjernet for alle.`,
      confirmLabel: "Slett",
      cancelLabel: "Avbryt",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteEvent(ev.id);
      toast("Hendelsen er slettet.");
      await reload();
    } catch (err) {
      toast(`Kunne ikke slette: ${err.message || err}`, { kind: "error" });
    }
  }

  return { open, close };
}

function formatPeriod(row /*, kind */) {
  const from = new Date(row.period_from);
  const fromStr = from.toLocaleDateString("no-NO", { day: "numeric", month: "short" });
  const to = row.period_to ? new Date(row.period_to) : null;
  if (!to) return fromStr;
  const sameDay = from.toDateString() === to.toDateString();
  if (sameDay) return fromStr;
  const toStr = to.toLocaleDateString("no-NO", { day: "numeric", month: "short" });
  return `${fromStr} – ${toStr}`;
}

function formatEventTime(ev) {
  if (ev.time_from && ev.time_to) return `${ev.time_from}–${ev.time_to}`;
  if (ev.time_from) return `Fra ${ev.time_from}`;
  if (ev.time_to) return `Til ${ev.time_to}`;
  return "";
}
