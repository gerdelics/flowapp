// A single shared AudioContext is reused for every beep. Creating a new
// AudioContext per call leaks hardware audio resources (browsers cap the number
// of live contexts at ~6) and is comparatively expensive on mobile.
let sharedContext = null

function getAudioContext() {
  if (typeof window === 'undefined') {
    return null
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) {
    return null
  }

  if (!sharedContext) {
    sharedContext = new AudioContextClass()
  }

  return sharedContext
}

export function playNotificationBeep() {
  const context = getAudioContext()
  if (!context) {
    return
  }

  // The context can be suspended by the browser's autoplay policy or after the
  // tab was backgrounded; resume it before scheduling the tone.
  if (context.state === 'suspended') {
    context.resume().catch(() => {
      // Ignore resume failures (e.g. no user gesture yet).
    })
  }

  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = 1040
  gain.gain.value = 0.06

  oscillator.connect(gain)
  gain.connect(context.destination)

  oscillator.start()
  oscillator.stop(context.currentTime + 0.12)
}
