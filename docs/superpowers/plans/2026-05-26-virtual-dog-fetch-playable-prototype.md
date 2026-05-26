# Virtual Dog Fetch Playable Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current camera-based virtual dog fetch prototype into a playable desktop-first web app with fewer false throws and a more convincing dog fetch loop.

**Architecture:** Copy the existing Vite app into the workspace, then isolate gesture detection and fetch behavior into pure JavaScript modules that can be tested without camera access. React remains responsible for camera setup, rendering, and user-facing controls.

**Tech Stack:** React, Vite, MediaPipe Pose, Framer Motion, Lucide React, Node built-in test runner.

---

## File Structure

- Create/Copy: `package.json`, `package-lock.json`, `index.html`, `vite.config.js`, `src/main.jsx`, `src/style.css`
- Create: `src/gestureRecognizer.js` for pose smoothing, throw phase transitions, and false-positive prevention.
- Create: `src/fetchStateMachine.js` for ball/dog fetch phases and pickup/drop behavior.
- Create: `src/sceneMapping.js` for converting throw vectors into screen targets.
- Create: `src/gestureRecognizer.test.js`, `src/fetchStateMachine.test.js`, `src/sceneMapping.test.js`
- Modify: `src/main.jsx` to consume pure modules and present a player-facing UI.
- Modify: `src/style.css` for desktop-first playable layout and responsive cleanup.
- Modify: `package.json` to add a `test` script using Node's built-in test runner.

## Task 1: Bring Existing Prototype Into Workspace

**Files:**
- Copy from: `/Users/Xin.L/Downloads/virtual-dog-fetch-perspective-v8-v3-model-precise-fetch 2/`
- Create: `/Users/Xin.L/Documents/playground/package.json`
- Create: `/Users/Xin.L/Documents/playground/package-lock.json`
- Create: `/Users/Xin.L/Documents/playground/index.html`
- Create: `/Users/Xin.L/Documents/playground/vite.config.js`
- Create: `/Users/Xin.L/Documents/playground/src/main.jsx`
- Create: `/Users/Xin.L/Documents/playground/src/style.css`

- [ ] **Step 1: Copy the current app into the repository**

Run:

```bash
cp -R "/Users/Xin.L/Downloads/virtual-dog-fetch-perspective-v8-v3-model-precise-fetch 2/index.html" .
cp -R "/Users/Xin.L/Downloads/virtual-dog-fetch-perspective-v8-v3-model-precise-fetch 2/package.json" .
cp -R "/Users/Xin.L/Downloads/virtual-dog-fetch-perspective-v8-v3-model-precise-fetch 2/package-lock.json" .
cp -R "/Users/Xin.L/Downloads/virtual-dog-fetch-perspective-v8-v3-model-precise-fetch 2/vite.config.js" .
cp -R "/Users/Xin.L/Downloads/virtual-dog-fetch-perspective-v8-v3-model-precise-fetch 2/src" .
```

Expected: project files exist under `/Users/Xin.L/Documents/playground`.

- [ ] **Step 2: Add Node test script**

Modify `package.json` scripts to include:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --test"
  }
}
```

- [ ] **Step 3: Verify baseline build**

Run:

```bash
npm run build
```

Expected: build succeeds and creates `dist/`.

- [ ] **Step 4: Commit baseline workspace copy**

Run:

```bash
git add index.html package.json package-lock.json vite.config.js src
git commit -m "chore: import virtual dog fetch prototype"
```

## Task 2: Add Scene Mapping Logic With Tests

**Files:**
- Create: `src/sceneMapping.js`
- Create: `src/sceneMapping.test.js`

- [ ] **Step 1: Write failing scene mapping tests**

Create `src/sceneMapping.test.js`:

```js
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
  assert.ok(left.x >= 22);
  assert.ok(right.x <= 78);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/sceneMapping.test.js
```

Expected: FAIL because `src/sceneMapping.js` does not exist.

- [ ] **Step 3: Implement scene mapping**

Create `src/sceneMapping.js`:

```js
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function magnitude(point) {
  return Math.hypot(point?.x || 0, point?.y || 0);
}

export function normalize(point) {
  const length = magnitude(point) || 1;
  return { x: (point?.x || 0) / length, y: (point?.y || 0) / length };
}

