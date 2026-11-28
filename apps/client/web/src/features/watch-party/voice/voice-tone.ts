const TONE_HZ = 440;
const TONE_MS = 400;

/** A short beep on the default output, so the viewer can tell the output they picked works. */
export async function playTestTone(): Promise<void> {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = TONE_HZ;
  gain.gain.value = 0.15;
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  await new Promise((resolve) => setTimeout(resolve, TONE_MS));
  oscillator.stop();
  await context.close();
}
