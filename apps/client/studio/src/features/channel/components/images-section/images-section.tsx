import type { Channel } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { CustomizationSection } from '#app/components/section/customization-section';
import { ChannelImageEditor } from '../channel-image-editor/channel-image-editor';

/** The channel's picture and banner: each is framed in the cropper and processed on its own, with no section save. */
export function ImagesSection({ channel }: { channel: Channel }) {
  const { tOr } = useT();

  return (
    <CustomizationSection.Root onSubmit={(event) => event.preventDefault()}>
      <CustomizationSection.Header>
        <CustomizationSection.Title>{tOr('studio.imagesTitle', {}, '')}</CustomizationSection.Title>
        <CustomizationSection.Description>
          {tOr('studio.imagesDescription', {}, '')}
        </CustomizationSection.Description>
      </CustomizationSection.Header>
      <CustomizationSection.Body>
        <ChannelImageEditor kind="avatar" currentUrl={channel.avatarUrl ?? null} />
        <ChannelImageEditor kind="banner" currentUrl={channel.bannerUrl ?? null} />
      </CustomizationSection.Body>
    </CustomizationSection.Root>
  );
}
