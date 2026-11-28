import { type CaptureOptions, createVoiceSession } from '../voice-port';
import { fakeVoiceEngine } from './fake-voice-engine';

const CAPTURE: CaptureOptions = {
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
};
const GRANT = { url: 'ws://livekit', token: 't', canSpeak: true };

function sessionOn(pushToTalk: boolean) {
  const fake = fakeVoiceEngine();
  const onSelfMuteChange = vi.fn();
  const session = createVoiceSession({
    engine: fake.engine,
    selfIdentity: 'me',
    pushToTalk,
    capture: CAPTURE,
    onSelfMuteChange,
  });
  return { ...fake, session, onSelfMuteChange };
}

describe('apps/client/web: voice port over a fake engine', () => {
  it('counts a speaker as audible unless it is the viewer or muted for them, and unsubscribes the muted', async () => {
    const { session, emit, engine } = sessionOn(false);
    await session.join(GRANT);

    session.setMemberMuted('tom', true);
    emit({ type: 'speakers', identities: ['me', 'ana', 'tom'] });

    expect(session.getSnapshot().speaking).toEqual(['me', 'ana', 'tom']);
    expect(session.getSnapshot().audible).toEqual(['ana']);
    expect(engine.setSubscribed).toHaveBeenCalledWith('tom', false);
  });

  it.each([
    { percent: 150, gain: 1.5 },
    { percent: 250, gain: 2 },
    { percent: -10, gain: 0 },
  ])('sets a member to $percent % as a gain of $gain', async ({ percent, gain }) => {
    const { session, engine } = sessionOn(false);
    await session.join(GRANT);

    session.setMemberVolume('ana', percent);

    expect(engine.setVolume).toHaveBeenCalledWith('ana', gain);
  });

  it('sends nothing in push to talk until the key is held, and again nothing once it is let go', async () => {
    const { session, engine } = sessionOn(true);
    await session.join(GRANT);
    expect(engine.setMicEnabled).not.toHaveBeenCalled();

    session.hold(true);
    session.hold(false);

    expect(engine.setMicEnabled.mock.calls).toEqual([[true], [false]]);
  });

  it('opens the mic on joining in an open room, and a self mute closes it and tells the room', async () => {
    const { session, engine, onSelfMuteChange } = sessionOn(false);
    await session.join(GRANT);
    expect(engine.setMicEnabled).toHaveBeenLastCalledWith(true);

    session.setSelfMuted(true);

    expect(engine.setMicEnabled).toHaveBeenLastCalledWith(false);
    expect(onSelfMuteChange).toHaveBeenCalledWith(true);
  });

  it('never opens the mic of a listener', async () => {
    const { session, engine } = sessionOn(false);
    await session.join({ ...GRANT, canSpeak: false });

    session.hold(true);

    expect(engine.setMicEnabled).not.toHaveBeenCalled();
  });

  it('stops the mic when the page is hidden and keeps it stopped until it is resumed', async () => {
    const { session, engine } = sessionOn(false);
    await session.join(GRANT);

    session.setPageHidden(true);
    expect(engine.setMicEnabled).toHaveBeenLastCalledWith(false);
    expect(session.getSnapshot().micPaused).toBe(true);

    session.resumeMic();
    expect(engine.setMicEnabled).toHaveBeenLastCalledWith(true);
  });

  it('marks the session dropped when the engine loses the connection', async () => {
    const { session, emit } = sessionOn(false);
    await session.join(GRANT);

    emit({ type: 'disconnected' });

    expect(session.getSnapshot().phase).toBe('dropped');
  });
});
