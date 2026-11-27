import { useAppForm } from '@kit/forms';
import { Badge, Field, Icon, IconButton, Input, SortableList, Tabs, Textarea } from '@kit/ui';
import { CHANNEL_IMAGE_CONTENT_TYPES } from '@vp/validation';
import { useT } from '#app/lib/messages';
import { POST_LIMITS } from './constants';
import { PostComposerCount } from './post-composer-count';
import { usePostComposer } from './post-composer.context';
import type { ImageDraft, ImageStatus } from './types';

const IMAGE_ACCEPT = Object.fromEntries(CHANNEL_IMAGE_CONTENT_TYPES.map((type) => [type, []]));

const STATUS_TONE = {
  uploading: 'neutral',
  ready: 'success',
  failed: 'danger',
} as const satisfies Record<ImageStatus, string>;

export interface PostComposerImagesProps {
  /** The files the creator dropped or chose, at most as many as the post still has room for. */
  onFiles: (files: File[]) => void;
  /** Why the last files were turned away, in words. */
  refusal?: string;
}

function ImageRow({ image, position }: { image: ImageDraft; position: number }) {
  const { tOr } = useT();
  const { update } = usePostComposer('Images');
  const patch = (next: Partial<ImageDraft>) =>
    update((draft) => ({
      ...draft,
      images: draft.images.map((other) =>
        other.key === image.key ? { ...other, ...next } : other
      ),
    }));

  return (
    <SortableList.Item
      id={image.key}
      aria-label={tOr('studio.composerImageName', { position }, '')}
      className="flex items-start gap-stack"
    >
      <SortableList.Handle />
      <img src={image.previewUrl} alt="" className="size-20 shrink-0 rounded-sm object-cover" />
      <Field.Root required size="sm" className="min-w-0 flex-1">
        <Field.Label>{tOr('studio.composerImageAlt', { position }, '')}</Field.Label>
        <Input value={image.alt} onChange={(event) => patch({ alt: event.target.value })} />
        <Field.Hint>
          <PostComposerCount length={image.alt.length} max={POST_LIMITS.alt} />
        </Field.Hint>
      </Field.Root>
      <div className="flex flex-col items-end gap-inline">
        <Badge size="sm" tone={STATUS_TONE[image.status]}>
          {tOr('studio.composerImageStatus', { status: image.status }, '')}
        </Badge>
        <IconButton
          size="sm"
          aria-label={tOr('studio.composerImageRemove', { position }, '')}
          onClick={() =>
            update((draft) => ({
              ...draft,
              images: draft.images.filter((other) => other.key !== image.key),
            }))
          }
        >
          <Icon name="trash" />
        </IconButton>
      </div>
    </SortableList.Item>
  );
}

/** Up to four pictures: a drop zone, each picture's alt text, and their order by drag or keyboard. */
export function PostComposerImages({ onFiles, refusal }: PostComposerImagesProps) {
  const { tOr } = useT();
  const { draft, change, update } = usePostComposer('Images');
  const form = useAppForm({ defaultValues: { file: [] as File[] } });
  const room = POST_LIMITS.images - draft.images.length;

  return (
    <Tabs.Panel value="images" className="flex flex-col gap-stack">
      {room > 0 ? (
        <form.AppField
          name="file"
          listeners={{
            onChange: ({ value }) => {
              if (value.length === 0) return;
              onFiles(value.slice(0, room));
              form.reset();
            },
          }}
        >
          {(field) => (
            <field.FileField
              multiple
              accept={IMAGE_ACCEPT}
              placeholderText={tOr('studio.composerImagesDrop', {}, '')}
              selectedText={(count) => tOr('studio.selectedFiles', { count }, '')}
            />
          )}
        </form.AppField>
      ) : (
        <p className="m-0 text-body-sm text-fg-muted">{tOr('studio.composerImagesFull', {}, '')}</p>
      )}
      {refusal && (
        <p role="alert" className="m-0 text-body-sm text-danger-ink">
          {refusal}
        </p>
      )}
      {draft.images.length > 0 && (
        <SortableList.Root
          items={draft.images.map(({ key }) => key)}
          onReorder={(order) =>
            update((current) => ({
              ...current,
              images: order.flatMap((key) => current.images.filter((image) => image.key === key)),
            }))
          }
          aria-label={tOr('studio.composerImagesLabel', {}, '')}
          className="m-0 flex list-none flex-col gap-stack p-0"
        >
          {draft.images.map((image, index) => (
            <ImageRow key={image.key} image={image} position={index + 1} />
          ))}
        </SortableList.Root>
      )}
      <Field.Root>
        <Field.Label>{tOr('studio.composerCaptionLabel', {}, '')}</Field.Label>
        <Textarea
          autoGrow
          value={draft.caption}
          onChange={(event) => change({ caption: event.target.value })}
        />
        <Field.Hint>
          <PostComposerCount length={draft.caption.length} max={POST_LIMITS.caption} />
        </Field.Hint>
      </Field.Root>
    </Tabs.Panel>
  );
}
