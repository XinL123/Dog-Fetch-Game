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
  if (state.phase === FETCH_PHASE.WAITING) return state;

  const elapsed = event.now - state.startedAt;

  if (elapsed >= 5600) {
    const fetches = state.fetches + (state.phase === FETCH_PHASE.WAITING || state.phase === FETCH_PHASE.DROP_BALL ? 0 : 1);
    return { ...state, phase: FETCH_PHASE.WAITING, startedAt: event.now, fetches, ball: { ...HOME_BALL }, dog: { ...HOME_DOG } };
  }

  if (elapsed >= 4700) {
    return {
      ...state,
      phase: FETCH_PHASE.DROP_BALL,
      fetches: state.phase === FETCH_PHASE.DROP_BALL ? state.fetches : state.fetches + 1,
      dog: { ...HOME_DOG },
      ball: { ...HOME_BALL, visible: true },
    };
  }

  if (elapsed >= 3300) {
    return {
      ...state,
      phase: FETCH_PHASE.RETURN_TO_USER,
      dog: { ...HOME_DOG, carrying: true },
      ball: { ...state.ball, visible: false, carried: true },
    };
  }

  if (elapsed >= 2400) {
    return {
      ...state,
      phase: FETCH_PHASE.PICK_UP_BALL,
      ball: { ...state.ball, visible: false, carried: true },
      dog: { ...state.dog, x: state.dog.target.x, y: state.dog.target.y, scale: state.dog.target.scale, carrying: true },
    };
  }

  if (elapsed >= 1100) {
    return {
      ...state,
      phase: FETCH_PHASE.RUN_TO_BALL,
      dog: { ...state.dog, x: state.dog.target.x, y: state.dog.target.y, scale: state.dog.target.scale },
    };
  }

  if (elapsed >= 700) {
    return { ...state, phase: FETCH_PHASE.LOCATE_BALL };
  }

  return state;
}
