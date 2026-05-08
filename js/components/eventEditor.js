// Shared event editor — modal dialog used by both the calendar view and the
// admin page. Encapsulates the form layout, validation, time pickers,
// "Hele dagen" + "Felles" toggles, optional house selector and date input.
//
// Usage:
//   const editor = createEventEditor({
//     showHouse: true,           // include house dropdown
//     showDate: true,            // include a date input
//     houses: HOUSES,            // required if showHouse
//     fellesHouse: "Sameiet",    // value used when "Felles" is checked
//     getDefaultHouse: () => me, // used when showHouse=false (calendar)
//     onSubmit: async ({ mode, id, data }) => { ... },
//     onAfterSubmit: () => reload(),
//   });
//   editor.open({ event: null, dateIso: "2025-12-31" }); // create
//   editor.open({ event: existingEv });                  // edit
//   editor.close();

import { el, clear } from "../dom.js?v=3";
import { createButton } from "./button.js?v=1";
import { createTimePicker } from "./timePicker.js?v=3";
import { createDropdown } from "./dropdown.js?v=1";

function parseDateOnly(iso) {
  if (!iso) return Date.now();
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

function formatNiceDate(iso) {
  const ts = parseDateOnly(iso);
  const txt = new Date(ts).toLocaleDateString("no-NO", {
    weekday: "long", day: "numeric", month: "long",
  });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export function createEventEditor({
  showHouse = false,
  showDate = false,
  houses = [],
  fellesHouse = "Sameiet",
  getDefaultHouse = () => null,
  onSubmit,
  onAfterSubmit = () => {},
} = {}) {
  // ---- Form fields ------------------------------------------------------
  const titleEl = el("h3", { class: "cal-form-title" });
  const dateLabelEl = el("p", { class: "cal-form-date" });

  const houseDropdown = showHouse ? createDropdown({
    options: houses.map((h) => ({ value: h, label: h })),
    value: houses[0] || "",
    onChange: () => {},
  }) : null;

  const dateInput = showDate ? el("input", { type: "date" }) : null;

  const titleInput = el("input", { type: "text", maxLength: 80, placeholder: "F.eks. Dugnad" });
  const descInput = el("textarea", { rows: 3, maxLength: 500, placeholder: "Valgfri beskrivelse" });
  const fromPicker = createTimePicker({ value: "", minuteStep: 15, defaultTime: "12:00" });
  const toPicker = createTimePicker({ value: "", minuteStep: 15, defaultTime: "13:00" });
  const allDayCb = el("input", { type: "checkbox" });
  const fellesCb = el("input", { type: "checkbox" });

  allDayCb.addEventListener("change", () => {
    const off = allDayCb.checked;
    fromPicker.setDisabled(off);
    toPicker.setDisabled(off);
  });
  fellesCb.addEventListener("change", () => {
    if (houseDropdown) houseDropdown.setDisabled?.(fellesCb.checked);
  });

  const errorEl = el("p", { class: "ed-error", hidden: true });
  const actionsEl = el("div", { class: "cal-form-actions" });
  const closeBtn = el("button", {
    type: "button", class: "id-close", "aria-label": "Lukk",
    textContent: "×", onclick: () => close(),
  });

  // Build dialog children conditionally
  const fields = [closeBtn, titleEl];
  if (!showDate) fields.push(dateLabelEl); // calendar shows the fixed date as caption
  if (showHouse) {
    fields.push(el("label", { class: "ed-field" }, [
      el("span", { textContent: "Hus" }),
      houseDropdown.root,
    ]));
  }
  if (showDate) {
    fields.push(el("label", { class: "ed-field" }, [
      el("span", { textContent: "Dato" }),
      dateInput,
    ]));
  }
  fields.push(
    el("label", { class: "ed-field" }, [el("span", { textContent: "Tittel" }), titleInput]),
    el("label", { class: "ed-field" }, [el("span", { textContent: "Beskrivelse" }), descInput]),
    el("div", { class: "cal-form-time-row" }, [
      el("div", { class: "cal-form-toggles" }, [
        el("label", { class: "cal-form-time-toggle" }, [
          allDayCb, el("span", { textContent: "Hele dagen" }),
        ]),
        el("label", { class: "cal-form-time-toggle" }, [
          fellesCb, el("span", { textContent: "Felles (sameiet)" }),
        ]),
      ]),
      el("div", { class: "cal-form-time-pickers" }, [
        el("div", { class: "cal-form-time-col" }, [
          el("span", { textContent: "Fra" }), fromPicker.root,
        ]),
        el("div", { class: "cal-form-time-col" }, [
          el("span", { textContent: "Til" }), toPicker.root,
        ]),
      ]),
    ]),
    errorEl,
    actionsEl,
  );

  const dialog = el("div", { class: "id-dialog cal-form-dialog" }, fields);
  const backdrop = el("div", { class: "id-backdrop cal-form-backdrop", hidden: true }, [dialog]);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  document.body.appendChild(backdrop);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !backdrop.hidden) close();
  });

  let mode = "create";
  let editingId = null;

  function open({ event = null, dateIso = null } = {}) {
    mode = event ? "edit" : "create";
    editingId = event ? event.id : null;

    titleInput.value = event ? event.title || "" : "";
    descInput.value = event ? event.description || "" : "";

    const hasTimes = !!(event && (event.time_from || event.time_to));
    allDayCb.checked = event ? !hasTimes : false;
    fromPicker.setValue(event && event.time_from ? event.time_from : "");
    toPicker.setValue(event && event.time_to ? event.time_to : "");
    fromPicker.setDisabled(allDayCb.checked);
    toPicker.setDisabled(allDayCb.checked);

    const initialIsFelles = event ? event.house === fellesHouse : false;
    fellesCb.checked = initialIsFelles;

    if (showHouse && houseDropdown) {
      const h = event ? event.house : getDefaultHouse() || houses[0];
      houseDropdown.setValue(initialIsFelles ? (houses[0] || "") : (h || houses[0] || ""));
      houseDropdown.setDisabled?.(initialIsFelles);
    }

    if (showDate && dateInput) {
      dateInput.value = event ? event.event_date : (dateIso || new Date().toISOString().slice(0, 10));
    } else {
      const iso = event ? event.event_date : dateIso;
      if (iso) dateLabelEl.textContent = formatNiceDate(iso);
      dateLabelEl.dataset.iso = iso || "";
    }

    titleEl.textContent = event ? "Rediger hendelse" : "Ny hendelse";
    errorEl.hidden = true;
    errorEl.textContent = "";

    clear(actionsEl);
    actionsEl.appendChild(createButton({
      label: "Avbryt", variant: "cancel", onClick: () => close(),
    }).root);
    actionsEl.appendChild(createButton({
      label: event ? "Lagre" : "Opprett", variant: "confirm", onClick: () => submit(),
    }).root);

    backdrop.hidden = false;
    document.body.classList.add("id-open");
    setTimeout(() => titleInput.focus(), 0);
  }

  function close() {
    backdrop.hidden = true;
    editingId = null;
    document.body.classList.remove("id-open");
  }

  async function submit() {
    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    const allDay = allDayCb.checked;
    const time_from = allDay ? null : (fromPicker.getValue() || null);
    const time_to = allDay ? null : (toPicker.getValue() || null);
    const event_date = showDate
      ? (dateInput.value || null)
      : (dateLabelEl.dataset.iso || null);

    let house;
    if (fellesCb.checked) {
      house = fellesHouse;
    } else if (showHouse && houseDropdown) {
      house = houseDropdown.getValue();
    } else {
      house = getDefaultHouse();
    }

    if (!title) {
      errorEl.textContent = "Tittel er påkrevd.";
      errorEl.hidden = false;
      titleInput.focus();
      return;
    }
    if (!event_date) {
      errorEl.textContent = "Dato er påkrevd.";
      errorEl.hidden = false;
      return;
    }
    if (!house) {
      errorEl.textContent = "Velg bolig først.";
      errorEl.hidden = false;
      return;
    }
    if (time_from && time_to && time_to < time_from) {
      errorEl.textContent = "Sluttidspunkt må være etter starttidspunkt.";
      errorEl.hidden = false;
      return;
    }

    const data = { house, title, description, event_date, time_from, time_to };
    try {
      await onSubmit({ mode, id: editingId, data });
      close();
      onAfterSubmit();
    } catch (err) {
      errorEl.textContent = err && err.message ? err.message : String(err);
      errorEl.hidden = false;
    }
  }

  return { open, close };
}
