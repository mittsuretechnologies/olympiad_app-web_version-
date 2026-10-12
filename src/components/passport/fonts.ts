import localFont from 'next/font/local';

// The passport PDF is set in Roboto / Roboto Condensed. Self-hosted via
// @fontsource for the same reason as the app fonts in app/layout.tsx.
export const roboto = localFont({
  src: [
    { path: '../../../node_modules/@fontsource/roboto/files/roboto-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../../node_modules/@fontsource/roboto/files/roboto-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../../node_modules/@fontsource/roboto/files/roboto-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: '../../../node_modules/@fontsource/roboto/files/roboto-latin-700-italic.woff2', weight: '700', style: 'italic' },
  ],
  display: 'swap',
});

export const robotoCondensed = localFont({
  src: [
    { path: '../../../node_modules/@fontsource/roboto-condensed/files/roboto-condensed-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../../node_modules/@fontsource/roboto-condensed/files/roboto-condensed-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
});
