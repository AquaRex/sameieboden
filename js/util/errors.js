// Map Supabase / network errors to user-friendly Norwegian messages.

export function friendlyError(err) {
  const msg = (err && (err.message || err.error_description || err.hint)) || "";
  const code = err && err.code;
  if (code === "42703" || /column .* does not exist/i.test(msg)) {
    return "Databasen mangler en kolonne. Kjør den nyeste SQL-migreringen i Supabase.";
  }
  if (code === "42P01" || /relation .* does not exist/i.test(msg)) {
    return "Databasetabellen finnes ikke ennå. Kjør oppsetts-SQL-en i Supabase.";
  }
  if (code === "PGRST301" || /jwt|permission|rls/i.test(msg)) {
    return "Manglende tilgang til databasen. Sjekk Row Level Security i Supabase.";
  }
  if (!navigator.onLine) {
    return "Du er offline. Endringer lagres ikke før du er tilkoblet igjen.";
  }
  if (/network|fetch|failed to fetch/i.test(msg)) {
    return "Får ikke kontakt med databasen. Sjekk internettforbindelsen.";
  }
  return msg ? `Kunne ikke lagre: ${msg}` : "Kunne ikke lagre. Prøv igjen.";
}
