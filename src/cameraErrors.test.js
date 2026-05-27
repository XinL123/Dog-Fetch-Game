import test from "node:test";
import assert from "node:assert/strict";
import { getCameraErrorMessage } from "./cameraErrors.js";

test("explains camera permission denial with an actionable browser fallback", () => {
  const message = getCameraErrorMessage({ name: "NotAllowedError", message: "Permission denied" });
  assert.match(message, /Camera permission was denied/);
  assert.match(message, /Chrome or Safari/);
  assert.match(message, /http:\/\/127\.0\.0\.1:5173/);
});

test("keeps unknown camera errors visible", () => {
  const message = getCameraErrorMessage({ name: "OverconstrainedError", message: "No matching camera" });
  assert.match(message, /No matching camera/);
});
