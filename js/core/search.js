// Pure filtering logic — no DOM.

export function filterItems(items, { query = "", tag = null } = {}) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items
    .filter((item) => matchesTag(item, tag) && matchesTerms(item, terms))
    .sort((a, b) => a.name.localeCompare(b.name, "no"));
}

function matchesTag(item, tag) {
  if (!tag) return true;
  return item.tags.includes(tag);
}

function matchesTerms(item, terms) {
  if (terms.length === 0) return true;
  const haystack = [item.name, item.description, ...item.tags].join(" ").toLowerCase();
  return terms.every((t) => haystack.includes(t));
}
