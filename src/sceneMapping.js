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
