import { distance, mapRange, clamp } from './utils.js'

const LANDMARK_INDEX = {
  WRIST: 0,
  THUMB_TIP: 4,
  THUMB_IP: 3,
  INDEX_TIP: 8,
  INDEX_PIP: 6,
  MIDDLE_TIP: 12,
  MIDDLE_PIP: 10,
  RING_TIP: 16,
  RING_PIP: 14,
  PINKY_TIP: 20,
  PINKY_PIP: 18,
}

export function getHandY(landmarks) {
  if (!landmarks) return 0.5
  return 1 - landmarks[LANDMARK_INDEX.WRIST].y
}

export function getHandX(landmarks) {
  if (!landmarks) return 0.5
  return landmarks[LANDMARK_INDEX.WRIST].x
}

export function getPinchDistance(landmarks) {
  if (!landmarks) return 0
  const thumb = landmarks[LANDMARK_INDEX.THUMB_TIP]
  const index = landmarks[LANDMARK_INDEX.INDEX_TIP]
  return distance(thumb.x, thumb.y, index.x, index.y)
}

export function getNormalizedPinch(pinchDist, handX, handY) {
  const scale = 1 + (1 - handY) * 0.5
  const normalized = mapRange(pinchDist, 0.02 * scale, 0.15 * scale, 0, 1)
  return clamp(normalized, 0, 1)
}

export function isFist(landmarks) {
  if (!landmarks) return false

  const tips = [
    LANDMARK_INDEX.THUMB_TIP,
    LANDMARK_INDEX.INDEX_TIP,
    LANDMARK_INDEX.MIDDLE_TIP,
    LANDMARK_INDEX.RING_TIP,
    LANDMARK_INDEX.PINKY_TIP,
  ]
  const pips = [
    LANDMARK_INDEX.THUMB_IP,
    LANDMARK_INDEX.INDEX_PIP,
    LANDMARK_INDEX.MIDDLE_PIP,
    LANDMARK_INDEX.RING_PIP,
    LANDMARK_INDEX.PINKY_PIP,
  ]

  let closed = 0
  for (let i = 0; i < tips.length; i++) {
    const tip = landmarks[tips[i]]
    const pip = landmarks[pips[i]]
    if (tip.y > pip.y) closed++
  }

  return closed >= 4
}

export function getHandDistance(hand1, hand2) {
  if (!hand1 || !hand2) return 0.5
  const w1 = hand1[LANDMARK_INDEX.WRIST]
  const w2 = hand2[LANDMARK_INDEX.WRIST]
  return distance(w1.x, w1.y, w2.x, w2.y)
}
