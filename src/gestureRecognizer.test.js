import test from "node:test";
import assert from "node:assert/strict";
import { createGestureRecognizer } from "./gestureRecognizer.js";

function sample(t, x, y, quality = 3) {
  return {
    t,
    side: "right",
    wrist: { x, y },
    relWrist: { x, y },
    rel: { x, y },
    quality,
  };
}

test("does not fire from small ready-zone jitter", () => {
  const recognizer = createGestureRecognizer();
  const frames = [
    sample(0, 0.1, 0.2),
    sample(120, 0.11, 0.2),
    sample(260, 0.1, 0.21),
    sample(420, 0.12, 0.2),
    sample(580, 0.11, 0.19),
  ];
  const results = frames.map((frame) => recognizer.update({ right: frame, left: null }, 1));
  assert.equal(results.some((result) => result.shouldFire), false);
});

test("does not fire from a single-frame spike", () => {
  const recognizer = createGestureRecognizer();
  const frames = [
    sample(0, 0.1, 0.2),
    sample(160, 0.1, 0.2),
    sample(320, 0.1, 0.2),
    sample(480, 0.55, -0.24),
    sample(640, 0.11, 0.2),
  ];
  const results = frames.map((frame) => recognizer.update({ right: frame, left: null }, 1));
  assert.equal(results.some((result) => result.shouldFire), false);
});

test("fires after ready hold plus sustained forward upward acceleration", () => {
  const recognizer = createGestureRecognizer();
  const frames = [
    sample(0, 0.1, 0.23),
    sample(180, 0.1, 0.22),
    sample(360, 0.1, 0.22),
    sample(520, 0.16, 0.1),
    sample(620, 0.24, -0.02),
    sample(720, 0.35, -0.16),
  ];
  const results = frames.map((frame) => recognizer.update({ right: frame, left: null }, 1));
  const fire = results.find((result) => result.shouldFire);
  assert.ok(fire);
  assert.equal(fire.phase, "Release Confirmed");
  assert.ok(fire.power > 0.6);
});

test("cooldown blocks repeated throws", () => {
  const recognizer = createGestureRecognizer({ cooldownMs: 1500 });
  const first = [
    sample(0, 0.1, 0.23),
    sample(180, 0.1, 0.22),
    sample(360, 0.1, 0.22),
    sample(520, 0.16, 0.1),
    sample(620, 0.24, -0.02),
    sample(720, 0.35, -0.16),
  ];
  const second = [
    sample(900, 0.1, 0.23),
    sample(1040, 0.1, 0.22),
    sample(1180, 0.2, 0.02),
    sample(1300, 0.34, -0.18),
  ];
  const firstResults = first.map((frame) => recognizer.update({ right: frame, left: null }, 1));
  const secondResults = second.map((frame) => recognizer.update({ right: frame, left: null }, 1));
  assert.equal(firstResults.some((result) => result.shouldFire), true);
  assert.equal(secondResults.some((result) => result.shouldFire), false);
});
