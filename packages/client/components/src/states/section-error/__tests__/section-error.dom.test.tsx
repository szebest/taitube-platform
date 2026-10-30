import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { variantNames } from '@vp/ui';
import { axeViolations } from '@vp/web-testing/dom';
import { renderWithCopy } from '../../../__tests__/render-with-copy';
import { SectionError, sectionErrorStyles } from '..';
import type { SectionErrorRootProps } from '../section-error';

const renderSectionError = (props: Partial<SectionErrorRootProps> = {}) =>
  renderWithCopy(
    <SectionError.Root role="alert" onRetry={vi.fn()} {...props}>
      <SectionError.Message>Comments did not load.</SectionError.Message>
      <SectionError.Support>The rest of the page is fine.</SectionError.Support>
    </SectionError.Root>
  );

describe('@vp/components: SectionError', () => {
  it.each(variantNames(sectionErrorStyles.variants.layout))(
    'names the section and reloads only it from the %s layout',
    async (layout) => {
      const onRetry = vi.fn();
      renderSectionError({ layout, onRetry });

      await userEvent.click(screen.getByRole('button', { name: 'retry' }));

      expect(screen.getByRole('alert')).toHaveTextContent('Comments did not load.');
      expect(onRetry).toHaveBeenCalledTimes(1);
    }
  );

  it('shows a busy retry button that ignores clicks while retrying', async () => {
    const onRetry = vi.fn();
    renderSectionError({ onRetry, retrying: true });

    await userEvent.click(screen.getByRole('button', { name: 'retry' }));

    expect(screen.getByRole('button', { name: 'retry' })).toHaveAttribute('aria-busy', 'true');
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('passes axe in every layout and tone', async () => {
    for (const layout of variantNames(sectionErrorStyles.variants.layout)) {
      for (const tone of variantNames(sectionErrorStyles.variants.tone)) {
        renderSectionError({ layout, tone, role: undefined });
      }
    }

    expect(await axeViolations()).toEqual([]);
  });
});
