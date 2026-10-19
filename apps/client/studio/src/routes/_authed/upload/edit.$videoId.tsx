import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { ensureFound, parseParam, useApi, videoQueryOptions } from '@vp/queries';
import { z } from 'zod';

import { EditPage } from '#app/modules/Upload';

export const Route = createFileRoute('/_authed/upload/edit/$videoId')({
  staticData: { layoutMaxWidth: '1280px' },
  params: {
    parse: ({ videoId }) => ({ videoId: parseParam(VideoIdParamSchema.shape.id, videoId) }),
    stringify: ({ videoId }) => ({ videoId }),
  },
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api }, params: { videoId } }) =>
    ensureFound(queryClient, videoQueryOptions(api, videoId)),
  component: EditVideoRoute,
});

function EditVideoRoute() {
  const { videoId } = Route.useParams();
  const api = useApi();
  const {
    data: { status, progress },
  } = useSuspenseQuery(videoQueryOptions(api, videoId));
  const { tOr } = useT();

  return (
    <>
      <EditPage />
      <p role="status">{tOr('studio.processing', { status, overall: progress.overall }, '')}</p>
    </>
  );
}
