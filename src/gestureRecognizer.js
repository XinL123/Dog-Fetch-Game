import { clamp, magnitude, normalize } from "./sceneMapping.js";

const DEFAULTS = {
  readyMinMs: 180,
  readyMaxMovement: 0.09,
  minSwingSpeed: 0.42,
  minReleaseProgress: 0.14,
  consecutiveSwingFrames: 2,
  cooldownMs: 1600,
  historyMs: 900,
};

function getSample(samples, mode) {
  const candidates = [];
  if ((mode === "auto" || mode === "left") && samples.left) candidates.push(samples.left);
  if ((mode === "auto" || mode === "right") && samples.right) candidates.push(samples.right);
  if (!candidates.length) return null;
  return candidates.sort((a, b) => (b.quality || 0) - (a.quality || 0))[0];
}

function point(sample) {
  return sample?.relWrist || sample?.rel || sample?.wrist || null;
}

function distance(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function createGestureRecognizer(options = {}) {
  const config = { ...DEFAULTS, ...options };
  const history = { left: [], right: [] };
  let state = "No Body";
  let readyPoint = null;
  let readyAt = 0;
  let swingFrames = 0;
  let lastFireAt = -Infinity;

  function resetToVisible(sample, now) {
    state = "Arm Visible";
    readyPoint = point(sample);
    readyAt = now;
    swingFrames = 0;
  }

  function update(samples, powerScale = 1, handMode = "auto") {
    const sample = getSample(samples, handMode);
    if (!sample) {
      state = "No Body";
      readyPoint = null;
      swingFrames = 0;
      return { phase: state, shouldFire: false, score: 0, debug: "No visible arm" };
    }

    const now = sample.t;
    const current = point(sample);
    const sideHistory = history[sample.side];
    sideHistory.push(sample);
    history[sample.side] = sideHistory.filter((item) => now - item.t <= config.historyMs);

    if (now - lastFireAt < config.cooldownMs) {
      return { phase: "Cooldown", shouldFire: false, score: 0, side: sample.side, debug: "Waiting for dog to return" };
    }

    if (!readyPoint || state === "No Body") resetToVisible(sample, now);

    const readyDrift = distance(current, readyPoint);
    const heldReady = now - readyAt >= config.readyMinMs && readyDrift <= config.readyMaxMovement;

    if (state === "Arm Visible" && heldReady) {
      state = "Ready Hold";
    }

    if (state === "Arm Visible" && readyDrift > config.readyMaxMovement * 1.8) {
      resetToVisible(sample, now);
      return { phase: "Arm Visible", shouldFire: false, score: 12, side: sample.side, debug: "Finding stable ready position" };
    }

    if (state !== "Ready Hold" && state !== "Swing Detected") {
      return { phase: state, shouldFire: false, score: heldReady ? 35 : 18, side: sample.side, debug: "Hold arm briefly before throwing" };
    }

    const hist = history[sample.side];
    const prev = [...hist].reverse().find((item) => now - item.t >= 90) || hist[0] || sample;
    const prevPoint = point(prev);
    const dt = Math.max(0.001, (now - prev.t) / 1000);
    const velocity = { x: (current.x - prevPoint.x) / dt, y: (current.y - prevPoint.y) / dt };
    const speed = magnitude(velocity);
    const direction = normalize(velocity);
    const throwVector = { x: current.x - readyPoint.x, y: current.y - readyPoint.y };
    const aimDirection = normalize(throwVector);
    const progress = magnitude(throwVector);
    const purposefulAim = progress >= config.minReleaseProgress;
    const validDirection = purposefulAim;
    const validSwing = speed >= config.minSwingSpeed && progress >= config.minReleaseProgress && validDirection;

    if (validSwing) {
      swingFrames += 1;
      state = "Swing Detected";
    } else if (state === "Swing Detected") {
      swingFrames = Math.max(0, swingFrames - 1);
    }

    const shouldFire = swingFrames >= config.consecutiveSwingFrames;
    const score = Math.round(clamp(30 + speed * 32 + progress * 80 + swingFrames * 12, 0, 100));

    if (shouldFire) {
      lastFireAt = now;
      state = "Release Confirmed";
      const power = clamp((0.35 + speed * 0.28 + progress * 1.25) * powerScale, 0.45, 1.9);
      const result = { phase: state, shouldFire: true, side: sample.side, score, speed, progress, direction, aimDirection, power, debug: "Throw released" };
      readyPoint = null;
      swingFrames = 0;
      return result;
    }

    return { phase: state, shouldFire: false, side: sample.side, score, speed, progress, direction, aimDirection, debug: validDirection ? "Swing faster" : "Throw left, right, or forward" };
  }

  return { update };
}
