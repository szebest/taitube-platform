import { defineTokenSet } from '@vp/design-tokens';

export const shadowDeep = defineTokenSet('shadow', 'deep', {
  'dark-1': [
    {
      color: '#00000066',
      offsetX: '0px',
      offsetY: '2px',
      blur: '3px',
      spread: '0px',
    },
  ],
  'dark-2': [
    {
      color: '#00000066',
      offsetX: '0px',
      offsetY: '3px',
      blur: '6px',
      spread: '0px',
    },
    {
      color: '#00000073',
      offsetX: '0px',
      offsetY: '29px',
      blur: '64px',
      spread: '-8px',
    },
  ],
  'dark-3': [
    {
      color: '#00000080',
      offsetX: '0px',
      offsetY: '6px',
      blur: '13px',
      spread: '0px',
    },
    {
      color: '#0000008C',
      offsetX: '0px',
      offsetY: '51px',
      blur: '102px',
      spread: '-12px',
    },
  ],
  'light-1': [
    {
      color: '#2A1E1014',
      offsetX: '0px',
      offsetY: '2px',
      blur: '3px',
      spread: '0px',
    },
  ],
  'light-2': [
    {
      color: '#2A1E100F',
      offsetX: '0px',
      offsetY: '3px',
      blur: '6px',
      spread: '0px',
    },
    {
      color: '#2A1E101A',
      offsetX: '0px',
      offsetY: '26px',
      blur: '51px',
      spread: '-8px',
    },
  ],
  'light-3': [
    {
      color: '#2A1E1014',
      offsetX: '0px',
      offsetY: '6px',
      blur: '13px',
      spread: '0px',
    },
    {
      color: '#2A1E1024',
      offsetX: '0px',
      offsetY: '45px',
      blur: '90px',
      spread: '-12px',
    },
  ],
});
