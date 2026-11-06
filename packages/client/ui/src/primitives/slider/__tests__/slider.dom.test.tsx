import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { variantNames } from '../../../lib/variant-names';
import { Slider } from '..';
import type { SliderRootProps } from '../slider';
import { sliderStyles } from '../slider.variants';

const renderVolume = (props: SliderRootProps = {}) => {
  const onValueChange = vi.fn();
  const user = userEvent.setup();
  return {
    user,
    onValueChange,
    ...render(
      <Slider.Root defaultValue={[40]} step={10} onValueChange={onValueChange} {...props}>
        <Slider.Thumb aria-label="Volume" aria-valuetext="40 percent" />
      </Slider.Root>
    ),
  };
};

describe('@vp/ui: Slider', () => {
  it.each(variantNames(sliderStyles.variants.tone))(
    'is a %s slider moved a step by the arrows and to the ends by Home and End',
    async (tone) => {
      const { user, onValueChange } = renderVolume({ tone });
      await user.tab();

      await user.keyboard('{ArrowRight}');
      expect(onValueChange).toHaveBeenLastCalledWith([50]);
      await user.keyboard('{Home}');
      expect(onValueChange).toHaveBeenLastCalledWith([0]);

      expect(screen.getByRole('slider', { name: 'Volume' })).toHaveAttribute(
        'aria-valuetext',
        '40 percent'
      );
    }
  );

  it('passes axe', async () => {
    renderVolume({ orientation: 'vertical', size: 'lg' });

    expect(await axeViolations()).toEqual([]);
  });
});
