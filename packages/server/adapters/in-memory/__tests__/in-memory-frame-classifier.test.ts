import { expectOk } from '@vp/testing/result';
import {
  describeFrameClassifierContract,
  solidFrame,
} from '../../__tests__/contract/frame-classifier.contract';
import { InMemoryFrameClassifier } from '../in-memory-frame-classifier';

describeFrameClassifierContract(async () => ({
  classifier: new InMemoryFrameClassifier({ inputSize: 8 }),
  close: async () => {},
}));

describe('InMemoryFrameClassifier', () => {
  it('scores with the function a spec hands it', async () => {
    const classifier = new InMemoryFrameClassifier({
      inputSize: 8,
      score: ({ width }) => width / 10,
    });

    const scores = expectOk(await classifier.classify([solidFrame(8, 0)]));

    expect(classifier.inputSize).toBe(8);
    expect(scores).toEqual([{ nsfw: 0.8 }]);
  });
});
