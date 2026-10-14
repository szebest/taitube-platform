import { environmentManager } from '@tanstack/react-query';
import { withLivePage } from './live-page';

// query-core freezes its server check at first import, and node specs stub window.
environmentManager.setIsServer(() => true);

vi.mock(import('react'), async (importOriginal) => withLivePage(await importOriginal()));
