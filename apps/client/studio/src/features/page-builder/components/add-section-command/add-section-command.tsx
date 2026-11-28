import { Button, Command, Icon, Popover } from '@kit/ui';
import { SECTION_BLOCKS, type SectionBlock } from '#app/features/page-builder/utils/layout-edits';
import { useT } from '#app/lib/messages';

export interface AddSectionCommandProps {
  disabled: boolean;
  onAdd: (block: SectionBlock) => void;
}

export function AddSectionCommand({ disabled, onAdd }: AddSectionCommandProps) {
  const { tOr } = useT();

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Icon name="plus" />
          {tOr('studio.pageAddSection', {}, '')}
        </Button>
      </Popover.Trigger>
      <Popover.Content align="start" className="p-0">
        <Command.Root aria-label={tOr('studio.pageAddSectionLabel', {}, '')}>
          <Command.Input placeholder={tOr('studio.pageAddSectionSearch', {}, '')} />
          <Command.List>
            <Command.Empty>{tOr('studio.pageAddSectionEmpty', {}, '')}</Command.Empty>
            {SECTION_BLOCKS.map((block) => {
              const name = tOr('studio.pageBlockOption', { kind: block }, '');

              return (
                <Command.Item
                  key={block}
                  value={block}
                  keywords={[name]}
                  onSelect={() => onAdd(block)}
                >
                  {name}
                </Command.Item>
              );
            })}
          </Command.List>
        </Command.Root>
      </Popover.Content>
    </Popover.Root>
  );
}
