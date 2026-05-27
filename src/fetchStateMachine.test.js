import test from "node:test";
import assert from "node:assert/strict";
import { createInitialFetchState, updateFetchState } from "./fetchStateMachine.js";

const target = { x: 62, y: 22, ballScale: 0.42, dogScale: 0.56 };

test("starts ball flying from waiting state", () => {
  const state = createInitialFetchState();
  const next = updateFetchState(state, { type: "THROW", target, now: 100 });
  assert.equal(next.phase, "Ball Flying");
  assert.equal(next.ball.target.x, target.x);
  assert.equal(next.dog.target.x, target.x - 4);
  assert.equal(next.ball.carried, false);
});

test("does not pick up ball before dog reaches target", () => {
  const flying = updateFetchState(createInitialFetchState(), { type: "THROW", target, now: 100 });
  const locating = updateFetchState(flying, { type: "TICK", now: 900 });
  const running = updateFetchState(locating, { type: "TICK", now: 1500 });
  assert.equal(running.phase, "Run To Ball");
  assert.equal(running.ball.visible, true);
});

test("picks up ball only after dog reaches the ball target", () => {
  const flying = updateFetchState(createInitialFetchState(), { type: "THROW", target, now: 100 });
  const pickup = updateFetchState(flying, { type: "TICK", now: 2600 });
  assert.equal(pickup.phase, "Pick Up Ball");
  assert.equal(pickup.ball.visible, false);
  assert.equal(pickup.ball.carried, true);
});

test("return state carries ball with dog, then drop restores waiting", () => {
  let state = updateFetchState(createInitialFetchState(), { type: "THROW", target, now: 100 });
  state = updateFetchState(state, { type: "TICK", now: 3000 });
  state = updateFetchState(state, { type: "TICK", now: 3800 });
  assert.equal(state.phase, "Return To User");
  assert.equal(state.ball.carried, true);
  state = updateFetchState(state, { type: "TICK", now: 5200 });
  assert.equal(state.phase, "Drop Ball");
  state = updateFetchState(state, { type: "TICK", now: 6000 });
  assert.equal(state.phase, "Waiting");
  assert.equal(state.ball.visible, true);
  assert.equal(state.ball.carried, false);
});
