import { Button, Field, Icon, IconButton, Input, Textarea } from '@kit/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { LAYOUT_LIMITS, type LayoutSection } from '@vp/domain';
import { useApi } from '@vp/queries';
import { useState } from 'react';
import { useT } from '#app/lib/messages';

type Of<K extends LayoutSection['kind']> = Extract<LayoutSection, { kind: K }>;

export interface SectionBodyFieldsProps<K extends LayoutSection['kind']> {
  section: Of<K>;
  onChange: (section: Of<K>) => void;
}

export function RichTextFields({ section, onChange }: SectionBodyFieldsProps<'rich_text'>) {
  const { tOr } = useT();

  return (
    <Field.Root>
      <Field.Label>{tOr('studio.pageRichTextLabel', {}, '')}</Field.Label>
      <Textarea
        rows={8}
        maxLength={LAYOUT_LIMITS.richTextChars}
        value={section.body}
        onChange={({ target }) => onChange({ ...section, body: target.value })}
      />
      <Field.Hint>{tOr('studio.pageRichTextHint', {}, '')}</Field.Hint>
    </Field.Root>
  );
}

export function LinksFields({ section, onChange }: SectionBodyFieldsProps<'links'>) {
  const { tOr } = useT();
  const { links } = section;
  const setLink = (index: number, changes: Partial<(typeof links)[number]>) =>
    onChange({
      ...section,
      links: links.map((link, at) => (at === index ? { ...link, ...changes } : link)),
    });

  return (
    <div className="flex flex-col gap-stack">
      {links.map((link, index) => (
        <div key={index} className="flex items-end gap-inline">
          <Field.Root className="flex-1">
            <Field.Label>{tOr('studio.pageLinkLabel', { position: index + 1 }, '')}</Field.Label>
            <Input
              value={link.label}
              onChange={({ target }) => setLink(index, { label: target.value })}
            />
          </Field.Root>
          <Field.Root className="flex-1">
            <Field.Label>{tOr('studio.pageLinkUrl', { position: index + 1 }, '')}</Field.Label>
            <Input
              value={link.url}
              inputMode="url"
              onChange={({ target }) => setLink(index, { url: target.value })}
            />
          </Field.Root>
          <IconButton
            aria-label={tOr('studio.pageLinkRemove', { position: index + 1 }, '')}
            onClick={() => onChange({ ...section, links: links.filter((_, at) => at !== index) })}
          >
            <Icon name="close" size="sm" />
          </IconButton>
        </div>
      ))}
      <Button
        variant="outline"
        disabled={links.length >= LAYOUT_LIMITS.links}
        onClick={() => onChange({ ...section, links: [...links, { label: '', url: '' }] })}
      >
        {tOr('studio.pageLinkAdd', {}, '')}
      </Button>
    </div>
  );
}

function FeaturedChannel({ id, onRemove }: { id: string; onRemove: () => void }) {
  const { tOr } = useT();
  const api = useApi();
  const channel = useQuery({
    queryKey: ['studio', 'page', 'featured-channel', id],
    queryFn: () => api.channels.getChannel({ params: { idOrHandle: id } }),
  });
  const name = channel.data?.displayName ?? id;

  return (
    <li className="flex items-center justify-between gap-inline">
      <span className="truncate text-label">{name}</span>
      <IconButton aria-label={tOr('studio.pageChannelRemove', { name }, '')} onClick={onRemove}>
        <Icon name="close" size="sm" />
      </IconButton>
    </li>
  );
}

export function FeaturedChannelsFields({
  section,
  onChange,
}: SectionBodyFieldsProps<'featured_channels'>) {
  const { tOr } = useT();
  const api = useApi();
  const [handle, setHandle] = useState('');
  const lookup = useMutation({
    mutationFn: (idOrHandle: string) => api.channels.getChannel({ params: { idOrHandle } }),
  });
  const full = section.channelIds.length >= LAYOUT_LIMITS.featuredChannels;

  const add = () =>
    lookup.mutate(handle.trim().replace(/^@/, ''), {
      onSuccess: ({ id }) => {
        setHandle('');
        if (!section.channelIds.includes(id)) {
          onChange({ ...section, channelIds: [...section.channelIds, id] });
        }
      },
    });

  return (
    <div className="flex flex-col gap-stack">
      <ul className="m-0 flex list-none flex-col gap-inline p-0">
        {section.channelIds.map((id) => (
          <FeaturedChannel
            key={id}
            id={id}
            onRemove={() =>
              onChange({ ...section, channelIds: section.channelIds.filter((held) => held !== id) })
            }
          />
        ))}
      </ul>
      <Field.Root>
        <Field.Label>{tOr('studio.pageChannelHandle', {}, '')}</Field.Label>
        <Input value={handle} disabled={full} onChange={({ target }) => setHandle(target.value)} />
        {lookup.isError && <Field.Error>{tOr('studio.pageChannelNotFound', {}, '')}</Field.Error>}
      </Field.Root>
      <Button
        variant="outline"
        disabled={full || handle.trim() === ''}
        loading={lookup.isPending}
        onClick={add}
      >
        {tOr('studio.pageChannelAdd', {}, '')}
      </Button>
    </div>
  );
}
