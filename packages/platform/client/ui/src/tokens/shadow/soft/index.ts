import { defineTokenSet } from '@vp/design-tokens';

export const shadowSoft = defineTokenSet('shadow', 'soft', {
  'dark-1': [
    {
      color: '#00000066',
      offsetX: '0px',
      offsetY: '1px',
      blur: '2px',
      spread: '0px',
    },
  ],
  'dark-2': [
    {
      color: '#00000066',
      offsetX: '0px',
      offsetY: '2px',
      blur: '4px',
      spread: '0px',
    },
    {
      color: '#00000073',
      offsetX: '0px',
      offsetY: '18px',
      blur: '40px',
      spread: '-8px',
    },
  ],
  'dark-3': [
    {
      color: '#00000080',
      offsetX: '0px',
      offsetY: '4px',
      blur: '8px',
      spread: '0px',
    },
    {
      color: '#0000008C',
      offsetX: '0px',
      offsetY: '32px',
      blur: '64px',
      spread: '-12px',
    },
  ],
  'light-1': [
    {
      color: '#2A1E1014',
      offsetX: '0px',
      offsetY: '1px',
      blur: '2px',
      spread: '0px',
    },
  ],
  'light-2': [
    {
      color: '#2A1E100F',
      offsetX: '0px',
      offsetY: '2px',
      blur: '4px',
      spread: '0px',
    },
    {
      color: '#2A1E101A',
      offsetX: '0px',
      offsetY: '16px',
      blur: '32px',
      spread: '-8px',
    },
  ],
  'light-3': [
    {
      color: '#2A1E1014',
      offsetX: '0px',
      offsetY: '4px',
      blur: '8px',
      spread: '0px',
    },
    {
      color: '#2A1E1024',
      offsetX: '0px',
      offsetY: '28px',
      blur: '56px',
      spread: '-12px',
    },
  ],
});
