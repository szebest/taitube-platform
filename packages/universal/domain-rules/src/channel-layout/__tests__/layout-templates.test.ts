import { expectOk } from '@kit/testing/result';
import { CHANNEL_LAYOUT_TEMPLATES, channelLayoutTemplate } from '@vp/domain';
import { decideLayoutDocument } from '../layout-document.rule';

describe('@vp/domain-rules: channel layout templates', () => {
  it.each(CHANNEL_LAYOUT_TEMPLATES)(
    'lets the %s template through the document rules',
    (template) => {
      expectOk(decideLayoutDocument(channelLayoutTemplate(template), null));
    }
  );
});
