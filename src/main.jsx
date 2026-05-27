import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Camera,
  CameraOff,
  Play,
  Pause,
  RotateCcw,
  Save,
  Trash2,
  UserPlus,
  Download,
  Upload,
  Dog as DogIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { createGestureRecognizer } from "./gestureRecognizer.js";
import { createInitialFetchState, updateFetchState, FETCH_PHASE } from "./fetchStateMachine.js";
import { mapThrowToTarget } from "./sceneMapping.js";
import { getCameraErrorMessage } from "./cameraErrors.js";
import "./style.css";

const GAME = {
  IDLE: "idle",
  WATCHING: "watching",
  SWING: "swing",
  FLYING: "flying",
  FETCHING: "fetching",
  RETURNING: "returning",
};

const LM = { LS: 11, RS: 12, LE: 13, RE: 14, LW: 15, RW: 16 };
const STORAGE_KEY = "dog-fetch-perspective-v5";

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function dist(a, b) { return !a || !b ? 0 : Math.hypot(a.x - b.x, a.y - b.y); }
function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
function div(a, n) { return { x: a.x / n, y: a.y / n }; }
function dot(a, b) { return a.x * b.x + a.y * b.y; }
function mag(a) { return Math.hypot(a.x, a.y); }
function norm(a) { const m = mag(a) || 1; return { x: a.x / m, y: a.y / m }; }
function visibility(p) { return p?.visibility ?? p?.presence ?? 1; }
function mid(a, b) { return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null; }
function avg(points) {
  if (!points.length) return null;
  return div(points.reduce((acc, p) => add(acc, p), { x: 0, y: 0 }), points.length);
}

function createProfile(name) {
  return {
    id: crypto.randomUUID(),
    name: name || "Participant",
    handMode: "auto",
    trials: [],
  };
}

function normalizeTrial(trial) {
  if (!trial) return null;
  const readyRel = trial?.ready?.relWrist || trial?.ready?.rel || null;
  const releaseRel = trial?.release?.relWrist || trial?.release?.rel || null;
  if (!readyRel || !releaseRel) return null;
  return {
    id: trial.id || crypto.randomUUID(),
    side: trial.side || trial.ready?.side || trial.release?.side || "right",
    ready: {
      side: trial?.ready?.side || trial.side || "right",
      relWrist: readyRel,
      rel: readyRel,
      capturedAt: trial?.ready?.capturedAt || trial?.savedAt || new Date().toISOString(),
    },
    release: {
      side: trial?.release?.side || trial.side || "right",
      relWrist: releaseRel,
      rel: releaseRel,
      capturedAt: trial?.release?.capturedAt || trial?.savedAt || new Date().toISOString(),
    },
    savedAt: trial.savedAt || new Date().toISOString(),
  };
}

function normalizeProfile(profile, idx = 0) {
  const trials = Array.isArray(profile?.trials)
    ? profile.trials.map(normalizeTrial).filter(Boolean)
    : [];
  return {
    id: profile?.id || crypto.randomUUID(),
    name: profile?.name || `Participant ${idx + 1}`,
    handMode: profile?.handMode || "auto",
    trials,
  };
}

function loadProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length) return parsed.map(normalizeProfile);
  } catch {}
  return [createProfile("Participant 1")];
}

