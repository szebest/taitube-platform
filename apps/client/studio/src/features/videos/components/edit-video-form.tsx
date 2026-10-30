import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@vp/api-client';
import { type Video, VIDEO_VISIBILITIES } from '@vp/api-contracts';
import { VideoThumbnail } from '@vp/components';
import { ErrorCodes } from '@vp/errors';
import { useAppForm } from '@vp/forms';
import { useT } from '@vp/intl-react';
import { useApi, videoQueryOptions } from '@vp/queries';
import { Button, useToast } from '@vp/ui';
import { useState } from 'react';

import { categoriesQueryOptions } from '../api/category-queries';
import { type EditVideoValues, NO_CATEGORY, editOf, valuesOf } from '../forms/edit-video-values';
import {
  validateVideoDescription,
  validateVideoTags,
  validateVideoTitle,
} from '../forms/video-field-validators';
import { useUpdateVideo } from '../hooks/use-update-video';
import { DescriptionPreview } from './description-preview';
import { VersionConflictDialog } from './version-conflict-dialog';

function isVersionConflict(error: Error): boolean {
  return error instanceof ApiError && error.code === ErrorCodes.VERSION_CONFLICT;
}

/** The metadata editor: validates with the API's own rules and saves against the version it loaded. */
export function EditVideoForm({ video }: { video: Video }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { tOr } = useT();
  const [conflict, setConflict] = useState(false);
  const edit = useUpdateVideo(video.id);
  const categories = useQuery(categoriesQueryOptions(api));

  const save = (values: EditVideoValues, version: number) =>
    edit.mutate(editOf(values, version), {
      onSuccess: () => toast({ title: tOr('studio.editSaved', {}, ''), tone: 'success' }),
      onError: (error) => {
        if (isVersionConflict(error)) {
          setConflict(true);
          return;
        }
        toast({ title: tOr('studio.editFailed', {}, ''), tone: 'danger' });
      },
    });

  const form = useAppForm({
    defaultValues: valuesOf(video),
    onSubmit: ({ value }) => save(value, video.version),
  });

  const latest = () => queryClient.fetchQuery({ ...videoQueryOptions(api, video.id), staleTime: 0 });

  const reload = async () => {
    form.reset(valuesOf(await latest()));
    setConflict(false);
  };

  const overwrite = async () => {
    const { version } = await latest();
    setConflict(false);
    save(form.state.values, version);
  };

  const categoryNames = new Map(categories.data?.map(({ id, name }) => [id, name]));
  const categoryIds = [NO_CATEGORY, ...categoryNames.keys()];

  return (
    <form
      className="tw:flex tw:flex-col tw:gap-stack"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="title" validators={{ onChange: validateVideoTitle }}>
        {(field) => <field.TextField label={tOr('studio.editFieldTitle', {}, '')} />}
      </form.AppField>

      <form.AppField name="description" validators={{ onChange: validateVideoDescription }}>
        {(field) => (
          <>
            <field.TextField multiline label={tOr('studio.editFieldDescription', {}, '')} />
            <DescriptionPreview markdown={field.state.value} />
          </>
        )}
      </form.AppField>

      <form.AppField name="visibility">
        {(field) => (
          <field.SelectField
            label={tOr('studio.editFieldVisibility', {}, '')}
            options={VIDEO_VISIBILITIES}
            labelOf={(visibility) => tOr('videos.visibility', { visibility }, '')}
          />
        )}
      </form.AppField>

      <form.AppField name="categoryId">
        {(field) => (
          <>
            <field.SelectField
              label={tOr('studio.editFieldCategory', {}, '')}
              options={categoryIds}
              labelOf={(id) =>
                id === NO_CATEGORY
                  ? tOr('studio.editCategoryNone', {}, '')
                  : (categoryNames.get(id) ?? id)
              }
            />
            {categories.isError && <p role="alert">{tOr('studio.editCategoriesFailed', {}, '')}</p>}
          </>
        )}
      </form.AppField>

      <form.AppField name="tags" validators={{ onChange: validateVideoTags }}>
        {(field) => (
          <field.ChipsField
            label={tOr('studio.editFieldTags', {}, '')}
            placeholder={tOr('studio.editTagsPlaceholder', {}, '')}
            removeLabel={(tag) => tOr('studio.editTagRemove', { tag }, '')}
          />
        )}
      </form.AppField>

      <form.AppField name="usePoster">
        {(field) => (
          <fieldset className="tw:flex tw:flex-col tw:gap-inline">
            <legend className="tw:text-label">{tOr('studio.editThumbnailTitle', {}, '')}</legend>
            <VideoThumbnail.Root className="tw:w-60">
              <VideoThumbnail.Image
                alt={tOr('studio.editThumbnailAlt', {}, '')}
                src={field.state.value ? video.posterUrl : video.thumbnailUrl}
              />
            </VideoThumbnail.Root>
            {video.posterUrl !== undefined && video.thumbnailUrl !== video.posterUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={field.state.value}
                onClick={() => field.handleChange(!field.state.value)}
              >
                {tOr('studio.editThumbnailPoster', {}, '')}
              </Button>
            )}
          </fieldset>
        )}
      </form.AppField>

      <form.Subscribe selector={(state) => state.canSubmit}>
        {(canSubmit) => (
          <Button
            type="submit"
            variant="solid"
            tone="accent"
            className="tw:self-start"
            disabled={!canSubmit || edit.isPending}
          >
            {tOr('studio.editSave', {}, '')}
          </Button>
        )}
      </form.Subscribe>

      <VersionConflictDialog
        open={conflict}
        onOpenChange={setConflict}
        onReload={() => void reload()}
        onOverwrite={() => void overwrite()}
      />
    </form>
  );
}
