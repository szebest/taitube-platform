import { describeAppearanceContract } from '@kit/design-tokens/contract';
import { describeAppearanceRegistryContract } from '../../contract';
import { registerTheme } from '../register-theme';
import { appearance } from '../registry';
import { resolveAppearance } from '../resolve';

describeAppearanceContract(() => appearance);

describeAppearanceRegistryContract(() => ({ appearance, resolveAppearance, registerTheme }));
