# Virtual Dog Fetch Playable Prototype Design

Date: 2026-05-26

## Goal

Build a playable desktop-first prototype for a camera-based virtual fetch game. The user naturally swings or tosses their arm as if throwing a ball. The screen shows a dog that reacts to that action, runs to the thrown ball, picks it up, brings it back, and waits for the next throw.

The product pain point is that people can enjoy a dog-fetch interaction indoors without needing outdoor space or owning a real dog.

## Primary User Experience

The first version prioritizes laptop and desktop play. The user opens the app, allows camera access, stands in view, and makes a natural one-handed throw. The app should not require repeated terminal commands to preview during development; it should run through a local dev server with a browser URL that stays open and updates as code changes.

The play loop is:

1. Dog waits near the user.
2. App confirms the arm is visible and ready.
3. User swings or tosses their hand naturally.
4. Ball flies in the matching direction with power based on the throw.
5. Dog watches the ball, runs to the target, picks it up, returns, drops it near the user, and waits again.

The UI should feel like a playable product rather than a calibration lab. Debugging remains available but should not dominate the first screen.

## Key Problems To Fix

The current prototype has two critical issues:

1. False throws: the ball can launch even when the user did not complete a real throwing motion.
2. Unconvincing fetch: the dog does not reliably use the ball target as its destination, so the dog does not feel like it truly finds, picks up, and returns the ball.

## Recommended Approach

Use a natural throwing state machine instead of relying only on saved ready/release calibration poses. Calibration can remain as an advanced fallback, but the default game should understand a natural motion sequence.

The action recognizer should evaluate multiple frames of wrist, elbow, and shoulder motion. A throw fires only when the full chain is satisfied:

```text
No Body
→ Arm Visible
→ Ready Hold
→ Swing Detected
→ Release Confirmed
→ Cooldown
→ Ready Hold
```

The fetch animation should use the ball target as the source of truth:

```text
Watching
→ Ball Flying
→ Locate Ball
→ Run To Ball
→ Pick Up Ball
→ Return To User
→ Drop Ball
→ Waiting
```

## Gesture Recognition Requirements

The app should support natural single-arm tosses, including both a forward throw and a short indoor upward/forward toss. It should not trigger from ordinary arm repositioning.

Recognition requirements:

- Require a visible shoulder, elbow, and wrist for the throwing arm.
- Smooth landmarks over a short rolling window to reduce camera jitter.
- Require a ready period before swing detection.
- Require wrist acceleration above a threshold.
- Require motion direction to be broadly forward/upward relative to the user-facing camera.
- Require progress over several consecutive frames rather than one-frame spikes.
- Add a cooldown after each throw so return animations cannot trigger another throw.
- Prefer the higher-confidence arm in auto mode, but allow left-only and right-only modes.

## Fetch Interaction Requirements

The dog must feel like it sees the same ball the user threw.

Fetch requirements:

- Compute one target point for the ball at release time.
- Animate the ball to that target with an arc and scale change.
- Keep the dog destination tied to the ball target.
- Do not enter the pickup state until the dog is visually close to the ball target.
- Attach the ball to the dog mouth while returning.
- Drop the ball back near the user before the next waiting state.
- Prevent the ball and dog from occupying contradictory positions.

## Interface Requirements

Desktop first:

- Large primary controls: Start Camera, Start Playing, Pause, Reset.
- Camera picture-in-picture remains visible but secondary.
- Clear status prompts: "Step into view", "Ready", "Swing", "Throw!", "Dog is fetching", "Throw again".
- Fetch count and recognition confidence can stay visible.
- Calibration, import/export, and raw debug should move into an advanced/settings area.

Responsive later:

- iPad and mobile should preserve the play loop.
- Controls should stack cleanly.
- Text and buttons must not overlap on small screens.

## Technical Design

Use the existing React, Vite, MediaPipe Pose, Framer Motion, and Lucide React stack.

Planned modules:

- `gestureRecognizer`: pure logic for landmark smoothing, phase transitions, throw scoring, and false-positive prevention.
- `fetchStateMachine`: pure logic for ball, dog, pickup, return, and cooldown phases.
- `sceneMapping`: converts throw direction and power into a field target.
- `App`: connects camera, model detection, UI state, and visual rendering.

The pure logic modules should be testable without camera access.

## Testing Strategy

Use test-driven development for the logic changes.

Initial tests:

- A throw does not fire when the wrist jitters near the ready zone.
- A throw does not fire from a single-frame spike.
- A throw fires after ready hold plus sustained wrist acceleration in a valid direction.
- A cooldown blocks repeated throws during the fetch animation.
- Dog pickup only occurs after the dog reaches the ball target.
- Returning state carries the ball with the dog.
- Drop state restores the ball near the user and returns to waiting.

Manual verification:

- Run the app through a local browser preview.
- Test with laptop camera on desktop viewport.
- Confirm no false throw while standing still, waving slowly, or adjusting posture.
- Confirm a natural toss launches the ball and completes a full fetch loop.

## Development Preview Requirement

During implementation, run the Vite dev server once and keep it open for hot reload. The user should be able to view the current app through a clickable local URL instead of repeatedly typing terminal commands. If the in-app browser preview is unreliable, provide the localhost URL as the fallback.

## Scope For This Iteration

In scope:

- Desktop-first playable prototype.
- More reliable natural throw detection.
- Convincing ball and dog fetch loop.
- Cleaner player-facing controls and status.
- Basic responsive cleanup.

Out of scope for this iteration:

- Real 3D dog model.
- Multiplayer or social features.
- Account system.
- Mobile-native app packaging.
- Full ML model training.

## Open Decisions

The implementation should use a copied working version of the current prototype under `/Users/Xin.L/Documents/playground` so edits, tests, and git history are safe. The original project in `/Users/Xin.L/Downloads/virtual-dog-fetch-perspective-v8-v3-model-precise-fetch 2` should remain unchanged unless the user explicitly asks to edit it directly.
