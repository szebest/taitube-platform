import { useT } from '@vp/intl-react';
import { Button, createCompoundContext } from '@vp/ui';
import type { PropsWithChildren } from 'react';
import { ImagePreview } from '../image-preview/image-preview';

type ImageState = {
  kind: 'avatar' | 'banner';
  currentUrl: string | null;
};

const [ImageContext, useImage] = createCompoundContext<ImageState>('ChannelImage');

function ImageRoot({ kind, currentUrl, children }: PropsWithChildren<ImageState>) {
  return (
    <ImageContext value={{ kind, currentUrl }}>
      <div data-slot="channel-image" className="flex flex-col gap-stack">
        {children}
      </div>
    </ImageContext>
  );
}

function ImageShown() {
  const { kind, currentUrl } = useImage('Shown');
  const { tOr } = useT();

  if (!currentUrl) return null;
  return <ImagePreview kind={kind} src={currentUrl} label={tOr(`studio.${kind}Preview`, {}, '')} />;
}

function ImageRemove({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  const { kind, currentUrl } = useImage('Remove');
  const { tOr } = useT();

  if (!currentUrl) return null;
  return (
    <Button variant="ghost" onClick={onClick} loading={loading}>
      {tOr(`studio.${kind}Remove`, {}, '')}
    </Button>
  );
}

export const ChannelImage = { Root: ImageRoot, Shown: ImageShown, Remove: ImageRemove };