function extractProfilesFromImport(data) {
  // Accept direct v3-clean arrays, single profile objects, and wrapped export shapes.
  const candidate = Array.isArray(data)
    ? data
    : Array.isArray(data?.profiles)
      ? data.profiles
      : Array.isArray(data?.participants)
        ? data.participants
        : Array.isArray(data?.data)
          ? data.data
          : (data?.trials ? [data] : []);
  return candidate.map(normalizeProfile).filter((p) => Array.isArray(p.trials) && p.trials.length >= 0);
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", padding: 32, background: "#111", color: "white", fontFamily: "system-ui, sans-serif" }}>
          <h1>App crashed</h1>
          <p style={{ color: "#fca5a5" }}>{String(this.state.error?.message || this.state.error)}</p>
          <p>请把这段红色报错截图给我，我可以继续修。</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function RealisticDog({ running, carrying }) {
  return (
    <motion.div
      className="dog-actor"
      animate={{ y: running ? [0, -5, 0, -2, 0] : [0, -1, 0], rotate: running ? [0, -1, 1, 0] : 0 }}
      transition={{ duration: running ? 0.58 : 1.2, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="dog-shadow" />
      <div className="dog-body" />
      <div className="dog-chest" />
      <div className="dog-head" />
      <div className="dog-ear dog-ear-a" />
      <div className="dog-ear dog-ear-b" />
      <div className="dog-muzzle" />
      <div className="dog-nose" />
      <div className="dog-eye" />
      <div className="dog-tail" />
      <div className="dog-leg leg-a" />
      <div className="dog-leg leg-b" />
      <div className="dog-leg leg-c" />
      <div className="dog-leg leg-d" />
      {carrying && <div className="carried-ball" />}
    </motion.div>
  );
}

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const timersRef = useRef([]);
  const modelsRef = useRef(null);
  const profileRef = useRef(null);
  const latestRef = useRef({ left: null, right: null });
  const historyRef = useRef({ left: [], right: [] });
  const gateRef = useRef({ phase: "WAIT_READY", side: null, model: null, readyAt: 0, minProgress: 0 });
  const gestureRef = useRef(createGestureRecognizer());
  const fetchStateRef = useRef(createInitialFetchState());
  const playingRef = useRef(false);
  const lastFireRef = useRef(0);

  const [profiles, setProfiles] = useState(loadProfiles);
  const safeProfiles = profiles.length ? profiles : [createProfile("Participant 1")];
  const [activeId, setActiveId] = useState(() => safeProfiles[0]?.id || "");
  const activeProfile = useMemo(() => safeProfiles.find((p) => p.id === activeId) || safeProfiles[0], [safeProfiles, activeId]);
  const models = useMemo(() => buildModels(activeProfile), [activeProfile]);

  const [nameInput, setNameInput] = useState("");
  const [readyPose, setReadyPose] = useState(null);
  const [releasePose, setReleasePose] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("camera off");
  const [trackedHand, setTrackedHand] = useState("none");
  const [phase, setPhase] = useState("Step into view");
  const [confidence, setConfidence] = useState(0);
  const [debug, setDebug] = useState("Start camera, press Start Playing, then hold your arm briefly and throw naturally.");
  const [error, setError] = useState("");
  const [fetchState, setFetchState] = useState(createInitialFetchState);
  const [throwFX, setThrowFX] = useState(false);

  const ball = fetchState.ball;
  const dog = fetchState.dog;
  const fetches = fetchState.fetches;
  const gamePhase = fetchState.phase;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeProfiles));
  }, [safeProfiles]);

  useEffect(() => {
    modelsRef.current = models;
    profileRef.current = activeProfile;
  }, [models, activeProfile]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const next = updateFetchState(fetchStateRef.current, { type: "TICK", now: performance.now() });
      if (next !== fetchStateRef.current) {
        fetchStateRef.current = next;
        setFetchState(next);
        setPhase(next.phase === FETCH_PHASE.WAITING ? (playingRef.current ? "Ready Hold" : "Paused") : next.phase);
        if (next.phase === FETCH_PHASE.WAITING) setThrowFX(false);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  async function loadPoseModel() {
    if (poseRef.current) return poseRef.current;
    setStatus("loading pose model");
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    poseRef.current = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
    return poseRef.current;
  }

  async function startCamera() {
    setError("");
    setStarting(true);
    try {
      await loadPoseModel();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 540 } },
        audio: false,
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      await videoRef.current.play();
      setCameraOn(true);
      setStatus("tracking");
      setDebug("Camera ready. Press Start Playing, hold your arm briefly, then throw naturally.");
      startLoop();
    } catch (e) {
      setError(getCameraErrorMessage(e));
      setStatus("camera/model failed");
    } finally {
      setStarting(false);
    }
  }

  function stopCamera() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
    setPlaying(false);
    playingRef.current = false;
    setStatus("camera off");
    setConfidence(0);
    resetScene();
    clearOverlay();
  }

  function startLoop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const loop = () => {
      detectFrame();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  function detectFrame() {
    const video = videoRef.current;
    const pose = poseRef.current;
    if (!video || !pose || video.readyState < 2) return;

    const now = performance.now();
    const result = pose.detectForVideo(video, now);
    const lm = result.landmarks?.[0];

    if (!lm) {
      latestRef.current = { left: null, right: null };
      setStatus("no body");
      setTrackedHand("none");
      setConfidence(0);
      clearOverlay();
      return;
    }

    drawPose(lm);

    const left = makeSample(lm, "left", now);
    const right = makeSample(lm, "right", now);
    latestRef.current = { left, right };

    if (left) pushHistory("left", left, now);
    if (right) pushHistory("right", right, now);

    const visible = chooseVisible(left, right);
    setTrackedHand(visible?.side || "none");
    setStatus(visible ? "pose ok" : "arm incomplete");

    const gesture = gestureRef.current.update({ left, right }, 1, profileRef.current?.handMode || "auto");
    setConfidence(gesture.score || 0);
    if (fetchStateRef.current.phase === FETCH_PHASE.WAITING) {
      setPhase(playingRef.current ? gesture.phase : "Paused");
      setDebug(playingRef.current ? (gesture.debug || "") : "Press Start Playing when you are ready.");
    }

    if (playingRef.current && gesture.shouldFire && fetchStateRef.current.phase === FETCH_PHASE.WAITING) {
      const target = mapThrowToTarget({ direction: gesture.aimDirection || gesture.direction, power: gesture.power });
      const next = updateFetchState(fetchStateRef.current, { type: "THROW", target, now });
      fetchStateRef.current = next;
      setFetchState(next);
      setThrowFX(true);
      setPhase("Throw!");
      setDebug("Nice throw. The dog is tracking the ball.");
    }
  }

  function makeSample(lm, side, now) {
    const isLeft = side === "left";
    const shoulder = lm[isLeft ? LM.LS : LM.RS];
    const elbow = lm[isLeft ? LM.LE : LM.RE];
    const wrist = lm[isLeft ? LM.LW : LM.RW];
    const otherShoulder = lm[isLeft ? LM.RS : LM.LS];
    if (![shoulder, elbow, wrist].every((p) => p && visibility(p) > 0.25)) return null;
    const center = mid(shoulder, otherShoulder) || shoulder;
    const wristPoint = { x: wrist.x, y: wrist.y };
    return {
      t: now,
      side,
      wrist: wristPoint,
      relWrist: sub(wristPoint, center),
      rel: sub(wristPoint, center),
      quality: visibility(wrist) + visibility(elbow) + visibility(shoulder),
    };
  }

  function chooseVisible(left, right) {
    if (left && !right) return left;
    if (right && !left) return right;
    if (!left && !right) return null;
    return left.quality >= right.quality ? left : right;
  }

  function pushHistory(side, sample, now) {
    const h = historyRef.current[side];
    h.push(sample);
    historyRef.current[side] = h.filter((item) => now - item.t < 1000);
  }

  function buildModels(profile) {
    const left = [];
    const right = [];
    const trials = profile?.trials || [];

    trials.forEach((t, index) => {
      const ready = t.ready?.relWrist || t.ready?.rel;
      const release = t.release?.relWrist || t.release?.rel;
      if (!ready || !release) return;
      const vector = sub(release, ready);
      const length = mag(vector);
      if (length < 0.015) return;
      const model = {
        id: t.id || `trial-${index}`,
        side: t.side || "right",
        ready,
        release,
        vector,
        direction: norm(vector),
        length: Math.max(0.04, length),
        readyRadius: Math.max(0.16, Math.min(0.34, length * 1.65)),
        pathTolerance: Math.max(0.16, Math.min(0.34, length * 1.35)),
        source: "trial",
      };
      if (model.side === "left") left.push(model); else right.push(model);
    });

    [left, right].forEach((arr) => {
      if (arr.length < 2) return;
      const readyAvg = avg(arr.map((m) => m.ready));
      const releaseAvg = avg(arr.map((m) => m.release));
      const vector = sub(releaseAvg, readyAvg);
      const length = mag(vector);
      if (length < 0.015) return;
      arr.push({
        id: `mean-${arr[0].side}`,
        side: arr[0].side,
        ready: readyAvg,
        release: releaseAvg,
        vector,
        direction: norm(vector),
        length: Math.max(0.04, length),
        readyRadius: Math.max(0.18, Math.min(0.36, length * 1.8)),
        pathTolerance: Math.max(0.18, Math.min(0.36, length * 1.5)),
        source: "mean",
      });
    });

    return { left, right };
  }

  function hasAnyModel(m) {
    return Boolean((m?.left?.length || 0) + (m?.right?.length || 0));
  }

  function evaluateAll(samples, models, profile, now, currentGame) {
    const handMode = profile?.handMode || "auto";
    const candidates = [];

    if ((handMode === "auto" || handMode === "left") && samples.left && models.left?.length) {
      models.left.forEach((m) => candidates.push(evaluateCandidate(samples.left, m, now)));
    }
    if ((handMode === "auto" || handMode === "right") && samples.right && models.right?.length) {
      models.right.forEach((m) => candidates.push(evaluateCandidate(samples.right, m, now)));
    }

    if (!candidates.length) {
      return {
        score: 0,
        phase: "Show calibrated hand",
        shouldFire: false,
        progressRatio: 0,
        speed: 0,
        debug: `No usable sample for ${handMode} mode. Try Auto, or show calibrated arm.`,
      };
    }

    const best = [...candidates].sort((a, b) => b.score - a.score)[0];
    const busy = [GAME.SWING, GAME.FLYING, GAME.FETCHING, GAME.RETURNING].includes(currentGame);
    if (busy) {
      return { ...best, phase: "Animating", shouldFire: false, debug: "Animating dog and ball." };
    }

    const gate = gateRef.current;
    if (gate.phase === "WAIT_READY") {
      const readyCandidates = candidates
        .filter((c) => c.toReady < c.model.readyRadius)
        .sort((a, b) => b.score - a.score);

      if (readyCandidates.length) {
        const readyBest = readyCandidates[0];
        gateRef.current = {
          phase: "IN_READY",
          readyAt: now,
          side: readyBest.sample.side,
          model: readyBest.model,
          minProgress: readyBest.progressRatio,
        };
        return { ...readyBest, phase: "Ready matched", shouldFire: false, debug: formatDebug(readyBest, handMode, true) };
      }

      return { ...best, phase: "Find Ready", shouldFire: false, debug: formatDebug(best, handMode, false) };
    }

    const gatedSample = gate.side === "left" ? samples.left : samples.right;
    const gatedModel = gate.model;

    if (!gatedSample || !gatedModel) {
      gateRef.current = { phase: "WAIT_READY", side: null, model: null, readyAt: 0, minProgress: 0 };
      return { ...best, phase: "Find Ready", shouldFire: false, debug: "Lost tracked hand. Find Ready again." };
    }

    const e = evaluateCandidate(gatedSample, gatedModel, now);

    if (now - gate.readyAt > 3200) {
      gateRef.current = { phase: "WAIT_READY", side: null, model: null, readyAt: 0, minProgress: 0 };
      return { ...e, phase: "Ready timeout", shouldFire: false, debug: "Ready timed out. Return to Ready and throw again." };
    }

    // Restored from the uploaded dog-fetch-camera-calibration-v3-clean model:
    // Ready must be matched first, then Release is allowed by calibrated progress/path/speed.
    // This keeps the hand mapping accurate without letting the scene code invent a new gesture model.
    const shouldFire =
      playingRef.current &&
      e.progressRatio > 0.22 &&
      e.pathError < gatedModel.pathTolerance * 1.35 &&
      e.speed > 0.035 &&
      now - lastFireRef.current > 1500;

    return { ...e, phase: shouldFire ? "Release" : "Throw outward", shouldFire, debug: formatDebug(e, handMode, true) };
  }

  function evaluateCandidate(sample, model, now) {
    const rel = sample.relWrist || sample.rel;
    const fromReady = sub(rel, model.ready);
    const progress = dot(fromReady, model.direction);
    const progressRatio = progress / model.length;
    const pathError = Math.abs(fromReady.x * -model.direction.y + fromReady.y * model.direction.x);
    const toReady = dist(rel, model.ready);
    const hist = historyRef.current[sample.side] || [];
    const prev = hist.find((item) => now - item.t > 160) || hist[0] || sample;
    const prevRel = prev.relWrist || prev.rel;
    const speed = dist(rel, prevRel) / Math.max(0.001, (now - prev.t) / 1000);

    let score = 0;
    if (toReady < model.readyRadius) score += 30;
    score += clamp(progressRatio * 58, 0, 58);
    score += clamp(speed * 24, 0, 24);
    score -= clamp(pathError * 45, 0, 14);
    score = Math.round(clamp(score, 0, 100));

    return { score, sample, model, side: sample.side, rel, toReady, progressRatio, pathError, speed, shouldFire: false };
  }

  function formatDebug(e, handMode, gated) {
    return `playing ${playingRef.current ? "YES" : "NO"} · mode ${handMode} · hand ${e.side} · ${gated ? "gated" : "open"} · model ${e.model.source}/${String(e.model.id).slice(0, 8)} · ready ${e.toReady.toFixed(2)}/${e.model.readyRadius.toFixed(2)} · progress ${e.progressRatio.toFixed(2)} · path ${e.pathError.toFixed(2)}/${(e.model.pathTolerance * 1.35).toFixed(2)} · speed ${e.speed.toFixed(2)}`;
  }

  function captureReady() {
    const sample = chooseVisible(latestRef.current.left, latestRef.current.right);
    if (!sample) return setDebug("No visible arm. Show shoulder, elbow, wrist.");
    setReadyPose({ side: sample.side, relWrist: sample.relWrist, rel: sample.relWrist, capturedAt: new Date().toISOString() });
    setDebug(`Ready captured from ${sample.side}. Now hold Release pose.`);
  }

  function captureRelease() {
    const sample = chooseVisible(latestRef.current.left, latestRef.current.right);
    if (!sample) return setDebug("No visible arm. Show shoulder, elbow, wrist.");
    setReleasePose({ side: sample.side, relWrist: sample.relWrist, rel: sample.relWrist, capturedAt: new Date().toISOString() });
    setDebug(`Release captured from ${sample.side}. Click Save Trial.`);
  }

  function saveTrial() {
    if (!activeProfile || !readyPose || !releasePose) return setDebug("Need Ready and Release before saving.");
    if (readyPose.side !== releasePose.side) return setDebug("Ready and Release use different hands.");
    const trial = normalizeTrial({
      id: crypto.randomUUID(),
      side: readyPose.side,
      ready: readyPose,
      release: releasePose,
      savedAt: new Date().toISOString(),
    });
    setProfiles((prev) => prev.map((p) => p.id === activeProfile.id ? { ...p, trials: [...(p.trials || []), trial] } : p));
    setReadyPose(null);
    setReleasePose(null);
    setDebug(`Trial saved for ${trial.side}. This build stays compatible with v3-clean export data.`);
  }

  function startPlaying() {
    setPlaying(true);
    playingRef.current = true;
    gateRef.current = { phase: "WAIT_READY", side: null, model: null, readyAt: 0, minProgress: 0 };
    gestureRef.current = createGestureRecognizer();
    setPhase("Ready Hold");
    setDebug("Hold your throwing arm briefly, then toss forward and upward.");
  }

  function pausePlaying() {
    setPlaying(false);
    playingRef.current = false;
    gateRef.current = { phase: "WAIT_READY", side: null, model: null, readyAt: 0, minProgress: 0 };
    setPhase("Paused");
    setDebug("Paused. Press Start Playing to continue.");
  }

  function computeThrowTarget(evaluation, power = 1.2) {
    const model = evaluation?.model;
    const dir = model?.direction || { x: 0, y: -1 };
    const releaseStrength = clamp(evaluation?.progressRatio || 1, 0.75, 1.45);
    const lateral = clamp(dir.x * 42, -24, 24);

    return {
      // Same target is reused by the ball and the dog, so the dog truly chases this throw.
      x: clamp(50 + lateral, 24, 76),
      y: clamp(29 - power * 4.4 - releaseStrength * 3.2, 15, 28),
      ballScale: clamp(0.52 - power * 0.08, 0.34, 0.5),
      dogScale: clamp(0.66 - power * 0.08, 0.46, 0.62),
    };
  }

  function triggerThrow(evaluationOrPower = null, maybePower) {
    const evaluation = typeof evaluationOrPower === "object" ? evaluationOrPower : null;
    const power = typeof evaluationOrPower === "number" ? evaluationOrPower : maybePower || 1.2;
    const target = mapThrowToTarget({ direction: evaluation?.direction || { x: 0, y: -1 }, power });
    const next = updateFetchState(createInitialFetchState(), { type: "THROW", target, now: performance.now() });
    fetchStateRef.current = next;
    setFetchState(next);
    setThrowFX(true);
    setPhase("Test Throw");
    setDebug("Test throw launched. Watch the dog track the same target.");
  }

  function resetScene() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setThrowFX(false);
    const next = createInitialFetchState();
    fetchStateRef.current = next;
    setFetchState(next);
    gestureRef.current = createGestureRecognizer();
    gateRef.current = { phase: "WAIT_READY", side: null, model: null, readyAt: 0, minProgress: 0 };
    setConfidence(0);
    setPhase("Ready");
    setDebug("Step into view, hold your arm briefly, then throw naturally.");
  }

  function addProfile() {
    const next = createProfile(nameInput.trim() || `Participant ${safeProfiles.length + 1}`);
    setProfiles((prev) => [...prev, next]);
    setActiveId(next.id);
    setNameInput("");
  }

  function updateHandMode(value) {
    setProfiles((prev) => prev.map((p) => p.id === activeProfile.id ? { ...p, handMode: value } : p));
    gateRef.current = { phase: "WAIT_READY", side: null, model: null, readyAt: 0, minProgress: 0 };
    setConfidence(0);
  }

  function clearTrials() {
    setProfiles((prev) => prev.map((p) => p.id === activeProfile.id ? { ...p, trials: [] } : p));
    setReadyPose(null);
    setReleasePose(null);
    setPlaying(false);
    playingRef.current = false;
    gateRef.current = { phase: "WAIT_READY", side: null, model: null, readyAt: 0, minProgress: 0 };
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(safeProfiles, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dog-fetch-perspective-v5-data.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const normalized = extractProfilesFromImport(raw);
        if (!normalized.length) throw new Error("No usable profiles/trials found");
        setProfiles(normalized);
        setActiveId(normalized[0]?.id || "");
        setReadyPose(null);
        setReleasePose(null);
        setPlaying(false);
        playingRef.current = false;
        gateRef.current = { phase: "WAIT_READY", side: null, model: null, readyAt: 0, minProgress: 0 };
        setConfidence(0);
        const trialCount = normalized.reduce((sum, p) => sum + (p.trials?.length || 0), 0);
        setDebug(`Imported ${normalized.length} profile(s), ${trialCount} trial(s). Click Start Playing to use the v3-clean model.`);
      } catch (err) {
        setDebug(`Import failed: ${err?.message || "please import exported v3-clean JSON"}.`);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function clearOverlay() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawPose(lm) {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 960;
    const h = video.videoHeight || 540;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,.95)";
    ctx.fillStyle = "rgba(255,255,255,.95)";

    function point(i) {
      const p = lm[i];
      if (!p || visibility(p) < 0.25) return null;
      return { x: p.x * w, y: p.y * h };
    }

    [[LM.LS, LM.LE, LM.LW], [LM.RS, LM.RE, LM.RW]].forEach((chain) => {
      const pts = chain.map(point);
      if (pts.some((p) => !p)) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.stroke();
      pts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  const leftCount = models.left.filter((m) => m.source === "trial").length;
  const rightCount = models.right.filter((m) => m.source === "trial").length;

  return (
    <main className="stage">
      <div className="sky-glow" />
      <div className="horizon-band" />
      <div className="field-plane" />
      <div className="perspective-lines" />
      <div className="foreground-grass fg-a" />
      <div className="foreground-grass fg-b" />

      <div className="top-bar">
        <div className="brand-pill"><DogIcon size={16} />Indoor Fetch</div>
        <div className="metric-row">
          <div className="metric-card"><span>Motion</span><strong>{confidence}</strong></div>
          <div className="metric-card"><span>Status</span><strong>{phase}</strong></div>
          <div className="metric-card"><span>Fetches</span><strong>{fetches}</strong></div>
        </div>
      </div>

      <div className="pip-card">
        <video ref={videoRef} className="pip-video" playsInline muted />
        <canvas ref={canvasRef} className="pip-canvas" />
        {!cameraOn && <div className="pip-empty"><Camera size={22} /><span>camera</span></div>}
        <div className="pip-label">{status} · {trackedHand}</div>
      </div>

      <AnimatePresence>
        {throwFX && (
          <>
            <motion.div
              className="arc arc-blue"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: [0, 1, 0.7], scale: [0.85, 1, 1.04] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.3, ease: "easeOut" }}
            />
            <motion.div
              className="arc arc-red"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: [0, 0.85, 0.4], scale: [0.85, 1, 1.04] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.06 }}
            />
            <motion.div
              className="motion-ribbon"
              initial={{ opacity: 0, scaleX: 0.08 }}
              animate={{ opacity: [0, 0.9, 0.2], scaleX: [0.08, 1, 1.05] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.12, ease: "easeOut" }}
            />
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ball.visible && (
          <motion.div
            className="ball"
            initial={{ opacity: 0 }}
            animate={{ left: `${ball.x}%`, top: `${ball.y}%`, scale: ball.scale, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.25 }}
            transition={{ type: "spring", stiffness: gamePhase === FETCH_PHASE.BALL_FLYING ? 38 : 95, damping: 12 }}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="dog-position"
        animate={{ left: `${dog.x}%`, top: `${dog.y}%`, scale: dog.scale }}
        transition={{ type: "spring", stiffness: 46, damping: 14 }}
      >
        <RealisticDog running={gamePhase === FETCH_PHASE.RUN_TO_BALL || gamePhase === FETCH_PHASE.RETURN_TO_USER} carrying={dog.carrying} />
      </motion.div>

      <aside className="side-panel">
        <div className="panel-card">
          <div className="panel-note">Stand in view, hold your throwing arm briefly, then toss forward and upward. The dog will chase the same ball target and bring it back.</div>

          <div className="row four primary-controls">
            {!cameraOn ? (
              <button onClick={startCamera} disabled={starting}><Camera size={16} />{starting ? "Starting..." : "Start Camera"}</button>
            ) : (
              <button className="secondary" onClick={stopCamera}><CameraOff size={16} />Stop Camera</button>
            )}

            {!playing ? (
              <button className="secondary" onClick={startPlaying}><Play size={16} />Start Playing</button>
            ) : (
              <button className="secondary" onClick={pausePlaying}><Pause size={16} />Pause</button>
            )}

            <button className="secondary" onClick={() => triggerThrow(1.2)}>Test Throw</button>
            <button className="secondary" onClick={resetScene}><RotateCcw size={16} />Reset</button>
          </div>

          <p className="debug-text">{debug}</p>
        </div>

        <details className="panel-card advanced-panel">
          <summary>Advanced setup</summary>

          <div className="row two">
            <select value={activeProfile?.id || ""} onChange={(e) => setActiveId(e.target.value)}>
              {safeProfiles.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.trials?.length || 0} trials</option>)}
            </select>
            <select value={activeProfile?.handMode || "auto"} onChange={(e) => updateHandMode(e.target.value)}>
              <option value="auto">Auto hand</option>
              <option value="left">Left only</option>
              <option value="right">Right only</option>
            </select>
          </div>

          <div className="row three">
            <button onClick={captureReady} disabled={!cameraOn}>1. Set Ready</button>
            <button onClick={captureRelease} disabled={!cameraOn}>2. Set Release</button>
            <button onClick={saveTrial} disabled={!readyPose || !releasePose}><Save size={16} />3. Save Trial</button>
          </div>

          <div className="status-tags">
            <span className={readyPose ? "ok" : ""}>Ready {readyPose ? readyPose.side : "empty"}</span>
            <span className={releasePose ? "ok" : ""}>Release {releasePose ? releasePose.side : "empty"}</span>
            <span className={leftCount + rightCount ? "ok" : ""}>Models L{leftCount}/R{rightCount}</span>
          </div>

          <div className="stack-tools">
            <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="New participant" />
            <button className="secondary" onClick={addProfile}><UserPlus size={16} />Add</button>
            <button className="secondary danger" onClick={clearTrials}><Trash2 size={16} />Clear trials</button>
            <button className="secondary" onClick={exportData}><Download size={16} />Export JSON</button>
            <label className="secondary import-btn"><Upload size={16} />Import JSON<input type="file" accept="application/json" onChange={importData} /></label>
          </div>
        </details>

        {error && <div className="error-box">{error}</div>}
      </aside>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
