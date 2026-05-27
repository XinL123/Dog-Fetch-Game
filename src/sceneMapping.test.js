import test from "node:test";
import assert from "node:assert/strict";
import { clamp, mapThrowToTarget } from "./sceneMapping.js";

test("clamp keeps values within range", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});

test("mapThrowToTarget sends stronger throws deeper into the field", () => {
  const soft = mapThrowToTarget({ direction: { x: 0, y: -1 }, power: 0.6 });
  const strong = mapThrowToTarget({ direction: { x: 0, y: -1 }, power: 1.4 });
  assert.ok(strong.y < soft.y);
  assert.ok(strong.ballScale < soft.ballScale);
});

test("mapThrowToTarget uses lateral direction but keeps target in playable bounds", () => {
  const left = mapThrowToTarget({ direction: { x: -2, y: -1 }, power: 1 });
  const right = mapThrowToTarget({ direction: { x: 2, y: -1 }, power: 1 });
  assert.ok(left.x < right.x);
  assert.ok(right.x - left.x > 32);
  assert.ok(left.x >= 22);
  assert.ok(right.x <= 78);
});

test("mapThrowToTarget makes high power throws visibly farther than soft throws", () => {
  const soft = mapThrowToTarget({ direction: { x: 0, y: -1 }, power: 0.45 });
  const hard = mapThrowToTarget({ direction: { x: 0, y: -1 }, power: 1.85 });
  assert.ok(soft.y - hard.y >= 13);
});
