# HandSynth — Gesture-Controlled Musical Instrument

Play music with your hands using just a webcam. No MIDI, no downloads — runs entirely in the browser.

## How It Works

- **Webcam** captures your hand movements
- **MediaPipe Hands** tracks 21 hand landmarks at ~30fps
- **Web Audio API** synthesizes sound in real-time

## Gestures

| Gesture | Control |
|---------|---------|
| Hand Y position | Pitch / Note selection |
| Hand X position | Filter cutoff |
| Pinch (thumb + index) | Volume |
| Fist | Freeze note/chord |
| Two hands | Chord voicing density |

## Controls

- Root note selector (12 chromatic)
- Scale selector (pentatonic, chromatic, major, minor, blues, whole-tone)
- Waveform selector (sine, triangle, sawtooth, square)
- Mode: Theremin or Chord

## Run

```bash
npm install
npm run dev
```
