import { Button, Dialog, SegmentedControl } from '@kit/ui';
import {
  CHANNEL_LAYOUT_TEMPLATES,
  type ChannelLayout,
  type ChannelLayoutTemplate,
  channelLayoutTemplate,
} from '@vp/domain';
import { useState } from 'react';
import { useT } from '#app/lib/messages';

export interface TemplateDialogProps {
  onApply: (layout: ChannelLayout) => void;
  onClose: () => void;
}

const isTemplate = (value: string): value is ChannelLayoutTemplate =>
  CHANNEL_LAYOUT_TEMPLATES.some((template) => template === value);

/** Starts the page over from a template; it asks first, since it replaces the draft (and only the draft). */
export function TemplateDialog({ onApply, onClose }: TemplateDialogProps) {
  const { tOr } = useT();
  const [template, setTemplate] = useState<ChannelLayoutTemplate>('creator_starter');

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content size="md">
        <Dialog.Header>
          <Dialog.Title>{tOr('studio.pageTemplateTitle', {}, '')}</Dialog.Title>
          <Dialog.Description>{tOr('studio.pageTemplateDescription', {}, '')}</Dialog.Description>
        </Dialog.Header>
        <Dialog.Body className="flex flex-col gap-stack">
          <SegmentedControl.Root
            aria-label={tOr('studio.pageTemplateLabel', {}, '')}
            value={template}
            onValueChange={(next) => isTemplate(next) && setTemplate(next)}
          >
            {CHANNEL_LAYOUT_TEMPLATES.map((choice) => (
              <SegmentedControl.Item key={choice} value={choice}>
                {tOr('studio.pageTemplateOption', { kind: choice }, '')}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>
          <p className="m-0 text-body-sm text-fg-muted">
            {tOr('studio.pageTemplateAbout', { kind: template }, '')}
          </p>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close asChild>
            <Button variant="outline">{tOr('studio.pageCancel', {}, '')}</Button>
          </Dialog.Close>
          <Button
            variant="solid"
            tone="danger"
            onClick={() => {
              onApply(channelLayoutTemplate(template));
              onClose();
            }}
          >
            {tOr('studio.pageTemplateApply', {}, '')}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
