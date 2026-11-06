import { useT } from '@vp/intl-react';
import { Button, createCompoundContext } from '@vp/ui';
import type { ComponentPropsWithRef, PropsWithChildren } from 'react';
import { useObjectUrl } from '../hooks/use-object-url';
import { ImagePreview } from './image-preview';

type ImageState = {
  kind: 'avatar' | 'banner';
  file: File | undefined;
  currentUrl: string | null;
  removed: boolean;
};

const [ImageContext, useImage] = createCompoundContext<ImageState>('ChannelImage');

function ImageRoot({ kind, file, currentUrl, removed, children }: PropsWithChildren<ImageState>) {
  return (
    <ImageContext value={{ kind, file, currentUrl, removed }}>
      <div data-slot="channel-image" className="flex flex-col gap-stack">
        {children}
      </div>
    </ImageContext>
  );
}

function shownAddress({ file, currentUrl, removed }: ImageState, local: string | undefined) {
  if (file) return local;
  return removed ? undefined : (currentUrl ?? undefined);
}

function ImageShown() {
  const image = useImage('Shown');
  const { tOr } = useT();
  const src = shownAddress(image, useObjectUrl(image.file));

  if (!src) return null;
  return (
    <ImagePreview kind={image.kind} src={src} label={tOr(`studio.${image.kind}Preview`, {}, '')} />
  );
}

function ImageRemove({ onClick }: Pick<ComponentPropsWithRef<'button'>, 'onClick'>) {
  const { kind, file, currentUrl, removed } = useImage('Remove');
  const { tOr } = useT();

  if (!file && (removed || !currentUrl)) return null;
  return (
    <Button variant="ghost" onClick={onClick}>
      {tOr(`studio.${kind}Remove`, {}, '')}
    </Button>
  );
}

export const ChannelImage = { Root: ImageRoot, Shown: ImageShown, Remove: ImageRemove };
