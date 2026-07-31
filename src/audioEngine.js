import { smoothValue } from './utils.js'

const SCALES = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  pentatonic: [0, 2, 4, 7, 9],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  blues: [0, 3, 5, 6, 7, 10],
  'whole-tone': [0, 2, 4, 6, 8, 10],
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const CHORD_NAMES = ['maj', 'm7', 'dom7', 'dim', 'aug', 'sus4']

const ROOT_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }

export class AudioEngine {
  constructor() {
    this.ctx = null
    this.oscillators = []
    this.gainNodes = []
    this.filter = null
    this.reverb = null
    this.masterGain = null
    this.analyser = null

    this.currentPitch = 60
    this.targetPitch = 60
    this.currentGain = 0
    this.targetGain = 0
    this.currentFilter = 1000
    this.targetFilter = 1000
    this.currentPan = 0
    this.targetPan = 0

    this.root = 'C'
    this.scale = 'pentatonic'
    this.waveform = 'sine'
    this.mode = 'theremin'
    this.isFrozen = false
    this.frozenPitch = 60
    this.frozenGain = 0
    this.frozenFilter = 1000

    this.voiceCount = 4
    this.chordIntervals = [0, 4, 7, 12]

    this.noteCallback = null
    this.chordCallback = null
  }

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0.7
    this.masterGain.connect(this.ctx.destination)

    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 256
    this.masterGain.connect(this.analyser)

    this.filter = this.ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 1000
    this.filter.Q.value = 0.5
    this.filter.connect(this.masterGain)

