import { act } from '@testing-library/react';
import { createQueryClient } from '@vp/queries';
import { renderMutation } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { uploadKeys } from '#app/features/upload/api/upload-progress';
import { useUploadProgress } from '../use-upload-progress';

describe('apps/client/studio: useUploadProgress', () => {
  it('reads the bytes the cache holds for its upload id, and follows them as they move', async () => {
    const client = createQueryClient();
    const progress = renderMutation(() => useUploadProgress('upload-1'), client, AppProviders);

    expect(progress.current).toBeUndefined();

    act(() => client.setQueryData(uploadKeys.progress('upload-1'), { loaded: 1, total: 4 }));
    await vi.waitFor(() => expect(progress.current).toEqual({ loaded: 1, total: 4 }));

    act(() => client.setQueryData(uploadKeys.progress('upload-2'), { loaded: 3, total: 4 }));
    act(() => client.setQueryData(uploadKeys.progress('upload-1'), { loaded: 2, total: 4 }));
    await vi.waitFor(() => expect(progress.current).toEqual({ loaded: 2, total: 4 }));
  });
});
