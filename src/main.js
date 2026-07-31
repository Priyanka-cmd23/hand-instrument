import './styles.css'
import { initCamera } from './camera.js'
import { initHandLandmarker, detectHands, getLandmarks } from './handTracking.js'
import { getHandY, getHandX, getNormalizedPinch, isFist, getHandDistance } from './gestures.js'
import { AudioEngine } from './audioEngine.js'
import { clamp, mapRange, smoothValue } from './utils.js'

const video = document.getElementById('video')
const canvas = document.getElementById('overlay-canvas')
const ctx = canvas.getContext('2d')

const loadingScreen = document.getElementById('loading-screen')
const loadingStatus = document.getElementById('loading-status')
const permissionOverlay = document.getElementById('permission-overlay')
const startBtn = document.getElementById('start-btn')

const noteName = document.getElementById('note-name')
const noteOctave = document.getElementById('note-octave')
const chordName = document.getElementById('chord-name')
const chordType = document.getElementById('chord-type')
const volumeFill = document.getElementById('volume-fill')
const volumePct = document.getElementById('volume-pct')
const filterValue = document.getElementById('filter-value')
const filterFill = document.getElementById('filter-fill')
const fpsValue = document.getElementById('fps-value')
const modeName = document.getElementById('mode-name')
const handLeft = document.getElementById('hand-left')
const handRight = document.getElementById('hand-right')

const rootSelect = document.getElementById('root-select')
const scaleSelect = document.getElementById('scale-select')
const waveformSelect = document.getElementById('waveform-select')
const modeSelect = document.getElementById('mode-select')

const audio = new AudioEngine()
let handLandmarker = null
let animFrameId = null
let lastTime = 0
let frameCount = 0
let fpsTimer = 0

function resizeCanvas() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}
window.addEventListener('resize', resizeCanvas)
resizeCanvas()

function drawSkeleton(landmarks, color) {
  if (!landmarks) return

  const w = canvas.width
  const h = canvas.height

  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17],
  ]

  for (const [i, j] of connections) {
    const a = landmarks[i]
    const b = landmarks[j]
    if (a && b) {
      ctx.beginPath()
      ctx.moveTo((1 - a.x) * w, a.y * h)
      ctx.lineTo((1 - b.x) * w, b.y * h)
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.shadowColor = color
      ctx.shadowBlur = 8
      ctx.stroke()
      ctx.shadowBlur = 0
    }
  }

  for (const lm of landmarks) {
    if (!lm) continue
    ctx.beginPath()
    ctx.arc((1 - lm.x) * w, lm.y * h, 3, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 10
    ctx.fill()
    ctx.shadowBlur = 0
  }
}

function drawVolumeRing(gain) {
  const cx = canvas.width / 2
  const cy = canvas.height - 80
  const radius = 30 + gain * 20
  const alpha = 0.1 + gain * 0.4

  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`
  ctx.lineWidth = 2
  ctx.shadowColor = '#00f0ff'
  ctx.shadowBlur = 15 * gain
  ctx.stroke()
  ctx.shadowBlur = 0
}

async function init() {
  try {
    loadingStatus.textContent = 'Loading hand tracking model (6MB)...'
    handLandmarker = await initHandLandmarker()

    loadingStatus.textContent = 'Connecting to camera...'
    await initCamera(video)

    loadingScreen.classList.add('hidden')

    setTimeout(() => {
      permissionOverlay.classList.remove('hidden')
    }, 300)
  } catch (err) {
    loadingStatus.textContent = `Error: ${err.message}`
    loadingStatus.style.color = '#ff00aa'
  }
}

startBtn.addEventListener('click', () => {
  audio.init()
  audio.resume()
  permissionOverlay.classList.add('hidden')
  mainLoop()
})

document.addEventListener('click', () => {
  if (audio.ctx) audio.resume()
})

rootSelect.addEventListener('change', () => {
  audio.setRoot(rootSelect.value)
})

scaleSelect.addEventListener('change', () => {
  audio.setScale(scaleSelect.value)
})

waveformSelect.addEventListener('change', () => {
  audio.setWaveform(waveformSelect.value)
})

modeSelect.addEventListener('change', () => {
  audio.setMode(modeSelect.value)
  modeName.textContent = modeSelect.value === 'theremin' ? 'THEREmin' : 'CHORD'
})

let smoothGain = 0
let smoothPitch = 0.5

function mainLoop() {
  const now = performance.now()
  const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016
  lastTime = now

  frameCount++
  fpsTimer += dt
  if (fpsTimer >= 0.5) {
    fpsValue.textContent = Math.round(frameCount / fpsTimer)
    frameCount = 0
    fpsTimer = 0
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const results = detectHands(video)
  const { left, right } = getLandmarks(results)

  if (left) {
    drawSkeleton(left, 'rgba(0, 240, 255, 0.6)')
    handLeft.classList.add('active')
  } else {
    handLeft.classList.remove('active')
  }

  if (right) {
    drawSkeleton(right, 'rgba(255, 0, 170, 0.6)')
    handRight.classList.add('active')
  } else {
    handRight.classList.remove('active')
  }

  const primaryHand = right || left

  let gestures = { hand: null, fist: false, bothHands: false }

  if (primaryHand) {
    const rawY = getHandY(primaryHand)
    const rawX = getHandX(primaryHand)
    const pinchDist = getNormalizedPinch(0, rawX, rawY)

    const actualPinchDist = Math.sqrt(
      ((1 - primaryHand[4].x) - (1 - primaryHand[8].x)) ** 2 +
      (primaryHand[4].y - primaryHand[8].y) ** 2
    )
    const pinchNorm = clamp(actualPinchDist / 0.12, 0, 1)

    const fist = isFist(primaryHand)

    gestures.hand = {
      y: clamp(rawY, 0, 1),
      x: clamp(rawX, 0, 1),
      pinch: pinchNorm,
    }
    gestures.fist = fist

    drawVolumeRing(pinchNorm)

    if (left && right) {
      const handDist = getHandDistance(left, right)
      gestures.handDist = handDist
    }
  }

  audio.update(dt, gestures)

  const analyserData = audio.getAnalyserData()
  const avgFreq = analyserData.reduce((a, b) => a + b, 0) / analyserData.length
  const barWidth = canvas.width / analyserData.length

  for (let i = 0; i < analyserData.length; i += 4) {
    const val = analyserData[i] / 255
    if (val > 0.02) {
      ctx.fillStyle = `rgba(0, 240, 255, ${val * 0.15})`
      ctx.fillRect(i * barWidth, canvas.height - val * 100, barWidth * 4, val * 100)
    }
  }

  const gain = gestures.hand?.pinch || 0
  smoothGain += (gain - smoothGain) * 0.15
  volumeFill.style.width = `${smoothGain * 100}%`
  volumePct.textContent = `${Math.round(smoothGain * 100)}%`

  const filterHz = Math.round(audio.currentFilter)
  filterValue.textContent = filterHz > 1000 ? `${(filterHz / 1000).toFixed(1)}k Hz` : `${filterHz} Hz`
  filterFill.style.width = `${(audio.currentFilter / 20000) * 100}%`

  animFrameId = requestAnimationFrame(mainLoop)
}

init()
