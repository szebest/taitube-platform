import { describeProviderContract, type ProviderSubject } from '../contract';
import { createRegistry, provide, type Registry } from '../registry';

const subjectOf = (registry: Registry): ProviderSubject => ({
  provide: (wanted, value) => subjectOf(registry.provide(provide(wanted, value))),
  resolve: (wanted) => registry.get(wanted),
});

describeProviderContract(() => subjectOf(createRegistry()));
