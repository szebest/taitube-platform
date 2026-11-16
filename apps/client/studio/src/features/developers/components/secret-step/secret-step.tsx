import { useT } from '@vp/intl-react';
import { ResponsiveModal } from '@vp/ui';
import { SecretReveal } from '#app/components/developers/secret-reveal';
import { useCopyField } from '#app/hooks/use-copy-field';

export interface SecretStepProps {
  title: string;
  notice: string;
  label: string;
  saved: string;
  secret: string;
  onDone: () => void;
}

/** The second step of a create dialog: the secret the API returned once, kept until the creator says it is saved. */
export function SecretStep({ title, notice, label, saved, secret, onDone }: SecretStepProps) {
  const { tOr } = useT();
  const copy = useCopyField();

  return (
    <SecretReveal.Root value={secret}>
      <ResponsiveModal.Header>
        <ResponsiveModal.Title>{title}</ResponsiveModal.Title>
      </ResponsiveModal.Header>
      <ResponsiveModal.Body className="flex flex-col gap-stack">
        <ResponsiveModal.Description asChild>
          <SecretReveal.Notice>{notice}</SecretReveal.Notice>
        </ResponsiveModal.Description>
        <SecretReveal.Label>{label}</SecretReveal.Label>
        <div className="flex items-center gap-inline">
          <SecretReveal.Value />
          <SecretReveal.Copy onCopy={(value) => copy(label, value)} />
        </div>
        <SecretReveal.Acknowledge>{saved}</SecretReveal.Acknowledge>
      </ResponsiveModal.Body>
      <ResponsiveModal.Footer>
        <SecretReveal.Done onClick={onDone}>{tOr('studio.secretDone', {}, '')}</SecretReveal.Done>
      </ResponsiveModal.Footer>
    </SecretReveal.Root>
  );
}
