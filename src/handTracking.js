const VISION_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker_lite/float16/latest/hand_landmarker_lite.task'

let handLandmarker = null
let lastVideoTime = -1
let results = null

export async function initHandLandmarker() {
  const { FilesetResolver, HandLandmarker } = await import(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm/vision_bundle.mjs'
  )

  const vision = await FilesetResolver.forVisionTasks(VISION_URL)

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })

  return handLandmarker
}

export function detectHands(video) {
  if (!handLandmarker || !video || video.readyState < 2) return null

  if (video.currentTime === lastVideoTime) return results
  lastVideoTime = video.currentTime

  results = handLandmarker.detectForVideo(video, performance.now())
  return results
}

export function getLandmarks(results) {
  if (!results || !results.landmarks) return { left: null, right: null }

  let left = null
  let right = null

  for (let i = 0; i < results.landmarks.length; i++) {
    const hand = results.landmarks[i]
    const handedness = results.handednesses[i]?.[0]?.categoryName || 'Right'

    if (handedness === 'Left') {
      left = hand
    } else {
      right = hand
    }
  }

  return { left, right }
}
