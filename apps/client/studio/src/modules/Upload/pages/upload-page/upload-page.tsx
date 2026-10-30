import { PageHeader } from '@vp/components';
import { useT } from '@vp/intl-react';

import { useUploadVideo } from '#app/features/upload/hooks/use-upload-video';

import { VideoForm, type UploadFormValues } from '#app/modules/Upload/components';

export function UploadPage() {
  const upload = useUploadVideo();
  const { tOr } = useT();

  const submit = ({ file: [file], title, visibility }: UploadFormValues) => {
    if (!file) return;

    upload.mutate({
      file,
      filename: file.name,
      sizeBytes: file.size,
      contentType: file.type,
      title,
      visibility,
    });
  };

  return (
    <>
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('studio.uploadTitle', {}, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      <VideoForm
        submit={submit}
        isError={upload.isError}
        isSuccess={upload.isSuccess}
        progress={upload.progress}
        reset={upload.reset}
        cancel={upload.cancel}
        data={upload.data}
      />
    </>
  );
}
