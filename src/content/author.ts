// App-owned identity copy. Source and owner selection: docs/PLATFORM_ADOPTION.md.
export const author = {
  alias: 'Dreven',
  publicName: 'Aleksei Bogun',
  links: [
    { label: 'GitHub', url: 'https://github.com/drevendev' },
    { label: 'Telegram', url: 'https://t.me/Drevenoise' },
    { label: 'itch.io', url: 'https://drevengames.itch.io/' },
    { label: 'X', url: 'https://x.com/drevendev' },
    { label: 'DEV', url: 'https://dev.to/drevendev' },
  ],
} as const;

// Exact destinations only: no user/model text, arbitrary URLs or protocol handlers.
export function isAuthorLink(url: string): boolean {
  return author.links.some((link) => link.url === url);
}
