import type { Metadata } from "next";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { ProductImagesProvider } from "@/components/product-image";
import { isProductImagePath } from "@/lib/ghost-stock";
import { APP_VERSION } from "@/lib/version";
import "@fontsource/vt323/400.css";
import "@fontsource/press-start-2p/400.css";
import "./globals.css";
import "./pixel-theme.css";
import "./product-images.css";
import "./collection.css";
import "./arcade-workspace.css";

export const metadata: Metadata = {
  title: "Gacha Arcade — Lorcana Collectibles",
  description: `Pick your machine. Find your next collectible. A pixel arcade for Lorcana fans — ${APP_VERSION} beta demo.`,
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The prerendered manifest exposes only public product filenames, never stock.
  const files = await readdir(join(process.cwd(), "public", "products"), {
    withFileTypes: true,
  });
  const productImages = files
    .filter((file) => file.isFile())
    .map((file) => `/products/${file.name}`)
    .filter(isProductImagePath);
  return (
    <html lang="en">
      <body>
        <ProductImagesProvider paths={productImages}>
          {children}
        </ProductImagesProvider>
      </body>
    </html>
  );
}
