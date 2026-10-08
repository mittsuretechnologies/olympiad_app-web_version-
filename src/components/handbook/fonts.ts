import localFont from 'next/font/local';

// Book face for the Moderator Handbook. Self-hosted via @fontsource like the
// app's Inter (no network fetch at build time). Literata is a serif drawn for
// long-form reading on screens.
export const literata = localFont({
  src: [
    { path: '../../../node_modules/@fontsource/literata/files/literata-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../../node_modules/@fontsource/literata/files/literata-latin-400-italic.woff2', weight: '400', style: 'italic' },
    { path: '../../../node_modules/@fontsource/literata/files/literata-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../../node_modules/@fontsource/literata/files/literata-latin-600-italic.woff2', weight: '600', style: 'italic' },
    { path: '../../../node_modules/@fontsource/literata/files/literata-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
});
