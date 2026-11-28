import { z } from 'zod';
import { useStoredState } from '#app/hooks/use-stored-state';
import { DEFAULT_DUCK_LEVEL } from './voice-ducking';

const DuckSchema = z.object({ enabled: z.boolean(), level: z.number().min(0.2).max(0.8) });
const DEFAULT_DUCK = { enabled: true, level: DEFAULT_DUCK_LEVEL };

/** The one place the viewer's voice choices live: 140e's `party` preferences section replaces these three keys. */
export function useVoiceSettings() {
  const [duck, setDuck] = useStoredState('vp.party.voice.duck', DuckSchema, DEFAULT_DUCK);
  const [pushToTalk, setPushToTalk] = useStoredState(
    'vp.party.voice.pushToTalk',
    z.boolean(),
    false
  );
  const [noiseSuppression, setNoiseSuppression] = useStoredState(
    'vp.party.voice.noiseSuppression',
    z.boolean(),
    true
  );

  return { duck, setDuck, pushToTalk, setPushToTalk, noiseSuppression, setNoiseSuppression };
}
