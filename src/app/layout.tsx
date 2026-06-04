import type { Metadata } from "next";
import "./globals.css";
import { Sora } from "next/font/google";
import { cn } from "@/lib/utils";

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: "Mittsure Olympiad - SuperAdmin",
  description: "Official Olympiad Management Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", sora.variable)}>
      <body suppressHydrationWarning>
        <div className="bg-glow"></div>
        {children}
      </body>
    </html>
  );
}
