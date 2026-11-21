'use client';

import { useEffect } from 'react';

// Runs once in the visitor's browser. Phones that have the app normally never
// reach this page (App Links / Universal Links open the app straight away);
// this covers the rest:
//  • Android: an intent:// link opens the app if it is installed, otherwise
//    Chrome goes to the Play Store link (which carries the video id through the
//    install via the Play install referrer).
//  • iPhone: straight to the App Store; the tap was already noted on the server
//    so the app opens this video after install + sign-up.
// Desktop browsers just see the page.
export default function AutoOpen({ androidIntent, iosStore }: { androidIntent: string | null; iosStore: string | null }) {
  useEffect(() => {
    const t = setTimeout(() => {
      if (androidIntent) window.location.href = androidIntent;
      else if (iosStore) window.location.href = iosStore;
    }, 600);
    return () => clearTimeout(t);
  }, [androidIntent, iosStore]);
  return null;
}
