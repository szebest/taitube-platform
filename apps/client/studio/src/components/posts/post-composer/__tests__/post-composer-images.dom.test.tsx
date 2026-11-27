import { axeViolations } from '@kit/web-testing/dom';
import { screen, waitFor } from '@testing-library/react';
import { PostComposer } from '../index';
import type { ImageDraft } from '../types';
import { renderComposer } from './render-composer';

const picture = (key: string, patch: Partial<ImageDraft> = {}): ImageDraft => ({
  key,
  fileName: `${key}.png`,
  previewUrl: 'blob:preview',
  uploadId: key,
  alt: `Alt ${key}`,
  status: 'ready',
  ...patch,
});

function renderImages(images: ImageDraft[] = [], refusal?: string) {
  const onFiles = vi.fn();
  return {
    onFiles,
    ...renderComposer(<PostComposer.Images onFiles={onFiles} refusal={refusal} />, {
      initial: { kind: 'images', images },
    }),
  };
}

describe('apps/client/studio: PostComposerImages', () => {
  it('hands the files dropped in to the caller', async () => {
    const { user, onFiles, container } = renderImages();
    const file = new File(['x'], 'me.png', { type: 'image/png' });

    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);

    await waitFor(() => expect(onFiles).toHaveBeenCalledWith([file]));
  });

  it('offers no more room at four pictures', () => {
    renderImages(['a', 'b', 'c', 'd'].map((key) => picture(key)));

    expect(screen.getByText('Four pictures is the most a post holds.')).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('writes the alt text of a picture into the draft and counts it against 200', async () => {
    const { user, draft } = renderImages([picture('a', { alt: '' })]);

    await user.type(screen.getByRole('textbox', { name: /Alt text for picture 1/ }), 'A desk');

    expect(draft().images[0]?.alt).toBe('A desk');
    expect(screen.getByText('6 of 200')).toBeInTheDocument();
  });

  it('removes a picture from the draft', async () => {
    const { user, draft } = renderImages([picture('a'), picture('b')]);

    await user.click(screen.getByRole('button', { name: 'Remove picture 1' }));

    expect(draft().images.map(({ key }) => key)).toEqual(['b']);
  });

  it.each([
    { status: 'uploading', badge: 'Uploading' },
    { status: 'ready', badge: 'Ready' },
    { status: 'failed', badge: 'Upload failed' },
  ] as const)('says a $status picture is "$badge"', ({ status, badge }) => {
    renderImages([picture('a', { status })]);

    expect(screen.getByText(badge)).toBeInTheDocument();
  });

  it('says why files were turned away', () => {
    renderImages([], 'This file could not be read as an image.');

    expect(screen.getByRole('alert')).toHaveTextContent('could not be read');
  });

  it('writes the caption into the draft', async () => {
    const { user, draft } = renderImages();

    await user.type(screen.getByRole('textbox', { name: /Caption/ }), 'Backstage');

    expect(draft().caption).toBe('Backstage');
  });

  it('passes axe', async () => {
    renderImages([picture('a'), picture('b', { status: 'uploading' })]);

    expect(await axeViolations()).toEqual([]);
  });
});
