import { serverRender } from '@vp/web-testing/server';
import { z } from 'zod';

import { createUrlModals } from '../create-url-modals';
import { getSpecRouter, modals } from './url-modal.fixture';

describe('createUrlModals', () => {
  it('renders a deep-linked modal open in the server render', async () => {
    const { html } = await serverRender(getSpecRouter, '/library?modal=share&videoId=v7&start=12');

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Share video');
    expect(html).toContain('Video v7 at 12s');
  });

  it.each([
    { case: 'an unknown id', url: '/library?modal=nope' },
    { case: 'invalid params', url: '/library?modal=share&videoId=v1&start=abc' },
    { case: 'no modal key', url: '/library' },
  ])('renders no modal for $case', async ({ url }) => {
    const { html } = await serverRender(getSpecRouter, url);

    expect(html).not.toContain('role="dialog"');
  });

  it('parses a modal with its params and strips the keys it does not know', () => {
    expect(
      modals.searchSchema.parse({ modal: 'share', videoId: 'v1', start: '5', x: '1' })
    ).toEqual({
      modal: 'share',
      videoId: 'v1',
      start: 5,
    });
  });

  it('does not compile for an id the registry lacks, and types params from the modal schema', () => {
    const { useUrlModal } = createUrlModals({ share: z.object({ videoId: z.string() }) });

    const types = () => {
      // @ts-expect-error 'missing' is not in the registry
      useUrlModal('missing');
      const { open, params } = useUrlModal('share');
      // @ts-expect-error videoId is a string
      open({ videoId: 1 });
      return params?.videoId.toUpperCase();
    };

    expect(types).toBeTypeOf('function');
  });
});
