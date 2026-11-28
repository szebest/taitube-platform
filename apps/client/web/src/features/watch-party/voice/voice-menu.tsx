import { Button, Popover, Select, Switch } from '@kit/ui';
import { useEffect, useState } from 'react';
import { useT } from '#app/lib/messages';
import { useVoice } from './voice-context';
import type { VoiceDevices } from './voice-port';
import { playTestTone } from './voice-tone';

const METER_MS = 100;
const NO_DEVICES: VoiceDevices = { inputs: [], outputs: [], canSelectOutput: false };

function InputMeter({ read }: { read: () => number }) {
  const { tOr } = useT();
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setLevel(read()), METER_MS);
    return () => clearInterval(timer);
  }, [read]);

  return (
    <progress
      aria-label={tOr('party.voiceInputLevel', {}, '')}
      className="h-2 w-full"
      max={1}
      value={Math.min(1, level)}
    />
  );
}

interface DevicePickProps {
  label: string;
  devices: VoiceDevices['inputs'];
  onPick: (id: string) => void;
}

function DevicePick({ label, devices, onPick }: DevicePickProps) {
  return (
    <label className="flex flex-col gap-1 text-label">
      {label}
      <Select.Root onValueChange={onPick}>
        <Select.Trigger aria-label={label}>
          <Select.Value placeholder={label} />
        </Select.Trigger>
        <Select.Content>
          {devices.map(({ id, label: name }) => (
            <Select.Item key={id} value={id}>
              {name}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </label>
  );
}

/** Microphone and output, an input meter, a test tone and the noise suppression switch. */
export function VoiceMenu() {
  const voice = useVoice();
  const { tOr } = useT();
  const [devices, setDevices] = useState(NO_DEVICES);
  const engine = voice?.session?.engine;

  const refresh = (open: boolean) => {
    if (open) void engine?.listDevices().then(setDevices);
  };

  if (!voice || !engine) {
    return null;
  }

  return (
    <Popover.Root onOpenChange={refresh}>
      <Popover.Trigger asChild>
        <Button size="sm" variant="soft">
          {tOr('party.voiceMenu', {}, '')}
        </Button>
      </Popover.Trigger>
      <Popover.Content align="end" className="flex w-72 flex-col gap-stack">
        <DevicePick
          label={tOr('party.voiceMicrophone', {}, '')}
          devices={devices.inputs}
          onPick={(id) => void engine.selectInput(id)}
        />
        {devices.canSelectOutput && (
          <DevicePick
            label={tOr('party.voiceOutput', {}, '')}
            devices={devices.outputs}
            onPick={(id) => void engine.selectOutput(id)}
          />
        )}
        <InputMeter read={engine.inputLevel} />
        <Button size="sm" variant="soft" onClick={() => void playTestTone()}>
          {tOr('party.voiceTestTone', {}, '')}
        </Button>
        <label className="flex items-center justify-between gap-inline text-label">
          {tOr('party.voiceNoiseSuppression', {}, '')}
          <Switch checked={voice.noiseSuppression} onCheckedChange={voice.setNoiseSuppression} />
        </label>
        <label className="flex items-center justify-between gap-inline text-label">
          {tOr('party.voiceDuck', {}, '')}
          <Switch
            checked={voice.settings.duck.enabled}
            onCheckedChange={(enabled) =>
              voice.settings.setDuck({ ...voice.settings.duck, enabled })
            }
          />
        </label>
        {!voice.pushToTalkLocked && (
          <label className="flex items-center justify-between gap-inline text-label">
            {tOr('party.voicePushToTalk', {}, '')}
            <Switch checked={voice.settings.pushToTalk} onCheckedChange={voice.setPushToTalk} />
          </label>
        )}
      </Popover.Content>
    </Popover.Root>
  );
}
