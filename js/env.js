// Edit mode is enabled only when the page is served locally so visitors
// on the public site never see edit controls.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", ""]);

export function isLocal() {
  const { protocol, hostname } = window.location;
  if (protocol === "file:") return true;
  return LOCAL_HOSTS.has(hostname);
}
