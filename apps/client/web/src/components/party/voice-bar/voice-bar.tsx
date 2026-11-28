import { Button, VisuallyHidden } from '@kit/ui';
import type { ComponentPropsWithRef, PointerEvent, ReactNode } from 'react';
import { useT } from '#app/lib/messages';

/** The voice controls under the stage: what the viewer says, who talks, and what to do about it. */
export function VoiceBarRoot({ className, ...props }: ComponentPropsWithRef<'section'>) {
  const { tOr } = useT();

  return (
    <section
      data-slot="voice-bar"
      aria-label={tOr('party.voiceTitle', {}, '')}
      className={`flex flex-wrap items-center gap-inline ${className ?? ''}`}
      {...props}
    />
  );
}

/** The screen-reader line of who is talking; the caller throttles it to once a second. */
export function VoiceBarTalking({ names }: { names: readonly string[] }) {
  const { tOr } = useT();

  return (
    <p role="status" aria-live="polite" className="m-0 text-body-sm text-fg-muted">
      {names.length > 0 && tOr('party.voiceTalking', { names: names.join(', ') }, '')}
      {names.length === 0 && <VisuallyHidden>{tOr('party.voiceSilent', {}, '')}</VisuallyHidden>}
    </p>
  );
}

export interface VoiceBarNoticeProps {
  children: ReactNode;
  /** The one thing the notice offers: resume, reconnect, request, dismiss. */
  action?: { label: string; onAction: () => void };
}

export function VoiceBarNotice({ children, action }: VoiceBarNoticeProps) {
  return (
    <p data-slot="voice-bar-notice" className="m-0 flex items-center gap-inline text-body-sm">
      <span>{children}</span>
      {action && (
        <Button size="sm" variant="soft" onClick={action.onAction}>
          {action.label}
        </Button>
      )}
    </p>
  );
}

export interface VoiceBarHoldProps {
  held: boolean;
  onHeldChange: (held: boolean) => void;
  /** The small button of the landscape fullscreen player. */
  compact?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Hold to talk: 44 px, and its pressed state is what a screen reader hears. */
export function VoiceBarHold({
  held,
  onHeldChange,
  compact = false,
  disabled,
  className,
}: VoiceBarHoldProps) {
  const { tOr } = useT();

  const press = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    onHeldChange(true);
  };

  return (
    <Button
      data-slot="voice-bar-hold"
      aria-pressed={held}
      size={compact ? 'sm' : 'md'}
      variant={held ? 'solid' : 'soft'}
      tone="accent"
      disabled={disabled}
      className={`min-h-11 min-w-11 touch-none select-none ${className ?? ''}`}
      onPointerDown={press}
      onPointerUp={() => onHeldChange(false)}
      onPointerCancel={() => onHeldChange(false)}
    >
      {tOr(held ? 'party.voiceTalkingNow' : 'party.voiceHoldToTalk', {}, '')}
    </Button>
  );
}
