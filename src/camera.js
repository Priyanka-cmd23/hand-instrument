export async function initCamera(videoElement) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user',
    },
    audio: false,
  })

  videoElement.srcObject = stream
  await videoElement.play()

  return new Promise((resolve) => {
    videoElement.addEventListener('loadeddata', () => {
      resolve(videoElement.videoWidth)
    })
  })
}
