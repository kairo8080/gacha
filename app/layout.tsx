import type { Metadata } from "next";
import { APP_VERSION } from "@/lib/version";
import "@fontsource/vt323/400.css";
import "@fontsource/press-start-2p/400.css";
import "./globals.css";
import "./pixel-theme.css";
import "./collection.css";

export const metadata: Metadata = {
  title: "Gacha Arcade — Lorcana Collectibles",
  description: `Pick your machine. Find your next collectible. A pixel arcade for Lorcana fans — ${APP_VERSION} beta demo.`,
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
