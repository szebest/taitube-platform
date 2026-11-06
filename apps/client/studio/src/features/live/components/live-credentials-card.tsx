import type { LiveStreamView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { Card } from '@vp/ui';
import { useId } from 'react';

import { CredentialField } from '#app/components/live/credential-field';
import { useCopyField } from '../hooks/use-copy-field';
import { useOrigin } from '../hooks/use-origin';

const OVERLAY_WIDGETS = ['chat', 'alerts', 'goal'] as const;

type Ingest = NonNullable<LiveStreamView['ingest']>;

export interface LiveCredentialsCardProps {
  ingest: Ingest;
}

interface CredentialRowProps {
  label: string;
  value: string;
  secret?: boolean;
}

function CredentialRow({ label, value, secret = false }: CredentialRowProps) {
  const { tOr } = useT();
  const copy = useCopyField();

  return (
    <CredentialField.Root secret={secret}>
      <CredentialField.Label>{label}</CredentialField.Label>
      <CredentialField.Value>{value}</CredentialField.Value>
      <div className="flex items-center gap-inline">
        <CredentialField.Reveal
          showLabel={tOr('studio.liveRevealField', { label }, '')}
          hideLabel={tOr('studio.liveHideField', { label }, '')}
        />
        <CredentialField.Copy onClick={() => copy(label, value)}>
          {tOr('studio.liveCopyField', { label }, '')}
        </CredentialField.Copy>
      </div>
    </CredentialField.Root>
  );
}

/** Where to publish: the encoder's server and key, the WHIP page, the OBS browser sources and the companion token. */
export function LiveCredentialsCard({ ingest }: LiveCredentialsCardProps) {
  const { tOr } = useT();
  const overlaysId = useId();
  const origin = useOrigin();
  const overlayPath = `/live/overlay/${encodeURIComponent(ingest.overlayToken)}`;

  return (
    <Card.Root>
      <Card.Header>
        <Card.Title asChild>
          <h2>{tOr('studio.liveCredentialsTitle', {}, '')}</h2>
        </Card.Title>
        <Card.Description>{tOr('studio.liveCredentialsDescription', {}, '')}</Card.Description>
      </Card.Header>
      <Card.Body className="flex flex-col gap-stack">
        <CredentialRow label={tOr('studio.liveRtmpUrl', {}, '')} value={ingest.rtmpUrl} />
        <CredentialRow
          label={tOr('studio.liveStreamKey', {}, '')}
          value={ingest.streamKey}
          secret
        />
        <p className="m-0 text-caption text-fg-muted">
          {tOr('studio.liveCredentialsWarning', {}, '')}
        </p>
        <CredentialRow label={tOr('studio.liveWhipUrl', {}, '')} value={ingest.whipUrl} />
        <section aria-labelledby={overlaysId} className="flex flex-col gap-stack">
          <div>
            <h3 id={overlaysId} className="m-0 text-label">
              {tOr('studio.liveOverlaysTitle', {}, '')}
            </h3>
            <p className="m-0 text-caption text-fg-muted">
              {tOr('studio.liveOverlaysHint', {}, '')}
            </p>
          </div>
          {OVERLAY_WIDGETS.map((widget) => (
            <CredentialRow
              key={widget}
              label={tOr('studio.liveOverlay', { widget }, '')}
              value={`${origin}${overlayPath}?widget=${widget}`}
            />
          ))}
        </section>
        <CredentialRow
          label={tOr('studio.liveControlToken', {}, '')}
          value={ingest.controlToken}
          secret
        />
      </Card.Body>
    </Card.Root>
  );
}
