const LOCAL_PREVIEW_URL = "http://127.0.0.1:5173/";

export function getCameraErrorMessage(error) {
  const raw = error?.message || String(error || "Unknown camera error");
  const name = error?.name || "";
  const denied = name === "NotAllowedError" || /permission denied|notallowed|denied/i.test(raw);

  if (denied) {
    return `Camera permission was denied. The Codex in-app browser may not have camera access; open ${LOCAL_PREVIEW_URL} in Chrome or Safari and choose Allow Camera.`;
  }

  return raw;
}
