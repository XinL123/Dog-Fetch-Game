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
  const throwPower = clamp(power, 0.35, 2.35);
  const x = clamp(50 + dir.x * 28, 22, 78);
  const y = clamp(43 - throwPower * 18 - Math.max(0, -dir.y) * 2, 6, 37);

  return {
    x,
    y,
    ballScale: clamp(0.72 - throwPower * 0.18, 0.26, 0.62),
    dogScale: clamp(0.78 - throwPower * 0.12, 0.42, 0.7),
  };
}

export function mapCameraThrowToTarget({ direction, power = 1 }) {
  const cameraDirection = direction || { x: 0, y: -1 };
  return mapThrowToTarget({
    direction: { ...cameraDirection, x: -cameraDirection.x },
    power,
  });
}
