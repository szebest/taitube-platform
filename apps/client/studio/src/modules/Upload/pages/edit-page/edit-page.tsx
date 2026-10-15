import { useSuspenseQuery } from '@tanstack/react-query';
import { useParams, useRouter } from '@tanstack/react-router';
import { ApiError } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';
import { useApi, videoQueryOptions } from '@vp/queries';
import { useToast } from '@vp/ui';

import { useUpdateVideo } from '#app/features/videos/hooks/use-update-video';

import { EditVideoForm, type EditVideoFormValues } from '#app/modules/Upload/components';

function isVersionConflict(error: Error): boolean {
  return error instanceof ApiError && error.code === ErrorCodes.VERSION_CONFLICT;
}

export function EditPage() {
  const { videoId } = useParams({ from: '/_authed/upload/edit/$videoId' });
  const api = useApi();
  const { data: video } = useSuspenseQuery(videoQueryOptions(api, videoId));
  const edit = useUpdateVideo(videoId);
  const router = useRouter();
  const toast = useToast();

  const submit = (form: EditVideoFormValues) => {
    edit.mutate(
      { ...form, version: video.version },
      {
        onSuccess: () => {
          toast({ title: 'Successfully edited the video', variant: 'success' });
          router.history.back();
        },
        onError: (error) => {
          if (!isVersionConflict(error)) return;

          toast({ title: 'The video changed while you were editing it', variant: 'danger' });
        },
      }
    );
  };

  return (
    <>
      <h3>Editing video: {video.title}</h3>
      <EditVideoForm
        submit={submit}
        defaultValues={{
          title: video.title ?? '',
          description: video.description ?? '',
          visibility: video.visibility,
        }}
        isError={edit.isError}
        isLoading={edit.isPending}
      />
    </>
  );
}
