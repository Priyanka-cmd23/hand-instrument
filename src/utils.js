export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

export function mapRange(value, inMin, inMax, outMin, outMax) {
  const t = (clamp(value, inMin, inMax) - inMin) / (inMax - inMin)
  return outMin + t * (outMax - outMin)
}

export function smoothValue(current, target, speed, dt) {
  if (dt > 0.1) dt = 0.016
  const t = 1 - Math.exp(-speed * dt)
  return lerp(current, target, t)
}

export function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

export function average(points) {
  return points.reduce((a, b) => a + b, 0) / points.length
}
