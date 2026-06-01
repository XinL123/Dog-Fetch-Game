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

test("returns left and right aim from the full throw displacement", () => {
  const leftRecognizer = createGestureRecognizer();
  const rightRecognizer = createGestureRecognizer();
  const leftFrames = [
    sample(0, 0.1, 0.23),
    sample(180, 0.1, 0.22),
    sample(360, 0.1, 0.22),
    sample(520, 0.02, 0.1),
    sample(620, -0.08, -0.02),
    sample(720, -0.22, -0.16),
  ];
  const rightFrames = [
    sample(0, 0.1, 0.23),
    sample(180, 0.1, 0.22),
    sample(360, 0.1, 0.22),
    sample(520, 0.18, 0.1),
    sample(620, 0.3, -0.02),
    sample(720, 0.46, -0.16),
  ];

  const leftFire = leftFrames.map((frame) => leftRecognizer.update({ right: frame, left: null }, 1)).find((result) => result.shouldFire);
  const rightFire = rightFrames.map((frame) => rightRecognizer.update({ right: frame, left: null }, 1)).find((result) => result.shouldFire);

  assert.ok(leftFire.aimDirection.x < -0.35);
  assert.ok(rightFire.aimDirection.x > 0.35);
});

test("fires for a natural mostly-sideways toss with slight upward motion", () => {
  const recognizer = createGestureRecognizer();
  const frames = [
    sample(0, 0.1, 0.23),
    sample(180, 0.1, 0.22),
    sample(360, 0.1, 0.22),
    sample(500, 0.22, 0.2),
    sample(600, 0.38, 0.17),
    sample(700, 0.56, 0.13),
  ];
  const results = frames.map((frame) => recognizer.update({ right: frame, left: null }, 1));
  const fire = results.find((result) => result.shouldFire);
  assert.ok(fire);
  assert.ok(fire.aimDirection.x > 0.85);
});

test("fires for a natural downward side throw after a brief ready moment", () => {
  const recognizer = createGestureRecognizer();
  const frames = [
    sample(0, 0.1, 0.2),
    sample(120, 0.11, 0.2),
    sample(240, 0.11, 0.21),
    sample(380, 0.22, 0.27),
    sample(500, 0.38, 0.36),
    sample(620, 0.58, 0.45),
  ];
  const results = frames.map((frame) => recognizer.update({ right: frame, left: null }, 1));
  const fire = results.find((result) => result.shouldFire);
  assert.ok(fire);
  assert.ok(fire.aimDirection.x > 0.65);
});

test("returns more power for faster stronger arm swings", () => {
  const softRecognizer = createGestureRecognizer();
  const hardRecognizer = createGestureRecognizer();
  const softFrames = [
    sample(0, 0.1, 0.23),
    sample(180, 0.1, 0.22),
    sample(360, 0.1, 0.22),
    sample(540, 0.14, 0.13),
    sample(720, 0.19, 0.03),
    sample(900, 0.25, -0.08),
  ];
  const hardFrames = [
    sample(0, 0.1, 0.23),
    sample(180, 0.1, 0.22),
    sample(360, 0.1, 0.22),
    sample(500, 0.19, 0.07),
    sample(590, 0.33, -0.08),
    sample(680, 0.52, -0.26),
  ];

  const softFire = softFrames.map((frame) => softRecognizer.update({ right: frame, left: null }, 1)).find((result) => result.shouldFire);
  const hardFire = hardFrames.map((frame) => hardRecognizer.update({ right: frame, left: null }, 1)).find((result) => result.shouldFire);

  assert.ok(hardFire.power > softFire.power + 0.25);
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
