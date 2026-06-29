import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800'],
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
    <html lang="en" className={cn("font-sans", inter.variable)} style={{ '--x1': "'QnVpbHQgYnkgVWRheSBTaW5naCBSYWphd2F0'" } as React.CSSProperties}>
      <body suppressHydrationWarning>
        <div className="bg-glow"></div>
        {children}
      </body>
    </html>
  );
}
