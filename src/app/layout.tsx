import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";

// Self-hosted via @fontsource (static files, no network fetch at build time).
// next/font/google requires downloading from fonts.gstatic.com during the
// build, which fails on networks where TLS is intercepted by a proxy whose
// root CA Node doesn't trust.
const inter = localFont({
  src: [
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: '--font-inter',
});

const poppins = localFont({
  src: [
    { path: "../../node_modules/@fontsource/poppins/files/poppins-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/poppins/files/poppins-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: "mittmee - SuperAdmin",
  description: "Official Olympiad Management Portal",
  icons: {
    icon: "/mittmee-icon.jpeg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable, poppins.variable)} style={{ '--x1': "'QnVpbHQgYnkgVWRheSBTaW5naCBSYWphd2F0'" } as React.CSSProperties}>
      <body suppressHydrationWarning>
        <div className="bg-glow"></div>
        {children}
      </body>
    </html>
  );
}