    this._createReverb()
    this._createOscillators()
  }

  async _createReverb() {
    const sampleRate = this.ctx.sampleRate
    const duration = 2
    const length = sampleRate * duration
    const impulse = this.ctx.createBuffer(2, length, sampleRate)

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.3))
      }
    }

    this.reverb = this.ctx.createConvolver()
    this.reverb.buffer = impulse
    this.reverbGain = this.ctx.createGain()
    this.reverbGain.gain.value = 0.15
    this.reverb.connect(this.reverbGain)
    this.reverbGain.connect(this.masterGain)
  }

  _createOscillators() {
    for (let i = 0; i < this.voiceCount; i++) {
      const osc = this.ctx.createOscillator()
      osc.type = this.waveform
      osc.frequency.value = 440

      const gain = this.ctx.createGain()
      gain.gain.value = 0
      gain.gain.setValueAtTime(0, this.ctx.currentTime)

      const panner = this.ctx.createStereoPanner()
      panner.pan.value = 0

      osc.connect(gain)
      gain.connect(panner)
      panner.connect(this.filter)

      if (this.reverb) {
        gain.connect(this.reverb)
      }

      osc.start()

      this.oscillators.push(osc)
      this.gainNodes.push(gain)
    }
  }

  setWaveform(type) {
    this.waveform = type
    this.oscillators.forEach((osc) => (osc.type = type))
  }

  setRoot(root) {
    this.root = root
  }

  setScale(scale) {
    this.scale = scale
    const intervals = SCALES[scale]
    this.voiceCount = Math.min(intervals.length, 6)
    this._rebuildVoices()
  }

  setMode(mode) {
    this.mode = mode
    if (mode === 'chord') {
      const intervals = SCALES[this.scale]
      this.voiceCount = Math.min(intervals.length, 6)
    } else {
      this.voiceCount = 4
    }
    this._rebuildVoices()
  }

  _rebuildVoices() {
    this.oscillators.forEach((osc) => {
      try { osc.stop() } catch (e) {}
    })
    this.oscillators = []
    this.gainNodes = []

    const intervals = SCALES[this.scale]
    for (let i = 0; i < this.voiceCount; i++) {
      const osc = this.ctx.createOscillator()
      osc.type = this.waveform
      osc.frequency.value = 440

      const gain = this.ctx.createGain()
      gain.gain.value = 0

      const panner = this.ctx.createStereoPanner()
      panner.pan.value = (i / (this.voiceCount - 1 || 1)) * 2 - 1

      osc.connect(gain)
      gain.connect(panner)
      panner.connect(this.filter)

      if (this.reverb) {
        gain.connect(this.reverb)
      }

      osc.start()

      this.oscillators.push(osc)
      this.gainNodes.push(gain)
    }
  }

  snapToScale(midiNote) {
    const rootIdx = ROOT_INDEX[this.root]
    const intervals = SCALES[this.scale]

    const noteInOctave = ((midiNote - rootIdx) % 12 + 12) % 12
    const octave = Math.floor((midiNote - rootIdx) / 12)

    let closest = intervals[0]
    let minDist = 12

    for (const interval of intervals) {
      let dist = Math.abs(noteInOctave - interval)
      if (dist > 6) dist = 12 - dist
      if (dist < minDist) {
        minDist = dist
        closest = interval
      }
    }

    return rootIdx + octave * 12 + closest
  }

  getNoteName(midiNote) {
    const name = NOTE_NAMES[midiNote % 12]
    const octave = Math.floor(midiNote / 12) - 1
    return { name, octave }
  }

  getChordName(intervals) {
    const idxs = intervals.map((i) => i % 12)
    const root = NOTE_NAMES[(ROOT_INDEX[this.root] + idxs[0]) % 12]
    const quality = CHORD_NAMES[Math.floor(Math.random() * CHORD_NAMES.length)]
    return { root, quality }
  }

  update(dt, gestures) {
    if (!this.ctx || this.ctx.state === 'closed') return

    const now = this.ctx.currentTime

    if (gestures.fist && !this.isFrozen) {
      this.isFrozen = true
      this.frozenPitch = this.currentPitch
      this.frozenGain = this.currentGain
      this.frozenFilter = this.currentFilter
      return
    }

    if (!gestures.fist && this.isFrozen) {
      this.isFrozen = false
    }

    let targetPitch, targetGain, targetFilter

    if (this.isFrozen) {
      targetPitch = this.frozenPitch
      targetGain = this.frozenGain
      targetFilter = this.frozenFilter
    } else {
      const hand = gestures.hand
      if (!hand) {
        targetPitch = this.currentPitch
        targetGain = 0
        targetFilter = this.currentFilter
      } else {
        targetPitch = this.snapToScale(36 + Math.round(hand.y * 48))
        targetGain = hand.pinch
        targetFilter = 200 + hand.x * 19800
      }
    }

    if (!this.isFrozen) {
      this.currentPitch = smoothValue(this.currentPitch, targetPitch, 12, dt)
      this.currentGain = smoothValue(this.currentGain, targetGain, 8, dt)
      this.currentFilter = smoothValue(this.currentFilter, targetFilter, 10, dt)
      this.targetPan = gestures.hand?.x ? (gestures.hand.x - 0.5) * 2 : 0
    }

    this.currentPan = smoothValue(this.currentPan, this.targetPan, 5, dt)

    const note = this.getNoteName(Math.round(this.currentPitch))
    if (this.noteCallback) this.noteCallback(note)

    if (this.mode === 'theremin') {
      this.oscillators[0].frequency.setTargetAtTime(
        440 * Math.pow(2, (this.currentPitch - 69) / 12),
        now,
        0.02
      )
      this.gainNodes[0].gain.setTargetAtTime(this.currentGain * 0.3, now, 0.02)
      for (let i = 1; i < this.oscillators.length; i++) {
        this.gainNodes[i].gain.setTargetAtTime(0, now, 0.02)
      }
    } else {
      const intervals = SCALES[this.scale]
      const rootNote = this.currentPitch

      for (let i = 0; i < this.oscillators.length; i++) {
        if (i < intervals.length) {
          const noteOffset = intervals[i]
          const freq = 440 * Math.pow(2, (rootNote + noteOffset - 69) / 12)
          this.oscillators[i].frequency.setTargetAtTime(freq, now, 0.03)
          this.gainNodes[i].gain.setTargetAtTime(this.currentGain * (0.3 / intervals.length), now, 0.03)
        } else {
          this.gainNodes[i].gain.setTargetAtTime(0, now, 0.03)
        }
      }

      if (this.chordCallback) {
        this.chordCallback(this.getChordName(intervals))
      }
    }

    this.filter.frequency.setTargetAtTime(this.currentFilter, now, 0.03)
  }

  getAnalyserData() {
    if (!this.analyser) return new Uint8Array(128)
    const data = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(data)
    return data
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }
}
