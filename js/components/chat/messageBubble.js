// Single chat bubble. `kind` controls alignment & color:
//   "own"       — sent by current house (right-aligned, accent fill)
//   "incoming"  — sent to current house in a DM (left-aligned, surface fill)
//   "broadcast" — message in the "Alle hus" channel from someone else
//
// `showHouse` adds a small house tag above the bubble — used in the
// broadcast view to distinguish senders, hidden in DMs.

import { el } from "../../helpers/dom.js?v=1";
import { formatWhen } from "../../helpers/dates.js?v=1";

export function createMessageBubble(msg, { kind = "incoming", showHouse = false } = {}) {
  const cls = ["chat-bubble", `chat-bubble--${kind}`];

  const tag = showHouse && kind !== "own"
    ? el("span", { class: "chat-bubble-house", textContent: msg.from_house })
    : null;

  const body = el("p", { class: "chat-bubble-body", textContent: msg.body });

  const time = el("time", {
    class: "chat-bubble-time",
    datetime: msg.created_at,
    title: new Date(msg.created_at).toLocaleString("no-NO"),
    textContent: formatWhen(msg.created_at),
  });

  return el("div", { class: cls.join(" ") }, [tag, body, time]);
}
