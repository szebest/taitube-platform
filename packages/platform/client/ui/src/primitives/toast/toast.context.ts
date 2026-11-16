import { createCompoundContext } from '../../lib/create-compound-context';
import type { ToastTone } from './types';

export const [ToastContext, useToastItem] = createCompoundContext<{ tone: ToastTone }>('Toast');
