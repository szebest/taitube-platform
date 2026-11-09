import { PageHeader } from '@vp/components';
import { useT } from '@vp/intl-react';
import { Can } from '@vp/permissions-react';
import { useActingChannel } from '#app/features/channel/hooks/use-acting-channel';
import { BrandColourSection } from '../brand-colour-section/brand-colour-section';
import { CaptionsDefaultSection } from '../captions-default-section/captions-default-section';
import { IdentitySection } from '../identity-section/identity-section';
import { ImagesSection } from '../images-section/images-section';
import { LinksSection } from '../links-section/links-section';
import { SpotlightSection } from '../spotlight-section/spotlight-section';
import { StartHereSection } from '../start-here-section/start-here-section';

/** The channel's settings as a list of sections, each saved on its own. */
export function CustomizationPage() {
  const channel = useActingChannel();
  const { tOr } = useT();

  return (
    <>
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('studio.customizationTitle', {}, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      {channel !== undefined && (
        <div className="flex flex-col gap-stack">
          <IdentitySection channel={channel} />
          <LinksSection channel={channel} />
          <ImagesSection channel={channel} />
          <BrandColourSection channel={channel} />
          <CaptionsDefaultSection channel={channel} />
          <SpotlightSection />
          <Can type="ability" do="pin" on="Video">
            <StartHereSection channel={channel} />
          </Can>
        </div>
      )}
    </>
  );
}
