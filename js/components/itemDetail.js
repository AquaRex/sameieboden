// Item detail modal: image left, info + actions right.
// Reservation UI is delegated to createDayPicker.

import { el, clear } from "../dom.js?v=3";
import { toast } from "../toast.js?v=1";
import { getCurrentHouse, subscribeCurrentHouse } from "../currentHouse.js?v=1";
import {
  getState, getUpcoming, subscribeState, getHistory, getRecentHistory,
  useItem, reserveBlocks, endActive, cancelReservation,
} from "../state.js?v=10";
import { createDayPicker } from "./dayPicker.js?v=1";
import { confirmDialog } from "./confirmDialog.js?v=1";
import { createButton } from "./button.js?v=1";
import { DAY_MS, startOfDayMs, formatDateTime, formatBlock, formatWhen } from "../util/dates.js?v=1";
import { friendlyError } from "../util/errors.js?v=1";

const STATUS_LABEL = {
  available: "Tilgjengelig",
  in_use:    "I bruk",
  reserved:  "Reservert",
};

export function createItemDetail({ onOpenImage, onChangeHouse, showHistory = false, allowHistoryDelete = false } = {}) {
  let currentItem = null;
  let unsubscribeState = null;
  let unsubscribeHouse = null;

  // ---- DOM ---------------------------------------------------------------
  const imageWrap = el("div", { class: "id-image-wrap" });
  const imageEl = el("img", { class: "id-image", alt: "" });
  imageWrap.appendChild(imageEl);
  imageWrap.addEventListener("click", () => {
    if (currentItem && onOpenImage) onOpenImage(currentItem);
  });

  const titleEl = el("h2", { class: "id-title" });
  const descEl  = el("p",  { class: "id-desc" });
  const tagsEl  = el("div",{ class: "id-tags" });

  const statusBadge = el("span", { class: "id-status-badge" });
  const statusText  = el("span", { class: "id-status-text" });
  const statusRow   = el("div", { class: "id-status-row" }, [statusBadge, statusText]);
  const statusDetail = el("p", { class: "id-status-detail" });

  const upcomingTitle = el("h3", { class: "id-section-title", textContent: "Kommende reservasjoner" });
  const upcomingList = el("ul", { class: "id-upcoming" });

  // Public single-line "last used" — visible to everyone, but only when there
  // is a past reservation within the last 14 days.
  const lastUsedEl = el("p", { class: "id-last-used", hidden: true });

  const historyTitle = el("h3", { class: "id-section-title", textContent: "Sist brukt", hidden: !showHistory });
  const historyList  = el("ul", { class: "id-history", hidden: !showHistory });

  const actionsBar = el("div", { class: "id-actions" });

  const dayPicker = createDayPicker({
    getReservedDays: () => upcomingReservedDays(currentItem.slug, getCurrentHouse()),
    onConfirm: confirmReserve,
    onCancel: hidePicker,
  });
  const pickerWrap = el("div", { class: "id-house-picker", hidden: true }, [dayPicker.root]);

  const closeBtn = el("button", {
    type: "button",
    class: "id-close",
    "aria-label": "Lukk",
    textContent: "×",
    onclick: () => close(),
  });

  const dialog = el("div", { class: "id-dialog", role: "dialog", "aria-modal": "true" }, [
    closeBtn,
    el("div", { class: "id-grid" }, [
      imageWrap,
      el("div", { class: "id-info" }, [
        titleEl, descEl, tagsEl,
        statusRow, statusDetail,
        lastUsedEl,
        upcomingTitle, upcomingList,
        historyTitle, historyList,
        actionsBar, pickerWrap,
      ]),
    ]),
  ]);

  const backdrop = el("div", {
    class: "id-backdrop",
    hidden: true,
    onclick: (e) => { if (e.target === backdrop) close(); },
  }, [dialog]);

  document.body.appendChild(backdrop);

  document.addEventListener("keydown", (e) => {
    if (backdrop.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
  });

  // ---- Render ------------------------------------------------------------
  function renderState() {
    const st = getState(currentItem.slug);
    statusBadge.className = `id-status-badge id-status-badge--${st.status}`;

    let label = STATUS_LABEL[st.status] || "Tilgjengelig";
    if (st.holder) label += ` av ${st.holder}`;
    statusText.textContent = label;

    statusDetail.textContent = "";
    statusDetail.hidden = true;
    if (st.status === "reserved") {
      const parts = ["fra " + formatDateTime(st.period_from)];
      if (st.period_to) parts.push("til " + formatDateTime(st.period_to));
      statusDetail.textContent = parts.join(" ");
      statusDetail.hidden = false;
    } else if (st.status === "in_use") {
      const parts = ["siden " + formatDateTime(st.period_from)];
      if (st.period_to) parts.push("planlagt til " + formatDateTime(st.period_to));
      statusDetail.textContent = parts.join(" · ");
      statusDetail.hidden = false;
    }

    renderUpcoming(st);
    renderActions(st);
    if (!pickerWrap.hidden) dayPicker.refresh();
  }

  function renderUpcoming(st) {
    clear(upcomingList);
    const future = getUpcoming(currentItem.slug).filter((r) => r.id !== st.activeId);
    if (future.length === 0) {
      upcomingTitle.hidden = true;
      upcomingList.hidden = true;
      return;
    }
    upcomingTitle.hidden = false;
    upcomingList.hidden = false;
    const me = getCurrentHouse();
    for (const row of future) {
      const isMine = row.house === me;
      upcomingList.appendChild(
        el("li", { class: "id-upcoming-item" }, [
          el("span", { class: "id-upcoming-when", textContent: formatBlock(row.period_from, row.period_to) }),
          el("span", { class: "id-upcoming-who", textContent: row.house || "?" }),
          isMine ? el("button", {
            type: "button",
            class: "id-upcoming-cancel",
            title: "Avbryt reservasjon",
            "aria-label": "Avbryt reservasjon",
            textContent: "×",
            onclick: () => onCancelFuture(row),
          }) : null,
        ])
      );
    }
  }

  function renderActions(st) {
    clear(actionsBar);
    const me = getCurrentHouse();
    if (!me) {
      actionsBar.append(button("Velg husnummer", "confirm", () => onChangeHouse && onChangeHouse()));
      return;
    }
    if (st.status === "in_use") {
      if (st.holder === me) actionsBar.append(button("Lever tilbake", "confirm", returnNow));
      actionsBar.append(button("Reserver", "default", openPicker));
    } else if (st.status === "reserved") {
      if (st.holder === me) actionsBar.append(button("Bruk nå", "confirm", useNow));
      actionsBar.append(button("Reserver", "default", openPicker));
    } else {
      actionsBar.append(
        button("Bruk nå", "confirm", useNow),
        button("Reserver", "default", openPicker),
      );
    }
  }

  function button(text, variant, onclick) {
    return createButton({ label: text, variant, onClick: onclick }).root;
  }

  // ---- Action handlers ---------------------------------------------------
  async function useNow() {
    const me = getCurrentHouse();
    if (!me) return;
    try { await useItem(currentItem.slug, me); await refreshHistory(); }
    catch (err) { handleErr(err); }
  }

  async function returnNow() {
    try {
      const ok = await endActive(currentItem.slug);
      if (!ok) toast("Ingen aktiv bruk å avslutte.", { kind: "error" });
      await refreshHistory();
    } catch (err) { handleErr(err); }
  }

  async function onCancelFuture(row) {
    const ok = await confirmDialog({
      title: "Avbryt reservasjon?",
      message: `Reservasjonen til ${row.house} (${formatBlock(row.period_from, row.period_to)}) blir slettet.`,
      confirmLabel: "Avbryt reservasjon",
      cancelLabel: "Behold",
      danger: true,
    });
    if (!ok) return;
    try {
      await cancelReservation(row.id);
      toast("Reservasjonen er avbrutt.", { kind: "success" });
    } catch (err) { handleErr(err); }
  }

  function handleErr(err) {
    console.warn(err);
    toast(friendlyError(err), { kind: "error", duration: 8000 });
  }

  // ---- Reservation flow --------------------------------------------------
  function openPicker() {
    dayPicker.reset();
    pickerWrap.hidden = false;
  }
  function hidePicker() {
    pickerWrap.hidden = true;
  }

  async function confirmReserve({ blocks, cancelRowIds }) {
    const me = getCurrentHouse();
    if (!me) { toast("Velg husnummer først.", { kind: "error" }); return; }
    hidePicker();
    try {
      for (const id of cancelRowIds) await cancelReservation(id);
      if (blocks.length > 0) await reserveBlocks(currentItem.slug, me, blocks);
      const parts = [];
      if (blocks.length > 0) parts.push("Reservasjon lagret");
      if (cancelRowIds.length > 0) parts.push(`${cancelRowIds.length} reservasjon${cancelRowIds.length === 1 ? "" : "er"} avbrutt`);
      toast(parts.join(" · ") + ".", { kind: "success" });
    } catch (err) { handleErr(err); }
  }

  async function refreshLastUsed() {
    if (!currentItem) return;
    const slug = currentItem.slug;
    const rows = await getRecentHistory(slug, 14, 1);
    // Bail if the user opened a different item before the request resolved.
    if (!currentItem || currentItem.slug !== slug) return;
    const last = rows[0];
    if (!last) {
      lastUsedEl.hidden = true;
      lastUsedEl.textContent = "";
      return;
    }
    lastUsedEl.hidden = false;
    lastUsedEl.replaceChildren(
      el("span", { class: "id-last-used-label", textContent: "Sist brukt: " }),
      el("strong", { class: "id-last-used-house", textContent: last.house || "?" }),
      el("span", { class: "id-last-used-when", textContent: formatWhen(last.period_to) }),
    );
  }

  async function refreshHistory() {
    if (!currentItem) return;
    // Public "Sist brukt" line \u2014 always shown when there is a past entry within
    // the last 14 days, regardless of edit mode.
    await refreshLastUsed();
    if (!showHistory) return;
    const rows = await getHistory(currentItem.slug, 10);
    clear(historyList);
    if (rows.length === 0) {
      historyList.appendChild(el("li", { class: "id-history-empty", textContent: "Ingen historikk ennå." }));
      return;
    }
    for (const row of rows) {
      historyList.appendChild(
        el("li", { class: "id-history-item" }, [
          el("strong", { textContent: row.house || "?" }),
          el("span", { class: "id-history-action", textContent: " brukte " + formatBlock(row.period_from, row.period_to) }),
          el("span", { class: "id-history-when", textContent: formatWhen(row.period_to) }),
          allowHistoryDelete ? el("button", {
            type: "button",
            class: "id-history-delete",
            title: "Slett oppføring",
            "aria-label": "Slett oppføring",
            textContent: "×",
            onclick: () => onDeleteHistory(row),
          }) : null,
        ])
      );
    }
  }

  async function onDeleteHistory(row) {
    const ok = await confirmDialog({
      title: "Slett historikkoppføring?",
      message: `${row.house || "?"} — ${formatBlock(row.period_from, row.period_to)}. Dette kan ikke angres.`,
      confirmLabel: "Slett",
      cancelLabel: "Avbryt",
      danger: true,
    });
    if (!ok) return;
    try {
      await cancelReservation(row.id);
      toast("Oppføringen er slettet.", { kind: "success" });
      await refreshHistory();
    } catch (err) { handleErr(err); }
  }

  // ---- Public ------------------------------------------------------------
  function open(item) {
    currentItem = item;
    titleEl.textContent = item.name;
    descEl.textContent = item.description || "";
    descEl.hidden = !item.description;
    clear(tagsEl);
    for (const t of item.tags || []) {
      tagsEl.appendChild(el("span", { class: "card-tag", textContent: t }));
    }
    const src = item.image || item.imageThumb;
    if (src) {
      imageEl.src = src;
      imageEl.alt = item.name;
      imageWrap.style.cursor = "zoom-in";
    } else {
      imageEl.removeAttribute("src");
      imageWrap.style.cursor = "default";
    }
    historyList.replaceChildren(el("li", { class: "id-history-empty", textContent: "Laster…", hidden: !showHistory }));
    hidePicker();

    renderState();
    refreshHistory();

    if (unsubscribeState) unsubscribeState();
    unsubscribeState = subscribeState(() => { if (currentItem) renderState(); });
    if (unsubscribeHouse) unsubscribeHouse();
    unsubscribeHouse = subscribeCurrentHouse(() => { if (currentItem) renderState(); });

    backdrop.hidden = false;
    document.body.classList.add("id-open");
  }

  function close() {
    backdrop.hidden = true;
    document.body.classList.remove("id-open");
    currentItem = null;
    hidePicker();
    if (unsubscribeState) { unsubscribeState(); unsubscribeState = null; }
    if (unsubscribeHouse) { unsubscribeHouse(); unsubscribeHouse = null; }
  }

  return { open, close };
}

// Build a Map<dayMs, { house, rowId, mine }> for the next 14 days.
function upcomingReservedDays(slug, me) {
  const out = new Map();
  const today = startOfDayMs();
  const horizon = today + 14 * DAY_MS;
  for (const r of getUpcoming(slug)) {
    const start = startOfDayMs(new Date(r.period_from));
    const end = r.period_to ? startOfDayMs(new Date(r.period_to)) : start;
    for (let d = Math.max(start, today); d <= Math.min(end, horizon - 1); d += DAY_MS) {
      if (!out.has(d)) out.set(d, { house: r.house, rowId: r.id, mine: r.house === me });
    }
  }
  return out;
}
