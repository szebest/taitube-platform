import { describeProviderContract } from '@kit/di/contract';
import { Container } from '../container';
import { containerProviderSubject } from '../contract';

describeProviderContract(() => containerProviderSubject(new Container()));