export function mapThrowToTarget({ direction, power = 1 }) {
  const dir = normalize(direction || { x: 0, y: -1 });
  const throwPower = clamp(power, 0.45, 1.65);
  const x = clamp(50 + dir.x * 24, 22, 78);
  const y = clamp(36 - throwPower * 12 - Math.max(0, -dir.y) * 5, 14, 34);

  return {
    x,
    y,
    ballScale: clamp(0.62 - throwPower * 0.13, 0.34, 0.56),
    dogScale: clamp(0.72 - throwPower * 0.09, 0.48, 0.68),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/sceneMapping.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit scene mapping**

Run:

```bash
git add src/sceneMapping.js src/sceneMapping.test.js
git commit -m "feat: add throw scene mapping"
```

## Task 3: Add Gesture Recognizer With False-Positive Tests

**Files:**
- Create: `src/gestureRecognizer.js`
- Create: `src/gestureRecognizer.test.js`

- [ ] **Step 1: Write failing gesture recognizer tests**

Create `src/gestureRecognizer.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/gestureRecognizer.test.js
```

Expected: FAIL because `src/gestureRecognizer.js` does not exist.

- [ ] **Step 3: Implement gesture recognizer**

Create `src/gestureRecognizer.js`:

```js
import { clamp, magnitude, normalize } from "./sceneMapping.js";

const DEFAULTS = {
  readyMinMs: 300,
  readyMaxMovement: 0.055,
  minSwingSpeed: 0.62,
  minReleaseProgress: 0.2,
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
    const progress = distance(current, readyPoint);
    const validDirection = direction.y < -0.38 && Math.abs(direction.x) < 0.92;
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
      const power = clamp((speed * 0.55 + progress * 2.2) * powerScale, 0.5, 1.6);
      const result = { phase: state, shouldFire: true, side: sample.side, score, speed, progress, direction, power, debug: "Throw released" };
      readyPoint = null;
      swingFrames = 0;
      return result;
    }

    return { phase: state, shouldFire: false, side: sample.side, score, speed, progress, direction, debug: validDirection ? "Swing faster" : "Throw forward and upward" };
  }

  return { update };
}
```

- [ ] **Step 4: Run gesture tests**

Run:

```bash
npm test -- src/gestureRecognizer.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit gesture recognizer**

Run:

```bash
git add src/gestureRecognizer.js src/gestureRecognizer.test.js
git commit -m "feat: add natural throw recognizer"
```

## Task 4: Add Fetch State Machine With Tests

**Files:**
- Create: `src/fetchStateMachine.js`
- Create: `src/fetchStateMachine.test.js`

- [ ] **Step 1: Write failing fetch tests**

Create `src/fetchStateMachine.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/fetchStateMachine.test.js
```

Expected: FAIL because `src/fetchStateMachine.js` does not exist.

- [ ] **Step 3: Implement fetch state machine**

Create `src/fetchStateMachine.js`:

```js
export const FETCH_PHASE = {
  WAITING: "Waiting",
  BALL_FLYING: "Ball Flying",
  LOCATE_BALL: "Locate Ball",
  RUN_TO_BALL: "Run To Ball",
  PICK_UP_BALL: "Pick Up Ball",
  RETURN_TO_USER: "Return To User",
  DROP_BALL: "Drop Ball",
};

const HOME_BALL = { x: 32, y: 76, scale: 1, visible: true, carried: false, target: null };
const HOME_DOG = { x: 18, y: 80, scale: 1, target: null, carrying: false };

export function createInitialFetchState() {
  return {
    phase: FETCH_PHASE.WAITING,
    startedAt: 0,
    fetches: 0,
    ball: { ...HOME_BALL },
    dog: { ...HOME_DOG },
  };
}

export function updateFetchState(state, event) {
  if (event.type === "RESET") return createInitialFetchState();

  if (event.type === "THROW" && state.phase === FETCH_PHASE.WAITING) {
    const target = event.target;
    return {
      ...state,
      phase: FETCH_PHASE.BALL_FLYING,
      startedAt: event.now,
      ball: { x: target.x, y: target.y, scale: target.ballScale, visible: true, carried: false, target },
      dog: { ...state.dog, target: { x: target.x - 4, y: target.y + 1, scale: target.dogScale }, carrying: false },
    };
  }

  if (event.type !== "TICK") return state;

  const elapsed = event.now - state.startedAt;

  if (state.phase === FETCH_PHASE.BALL_FLYING && elapsed >= 700) {
    return { ...state, phase: FETCH_PHASE.LOCATE_BALL };
  }

  if (state.phase === FETCH_PHASE.LOCATE_BALL && elapsed >= 1100) {
    return {
      ...state,
      phase: FETCH_PHASE.RUN_TO_BALL,
      dog: { ...state.dog, x: state.dog.target.x, y: state.dog.target.y, scale: state.dog.target.scale },
    };
  }

  if ((state.phase === FETCH_PHASE.RUN_TO_BALL || state.phase === FETCH_PHASE.LOCATE_BALL || state.phase === FETCH_PHASE.BALL_FLYING) && elapsed >= 2400) {
    return {
      ...state,
      phase: FETCH_PHASE.PICK_UP_BALL,
      ball: { ...state.ball, visible: false, carried: true },
      dog: { ...state.dog, x: state.dog.target.x, y: state.dog.target.y, scale: state.dog.target.scale, carrying: true },
    };
  }

  if (state.phase === FETCH_PHASE.PICK_UP_BALL && elapsed >= 3300) {
    return {
      ...state,
      phase: FETCH_PHASE.RETURN_TO_USER,
      dog: { ...HOME_DOG, carrying: true },
      ball: { ...state.ball, visible: false, carried: true },
    };
  }

  if (state.phase === FETCH_PHASE.RETURN_TO_USER && elapsed >= 4700) {
    return {
      ...state,
      phase: FETCH_PHASE.DROP_BALL,
      fetches: state.fetches + 1,
      dog: { ...HOME_DOG },
      ball: { ...HOME_BALL, visible: true },
    };
  }

  if (state.phase === FETCH_PHASE.DROP_BALL && elapsed >= 5600) {
    return { ...state, phase: FETCH_PHASE.WAITING, startedAt: event.now, ball: { ...HOME_BALL }, dog: { ...HOME_DOG } };
  }

  return state;
}
```

- [ ] **Step 4: Run fetch tests**

Run:

```bash
npm test -- src/fetchStateMachine.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit fetch state machine**

Run:

```bash
git add src/fetchStateMachine.js src/fetchStateMachine.test.js
git commit -m "feat: add fetch state machine"
```

## Task 5: Connect Pure Logic To React App

**Files:**
- Modify: `src/main.jsx`

- [ ] **Step 1: Add imports**

Modify the top of `src/main.jsx`:

```js
import { createGestureRecognizer } from "./gestureRecognizer.js";
import { createInitialFetchState, updateFetchState, FETCH_PHASE } from "./fetchStateMachine.js";
import { mapThrowToTarget } from "./sceneMapping.js";
```

- [ ] **Step 2: Replace timer-based fetch state with reducer-style state**

Add refs/state in `App`:

```js
const gestureRef = useRef(createGestureRecognizer());
const fetchStateRef = useRef(createInitialFetchState());
const [fetchState, setFetchState] = useState(createInitialFetchState);
```

Derive visual state:

```js
const ball = fetchState.ball;
const dog = fetchState.dog;
const fetches = fetchState.fetches;
const gamePhase = fetchState.phase;
```

- [ ] **Step 3: Replace `evaluateAll` trigger path with natural recognizer**

Inside `detectFrame`, after `latestRef.current = { left, right };`, call:

```js
const gesture = gestureRef.current.update({ left, right }, 1, activeProfile?.handMode || "auto");
setConfidence(gesture.score || 0);
setPhase(gesture.phase);
setDebug(gesture.debug || "");

if (playingRef.current && gesture.shouldFire && fetchStateRef.current.phase === FETCH_PHASE.WAITING) {
  const target = mapThrowToTarget({ direction: gesture.direction, power: gesture.power });
  const next = updateFetchState(fetchStateRef.current, { type: "THROW", target, now: performance.now() });
  fetchStateRef.current = next;
  setFetchState(next);
}
```

Keep old calibration functions available in advanced UI, but the main play loop should not depend on `evaluateAll`.

- [ ] **Step 4: Add fetch ticking**

Add an effect:

```js
useEffect(() => {
  if (!playing) return undefined;
  let frame = 0;
  const tick = () => {
    const next = updateFetchState(fetchStateRef.current, { type: "TICK", now: performance.now() });
    if (next !== fetchStateRef.current) {
      fetchStateRef.current = next;
      setFetchState(next);
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}, [playing]);
```

- [ ] **Step 5: Update reset logic**

Replace timer clearing in `resetScene` with:

```js
const next = createInitialFetchState();
fetchStateRef.current = next;
setFetchState(next);
gestureRef.current = createGestureRecognizer();
setConfidence(0);
setPhase("Ready");
setDebug("Step into view, hold your arm briefly, then throw naturally.");
```

- [ ] **Step 6: Run full tests and build**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and build succeeds.

- [ ] **Step 7: Commit React integration**

Run:

```bash
git add src/main.jsx
git commit -m "feat: connect natural throw and fetch logic"
```

## Task 6: Improve Player-Facing UI

**Files:**
- Modify: `src/main.jsx`
- Modify: `src/style.css`

- [ ] **Step 1: Make primary status player-facing**

Change top metric labels to:

```jsx
<div className="metric-card"><span>Motion</span><strong>{confidence}</strong></div>
<div className="metric-card"><span>Status</span><strong>{phase}</strong></div>
<div className="metric-card"><span>Fetches</span><strong>{fetches}</strong></div>
```

- [ ] **Step 2: Rename brand and remove version-heavy copy**

Change brand text to:

```jsx
<div className="brand-pill"><DogIcon size={16} />Indoor Fetch</div>
```

Remove the visible `version-watermark` element from the render.

- [ ] **Step 3: Move calibration tools behind advanced details**

Wrap calibration/import/profile controls:

```jsx
<details className="advanced-panel">
  <summary>Advanced setup</summary>
  {/* existing participant, hand mode, ready/release, import/export controls */}
</details>
```

Keep main controls visible:

```jsx
<div className="row four primary-controls">
  {/* camera, play/pause, test throw, reset */}
</div>
```

- [ ] **Step 4: Add visual dog carrying state**

Pass carrying from fetch state:

```jsx
<RealisticDog running={gamePhase === FETCH_PHASE.RUN_TO_BALL || gamePhase === FETCH_PHASE.RETURN_TO_USER} carrying={dog.carrying} />
```

- [ ] **Step 5: Polish CSS for player controls**

Add CSS:

```css
.primary-controls button {
  min-height: 48px;
  border-radius: 12px;
}

.advanced-panel {
  margin-top: 12px;
}

.advanced-panel summary {
  cursor: pointer;
  font-weight: 800;
  color: rgba(0,0,0,.72);
  min-height: 40px;
  display: flex;
  align-items: center;
}

.version-watermark {
  display: none;
}
```

- [ ] **Step 6: Run build**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 7: Commit UI pass**

Run:

```bash
git add src/main.jsx src/style.css
git commit -m "feat: polish playable fetch interface"
```

## Task 7: Start Preview And Manual Verification

**Files:**
- No code files unless verification reveals defects.

- [ ] **Step 1: Start Vite dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL such as `http://127.0.0.1:5173/`.

- [ ] **Step 2: Open the local URL through the in-app browser if available**

Use the Browser plugin for the local URL. Expected: the app renders without a blank screen.

- [ ] **Step 3: Verify static UI**

Check:

- Start Camera button is visible.
- Start Playing button is visible.
- Camera preview area is visible.
- Top metrics do not overlap.
- Advanced setup is collapsed by default.

- [ ] **Step 4: Verify no false throw while idle**

With camera running:

- Stand still for 10 seconds.
- Slowly reposition arm.
- Wave slowly near body.

Expected: `Fetches` remains unchanged and ball does not launch.

- [ ] **Step 5: Verify natural throw loop**

With camera running and playing:

- Hold arm briefly.
- Make a natural forward/upward toss.

Expected:

- Status reaches `Release Confirmed`.
- Ball flies to a target.
- Dog runs to that target.
- Dog carries the ball back.
- Fetch count increments after return.
- App returns to waiting for the next throw.

- [ ] **Step 6: Fix any verification defects using TDD when logic-related**

If a defect is in `gestureRecognizer`, `fetchStateMachine`, or `sceneMapping`, first add a failing test that reproduces it, then implement the fix.

- [ ] **Step 7: Final verification**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and build succeeds.

- [ ] **Step 8: Commit verification fixes**

If fixes were needed:

```bash
git add src
git commit -m "fix: stabilize playable fetch verification"
```

If no fixes were needed, do not create an empty commit.
