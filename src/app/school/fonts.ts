import localFont from 'next/font/local';

// School Panel typeface. Self-hosted via @fontsource like the app's Inter (no
// network fetch at build time). Plus Jakarta Sans has the same screen clarity
// at small sizes but a warmer, more distinctive shape, which gives the panel
// its own voice instead of the default-dashboard look.
export const jakarta = localFont({
  src: [
    { path: '../../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-jakarta',
  display: 'swap',
});
