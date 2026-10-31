import { PageHeader } from '@vp/components';
import { useT } from '@vp/intl-react';
import { Can } from '@vp/permissions-react';
import { useAccount } from '@vp/queries';

import { AboutSection } from './about-section';
import { BrandingSection } from './branding-section';
import { IdentitySection } from './identity-section';
import { StartHereSection } from './start-here-section';

/** The channel's settings as a list of sections, each saved on its own. */
export function CustomizationPage() {
  const channel = useAccount()?.channel;
  const { tOr } = useT();

  return (
    <>
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('studio.customizationTitle', {}, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      {channel !== undefined && (
        <div className="tw:flex tw:flex-col tw:gap-stack">
          <IdentitySection channel={channel} />
          <AboutSection channel={channel} />
          <BrandingSection channel={channel} />
          <Can type="ability" do="pin" on="Video">
            <StartHereSection channel={channel} />
          </Can>
        </div>
      )}
    </>
  );
}
