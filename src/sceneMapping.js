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
  const throwPower = clamp(power, 0.4, 1.9);
  const x = clamp(50 + dir.x * 28, 22, 78);
  const y = clamp(39 - throwPower * 14 - Math.max(0, -dir.y) * 3, 9, 35);

  return {
    x,
    y,
    ballScale: clamp(0.66 - throwPower * 0.15, 0.32, 0.58),
    dogScale: clamp(0.74 - throwPower * 0.1, 0.46, 0.68),
  };
}

export function mapCameraThrowToTarget({ direction, power = 1 }) {
  const cameraDirection = direction || { x: 0, y: -1 };
  return mapThrowToTarget({
    direction: { ...cameraDirection, x: -cameraDirection.x },
    power,
  });
}
