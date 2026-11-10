export interface SocialTarget {
  id: 'x' | 'facebook' | 'whatsapp' | 'telegram' | 'reddit' | 'email';
  name: string;
  href: (parts: { url: string; title: string }) => string;
}

export const SOCIAL_TARGETS: readonly SocialTarget[] = [
  {
    id: 'x',
    name: 'X',
    href: ({ url, title }) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    id: 'facebook',
    name: 'Facebook',
    href: ({ url }) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    href: ({ url, title }) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    href: ({ url, title }) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    id: 'reddit',
    name: 'Reddit',
    href: ({ url, title }) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  },
  {
    id: 'email',
    name: 'Email',
    href: ({ url, title }) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
  },
];
