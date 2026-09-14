import type { Metadata } from "next";
import "@fontsource/vt323/400.css";
import "@fontsource/press-start-2p/400.css";
import "./globals.css";
import "./pixel-theme.css";

export const metadata: Metadata = {
  title: "Gacha Arcade — Lorcana Collectibles",
  description:
    "Pick your machine. Find your next collectible. A pixel arcade for Lorcana fans — v0.1.0 beta demo.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
