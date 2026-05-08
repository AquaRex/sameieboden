// Global calendar view (modal). Shows the last 14 days and next 14 days in a
// week-grid that mirrors the reservation day picker, with event lines per day
// (one per reservation that touches the day). Click a day to see the full
// list of items used that day with house numbers.

import { el, clear } from "../dom.js?v=3";
import { DAY_MS, startOfDayMs } from "../util/dates.js?v=1";
import { getAllCalendar, subscribeState } from "../state.js?v=10";

const WEEK_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
const DAYS_BACK = 14;
const DAYS_AHEAD = 14;
const MAX_EVENTS_VISIBLE = 3;

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
  const detailClose = el("button", {
    type: "button",
    class: "id-close",
    "aria-label": "Lukk",
    textContent: "×",
    onclick: () => closeDetail(),
  });
  const detailDialog = el("div", { class: "id-dialog cal-detail-dialog" }, [detailClose, detailTitle, detailList]);
  const detailBackdrop = el("div", { class: "id-backdrop cal-detail-backdrop", hidden: true }, [detailDialog]);
  detailBackdrop.addEventListener("click", (e) => { if (e.target === detailBackdrop) closeDetail(); });

  document.body.append(backdrop, detailBackdrop);

  let rows = [];
  let unsubscribe = null;
  let isOpen = false;

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
    if (!isOpen) document.body.classList.remove("id-open");
  }

  async function reload() {
    rows = await getAllCalendar({ daysBack: DAYS_BACK, daysAhead: DAYS_AHEAD });
    render();
  }

  function itemBySlug(slug) {
    const items = (getItems && getItems()) || [];
    return items.find((it) => it.slug === slug) || null;
  }

  function eventsForDay(ts) {
    const dayStart = ts;
    const dayEnd = ts + DAY_MS;
    const today = startOfDayMs();
    const out = [];
    for (const r of rows) {
      const from = Date.parse(r.period_from);
      const to = r.period_to ? Date.parse(r.period_to) : Number.POSITIVE_INFINITY;
      if (from < dayEnd && to > dayStart) {
        let kind = "future";
        if (ts < today) kind = "past";
        else if (ts === today) kind = "today";
        out.push({ row: r, kind });
      }
    }
    // Stable order: by slug, then start
    out.sort((a, b) => (a.row.slug || "").localeCompare(b.row.slug || "") || (Date.parse(a.row.period_from) - Date.parse(b.row.period_from)));
    return out;
  }

  function render() {
    clear(grid);

    // Week header
    grid.appendChild(el("div", { class: "id-day-row id-day-head cal-day-head" },
      WEEK_LABELS.map((l) => el("div", { class: "id-day-head-cell", textContent: l }))
    ));

    const today = startOfDayMs();
    const start = today - DAYS_BACK * DAY_MS;
    const end = today + (DAYS_AHEAD + 1) * DAY_MS; // inclusive of last day

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

    const events = eventsForDay(ts);
    const visible = events.slice(0, MAX_EVENTS_VISIBLE);
    const overflow = events.length - visible.length;

    const eventsEl = el("div", { class: "cal-events" });
    for (const ev of visible) eventsEl.appendChild(buildEvent(ev));
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
      onclick: () => openDetail(ts, events),
      onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(ts, events); } },
    }, [head, eventsEl]);
    return cell;
  }

  function buildEvent(ev) {
    const item = itemBySlug(ev.row.slug);
    const name = item ? item.name : ev.row.slug;
    return el("div", { class: `cal-event cal-event--${ev.kind}`, title: `${ev.row.house} — ${name}` }, [
      el("span", { class: "cal-event-house", textContent: ev.row.house || "?" }),
      el("span", { class: "cal-event-name", textContent: name }),
    ]);
  }

  function openDetail(ts, events) {
    const d = new Date(ts);
    const dateLabel = d.toLocaleDateString("no-NO", { weekday: "long", day: "numeric", month: "long" });
    detailTitle.textContent = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
    clear(detailList);
    if (!events.length) {
      detailList.appendChild(el("p", { class: "cal-detail-empty", textContent: "Ingen bruk denne dagen." }));
    } else {
      for (const ev of events) {
        const item = itemBySlug(ev.row.slug);
        const name = item ? item.name : ev.row.slug;
        const periodLabel = formatPeriod(ev.row);
        detailList.appendChild(el("div", { class: `cal-detail-row cal-detail-row--${ev.kind}` }, [
          el("span", { class: "cal-detail-house", textContent: ev.row.house || "?" }),
          el("div", { class: "cal-detail-text" }, [
            el("div", { class: "cal-detail-name", textContent: name }),
            el("div", { class: "cal-detail-period", textContent: periodLabel }),
          ]),
        ]));
      }
    }
    detailBackdrop.hidden = false;
    document.body.classList.add("id-open");
  }

  return { open, close };
}

function formatPeriod(row) {
  const from = new Date(row.period_from);
  const fromStr = from.toLocaleDateString("no-NO", { day: "numeric", month: "short" });
  if (!row.period_to) return `Pågår — siden ${fromStr}`;
  const to = new Date(row.period_to);
  const sameDay = from.toDateString() === to.toDateString();
  if (sameDay) return fromStr;
  const toStr = to.toLocaleDateString("no-NO", { day: "numeric", month: "short" });
  return `${fromStr} – ${toStr}`;
}
