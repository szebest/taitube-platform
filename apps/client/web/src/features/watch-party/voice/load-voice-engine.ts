import type { VoiceEngine } from './voice-port';

/** The only place the LiveKit client is imported from the page's own code: its chunk loads on the first join. */
export async function loadVoiceEngine(): Promise<VoiceEngine> {
  const { createLivekitEngine } = await import('./livekit-engine');
  return createLivekitEngine();
}
